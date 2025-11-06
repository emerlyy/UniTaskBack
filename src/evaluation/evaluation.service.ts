import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { join, isAbsolute } from 'node:path';
import { SubmissionsService } from '../submissions/submissions.service';
import type { StudentSubmission } from '../submissions/entities/student-submission.entity';
import {
  UnsupportedMimeTypeError,
  extractText,
} from '../utils/text-extraction.util';
import type { TextSource } from './types';

type TransformersModule = typeof import('@xenova/transformers');

type FeatureExtractionPipeline = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<unknown>;

type TextClassificationPipeline = (
  inputs:
    | string
    | { text: string; text_pair?: string }[]
    | { text: string; text_pair?: string },
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

interface NliPrediction {
  label: string;
  score: number;
}

const DEFAULT_MODEL_ID =
  process.env.EVAL_MODEL_ID ?? 'Xenova/paraphrase-MiniLM-L6-v2';
const DEFAULT_NLI_MODEL_ID =
  process.env.EVAL_NLI_MODEL_ID ?? 'Xenova/nli-deberta-v3-small';

@Injectable()
export class EvaluationService implements OnModuleInit {
  private readonly logger = new Logger(EvaluationService.name);

  private transformersModule?: TransformersModule;
  private featureExtractor?: FeatureExtractionPipeline;
  private nliClassifier?: TextClassificationPipeline;

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

  async autoEvaluate(submissionId: string): Promise<number> {
    const submission = await this.submissionsService.findById(submissionId);

    if (!submission.task?.referenceFileUrl) {
      throw new BadRequestException('Task does not have a reference file');
    }

    const referenceSource: TextSource = {
      filePath: submission.task.referenceFileUrl,
    };

    const referenceText = await this.resolveTextSource(
      referenceSource,
      'reference',
    );

    const answerText = await this.extractSubmissionFilesText(submission);
    const score = await this.scoreTexts(referenceText, answerText);

    await this.submissionsService.updateAutoScore(submissionId, score);
    return score;
  }

  async score(reference: TextSource, answer: TextSource): Promise<number> {
    const referenceText = await this.resolveTextSource(reference, 'reference');
    const answerText = await this.resolveTextSource(answer, 'answer');
    return this.scoreTexts(referenceText, answerText);
  }

  async setFinalScore(
    submissionId: string,
    finalScore: number,
  ): Promise<StudentSubmission> {
    return this.submissionsService.updateFinalScore(submissionId, finalScore);
  }

  private async ensureTransformersModule(): Promise<TransformersModule> {
    if (!this.transformersModule) {
      this.transformersModule = await import('@xenova/transformers');
    }
    return this.transformersModule;
  }

  private async ensurePipelineReady(): Promise<FeatureExtractionPipeline> {
    if (this.featureExtractor) {
      return this.featureExtractor;
    }

    const transformers = await this.ensureTransformersModule();

    const pipeline = await transformers.pipeline(
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

  private async ensureNliClassifier(): Promise<TextClassificationPipeline> {
    if (this.nliClassifier) {
      return this.nliClassifier;
    }

    const transformers = await this.ensureTransformersModule();
    const pipeline = await transformers.pipeline(
      'text-classification',
      DEFAULT_NLI_MODEL_ID,
      { quantized: true },
    );

    if (typeof pipeline !== 'function') {
      throw new ServiceUnavailableException(
        'Unable to initialise NLI classification pipeline',
      );
    }

    this.nliClassifier = pipeline as TextClassificationPipeline;
    return this.nliClassifier;
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

    const candidate = value as { data?: unknown; dims?: unknown };

    if (!candidate.data || !candidate.dims) {
      return false;
    }

    if (!Array.isArray(candidate.dims)) {
      return false;
    }

    const dimsValid = candidate.dims.every(
      (dim): dim is number => typeof dim === 'number' && Number.isFinite(dim),
    );

    if (!dimsValid) {
      return false;
    }

    if (!ArrayBuffer.isView(candidate.data)) {
      return false;
    }

    return !(candidate.data instanceof DataView);
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
    referenceText: string,
  ): Promise<Float32Array> {
    const cached = this.referenceCache.get(referenceText);
    if (cached) {
      return cached;
    }

    const { embedding } = await this.embed(referenceText);
    this.referenceCache.set(referenceText, embedding);
    return embedding;
  }

  private async extractSubmissionFilesText(
    submission: StudentSubmission,
  ): Promise<string> {
    if (!submission.files || submission.files.length === 0) {
      throw new BadRequestException('Submission has no files to evaluate');
    }

    const chunks: string[] = [];
    for (const file of submission.files) {
      chunks.push(
        await this.resolveTextSource({ filePath: file.fileUrl }, 'answer'),
      );
    }

    return chunks.join('\n\n');
  }

  private async resolveTextSource(
    source: TextSource,
    label: 'reference' | 'answer',
  ): Promise<string> {
    const candidateText = source.text?.trim();
    if (candidateText) {
      return candidateText;
    }

    if (!source.filePath) {
      throw new BadRequestException(
        `No ${label} text or file path provided for evaluation`,
      );
    }

    const absolutePath = this.resolveFilePath(source.filePath);

    try {
      const extracted = await extractText(absolutePath);
      if (!extracted) {
        throw new ServiceUnavailableException(
          `Unable to extract ${label} text from file`,
        );
      }

      return extracted;
    } catch (error) {
      if (error instanceof UnsupportedMimeTypeError) {
        throw new BadRequestException(
          `Unsupported ${label} file type: ${error.message}`,
        );
      }

      this.logger.error(
        `Failed to extract ${label} text from ${absolutePath}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(`Failed to extract ${label} text`);
    }
  }

  private resolveFilePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return filePath;
    }

    const sanitized = filePath.replace(/^[\\/]+/, '');
    return join(process.cwd(), sanitized);
  }

  private async scoreTexts(
    referenceText: string,
    answerText: string,
  ): Promise<number> {
    const similarity = await this.similarityTexts(referenceText, answerText);
    const baseScore = this.toScore(similarity);

    if (baseScore === 0) {
      return 0;
    }

    const contradictionProbability = await this.contradictionProbability(
      referenceText,
      answerText,
    );

    return this.applyContradictionPenalty(baseScore, contradictionProbability);
  }

  private async similarityTexts(
    referenceText: string,
    answerText: string,
  ): Promise<number> {
    const [refEmbedding, ansEmbedding] = await Promise.all([
      this.getReferenceEmbedding(referenceText),
      this.embed(answerText).then((result) => result.embedding),
    ]);

    return this.cosine(refEmbedding, ansEmbedding);
  }

  private async contradictionProbability(
    referenceText: string,
    answerText: string,
  ): Promise<number> {
    try {
      const classifier = await this.ensureNliClassifier();
      const raw = await classifier([
        { text: referenceText, text_pair: answerText },
      ]);

      const predictions = this.parseNliOutput(raw);
      const contradiction = predictions.find((prediction) =>
        prediction.label.toLowerCase().includes('contradiction'),
      );

      return contradiction?.score ?? 0;
    } catch (error) {
      this.logger.warn(
        'Failed to evaluate contradiction probability',
        error instanceof Error ? error.message : undefined,
      );
      return 0;
    }
  }

  private parseNliOutput(raw: unknown): NliPrediction[] {
    if (this.isNliPrediction(raw)) {
      return [raw];
    }

    if (Array.isArray(raw)) {
      const collected: NliPrediction[] = [];
      for (const entry of raw) {
        if (this.isNliPrediction(entry)) {
          collected.push(entry);
          continue;
        }

        if (Array.isArray(entry)) {
          for (const nested of entry) {
            if (this.isNliPrediction(nested)) {
              collected.push(nested);
            }
          }
        }
      }
      return collected;
    }

    return [];
  }

  private isNliPrediction(value: unknown): value is NliPrediction {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as { label?: unknown; score?: unknown };
    return (
      typeof candidate.label === 'string' && typeof candidate.score === 'number'
    );
  }

  private applyContradictionPenalty(
    baseScore: number,
    contradictionProbability: number,
  ): number {
    const threshold = 0.4;
    if (contradictionProbability <= threshold) {
      return baseScore;
    }

    const severity = Math.min(
      1,
      (contradictionProbability - threshold) / (1 - threshold),
    );
    const penaltyFactor = Math.max(0, 1 - severity);
    const adjusted = Math.round(baseScore * penaltyFactor);
    return Math.max(0, adjusted);
  }
}
