import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SubmissionsService } from '../submissions/submissions.service';

type TransformersModule = typeof import('@xenova/transformers');

type FeatureExtractionPipeline = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<unknown>;

type SupportedTypedArray =
  | Float32Array
  | Float64Array
  | Int32Array
  | Int16Array
  | Int8Array
  | Uint32Array
  | Uint16Array
  | Uint8Array
  | BigInt64Array
  | BigUint64Array;

interface TensorLike {
  data: SupportedTypedArray;
  dims: readonly number[];
}

interface PipelineOutputWithMask {
  attention_mask?: unknown;
  last_hidden_state?: unknown;
}

const DEFAULT_MODEL_ID =
  process.env.EVAL_MODEL_ID ?? 'Xenova/paraphrase-MiniLM-L6-v2';

@Injectable()
export class EvaluationService implements OnModuleInit {
  private readonly logger = new Logger(EvaluationService.name);

  private transformersModule?: TransformersModule;
  private featureExtractor?: FeatureExtractionPipeline;

  private readonly referenceCache = new Map<string, Float32Array>();

  constructor(private readonly submissionsService: SubmissionsService) {}

  async onModuleInit(): Promise<void> {
    await this.ensurePipelineReady();
    await this.embed('warmup');
    this.logger.log(`Evaluation model ready: ${DEFAULT_MODEL_ID}`);
  }

  async embed(text: string): Promise<{ embedding: Float32Array }> {
    const extractor = await this.ensurePipelineReady();
    const rawOutput = await extractor(text, {
      pooling: 'none',
      normalize: false,
      return_attention_mask: true,
    });

    const { lastHiddenState, attentionMask } =
      this.parseFeatureExtractionOutput(rawOutput);
    const pooled = this.meanPool(lastHiddenState, attentionMask);
    const normalized = this.l2Normalize(pooled);

    return { embedding: normalized };
  }

  async similarity(reference: string, answer: string): Promise<number> {
    const [refEmbedding, ansEmbedding] = await Promise.all([
      this.getReferenceEmbedding(reference),
      this.embed(answer).then((result) => result.embedding),
    ]);

    return this.cosine(refEmbedding, ansEmbedding);
  }

  async score(reference: string, answer: string): Promise<number> {
    const similarity = await this.similarity(reference, answer);
    return this.toScore(similarity);
  }

  async scoreBatch(reference: string, answers: string[]): Promise<number[]> {
    const refEmbedding = await this.getReferenceEmbedding(reference);
    const embeddingPromises = answers.map((answer) => this.embed(answer));
    const computedEmbeddings = await Promise.all(embeddingPromises);
    return computedEmbeddings.map(({ embedding }) =>
      this.toScore(this.cosine(refEmbedding, embedding)),
    );
  }

  async scoreSubmission(
    submissionId: string,
    reference: string,
    answer: string,
  ): Promise<number> {
    const score = await this.score(reference, answer);
    await this.submissionsService.updateAutoScore(submissionId, score);
    return score;
  }

  private async ensurePipelineReady(): Promise<FeatureExtractionPipeline> {
    if (this.featureExtractor) {
      return this.featureExtractor;
    }

    if (!this.transformersModule) {
      this.transformersModule = await import('@xenova/transformers');
    }

    const pipeline = await this.transformersModule.pipeline(
      'feature-extraction',
      DEFAULT_MODEL_ID,
      { quantized: true },
    );

    if (typeof pipeline !== 'function') {
      throw new ServiceUnavailableException(
        'Unable to initialise feature-extraction pipeline',
      );
    }

    this.featureExtractor = pipeline as FeatureExtractionPipeline;
    return this.featureExtractor;
  }

  private parseFeatureExtractionOutput(raw: unknown): {
    lastHiddenState: TensorLike;
    attentionMask?: TensorLike;
  } {
    if (this.isTensorLike(raw)) {
      return {
        lastHiddenState: raw,
        attentionMask: this.extractOptionalTensor(
          (raw as PipelineOutputWithMask).attention_mask,
        ),
      };
    }

    if (Array.isArray(raw)) {
      const firstElement: unknown = raw.at(0);
      if (!firstElement) {
        throw new ServiceUnavailableException(
          'Empty output from feature extractor',
        );
      }
      return {
        lastHiddenState: this.ensureTensor(firstElement),
        attentionMask: this.extractOptionalTensor(
          (raw as PipelineOutputWithMask).attention_mask,
        ),
      };
    }

    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as PipelineOutputWithMask & Record<string, unknown>;
      if (obj.last_hidden_state !== undefined) {
        return {
          lastHiddenState: this.ensureTensor(obj.last_hidden_state),
          attentionMask: this.extractOptionalTensor(obj.attention_mask),
        };
      }
    }

    throw new ServiceUnavailableException(
      'Unexpected output from feature extractor',
    );
  }

  private ensureTensor(value: unknown): TensorLike {
    if (this.isTensorLike(value)) {
      return value;
    }

    throw new ServiceUnavailableException(
      'Invalid tensor returned by feature extractor',
    );
  }

  private extractOptionalTensor(value: unknown): TensorLike | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (this.isTensorLike(value)) {
      return value;
    }

    return undefined;
  }

  private isTensorLike(value: unknown): value is TensorLike {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const maybeTensor = value as { data?: unknown; dims?: unknown };
    if (!maybeTensor.data || !maybeTensor.dims) {
      return false;
    }

    if (!Array.isArray(maybeTensor.dims)) {
      return false;
    }

    const dimsValid = maybeTensor.dims.every(
      (dim): dim is number => typeof dim === 'number' && Number.isFinite(dim),
    );

    if (!dimsValid) {
      return false;
    }

    if (!ArrayBuffer.isView(maybeTensor.data)) {
      return false;
    }

    return !(maybeTensor.data instanceof DataView);
  }

  private meanPool(
    lastHiddenState: TensorLike,
    attentionMask?: TensorLike,
  ): Float32Array {
    const dims = lastHiddenState.dims;

    if (dims.length < 2) {
      throw new ServiceUnavailableException('Unexpected tensor dimensions');
    }

    const tokens = dims.length === 3 ? dims[1] : dims[0];
    const dimension = dims.length === 3 ? dims[2] : (dims[1] ?? 0);

    if (!tokens || !dimension) {
      throw new ServiceUnavailableException('Invalid tensor shape');
    }

    const output = new Float32Array(dimension);
    const maskData = attentionMask?.data;
    const hiddenStateData = lastHiddenState.data;

    let included = 0;

    for (let tokenIndex = 0; tokenIndex < tokens; tokenIndex += 1) {
      let includeToken = true;
      if (maskData && maskData.length > tokenIndex) {
        const maskValue = maskData[tokenIndex];
        includeToken = Number(maskValue) > 0.5;
      }

      if (!includeToken) {
        continue;
      }

      included += 1;
      const offset = tokenIndex * dimension;
      for (let dimIndex = 0; dimIndex < dimension; dimIndex += 1) {
        const rawValue = hiddenStateData[offset + dimIndex];
        const numericValue =
          typeof rawValue === 'bigint' ? Number(rawValue) : rawValue;
        output[dimIndex] += numericValue;
      }
    }

    const divisor = included > 0 ? included : tokens;
    if (divisor > 0) {
      for (let dimIndex = 0; dimIndex < dimension; dimIndex += 1) {
        output[dimIndex] /= divisor;
      }
    }

    return output;
  }

  private l2Normalize(vector: Float32Array): Float32Array {
    let sumSquares = 0;
    for (let index = 0; index < vector.length; index += 1) {
      const value = vector[index];
      sumSquares += value * value;
    }

    if (sumSquares === 0) {
      return Float32Array.from(vector);
    }

    const scale = 1 / Math.sqrt(sumSquares);
    return Float32Array.from(vector, (value) => value * scale);
  }

  private cosine(a: Float32Array, b: Float32Array): number {
    const length = Math.min(a.length, b.length);
    let dot = 0;
    for (let index = 0; index < length; index += 1) {
      dot += a[index] * b[index];
    }

    return dot;
  }

  private toScore(similarity: number): number {
    const clamped = Math.max(-1, Math.min(1, similarity));
    const percentage = ((clamped + 1) / 2) * 100;
    return Math.max(0, Math.min(100, Math.round(percentage)));
  }

  private async getReferenceEmbedding(
    reference: string,
  ): Promise<Float32Array> {
    const cached = this.referenceCache.get(reference);
    if (cached) {
      return cached;
    }

    const { embedding } = await this.embed(reference);
    this.referenceCache.set(reference, embedding);
    return embedding;
  }
}
