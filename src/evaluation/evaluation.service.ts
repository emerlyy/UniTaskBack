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

// ---- Типи для transformers ----
type TransformersModule = typeof import('@xenova/transformers');
type FeatureExtractionPipeline = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<unknown>;

// ---- Мінімальний формат тензора ----
interface TensorLike {
  data: ArrayLike<number>;
  dims: number[];
}

const MODEL_ID = process.env.EVAL_MODEL_ID ?? 'Xenova/paraphrase-MiniLM-L6-v2';

@Injectable()
export class EvaluationService implements OnModuleInit {
  private readonly logger = new Logger(EvaluationService.name);

  private transformersModule?: TransformersModule;
  private featureExtractor?: FeatureExtractionPipeline;

  // Кеш ембеддингів еталонного тексту (щоб не перераховувати щоразу)
  private readonly referenceCache = new Map<string, Float32Array>();

  constructor(private readonly submissionsService: SubmissionsService) {}

  async onModuleInit(): Promise<void> {
    await this.ensurePipeline();
    // невеликий warmup, щоб підвантажити модель
    await this.embed('warmup');
    this.logger.log(`Evaluation model ready: ${MODEL_ID}`);
  }

  // ---------------- Публічні методи ----------------

  // Автооцінювання за submissionId: дістаємо тексти, рахуємо cos→score, зберігаємо autoScore
  async autoEvaluate(submissionId: string): Promise<number> {
    const submission = await this.submissionsService.findById(submissionId);

    if (!submission.task?.referenceFileUrl) {
      throw new BadRequestException('Task does not have a reference file');
    }

    const referenceText = await this.resolveTextSource(
      { filePath: submission.task.referenceFileUrl },
      'reference',
    );
    const answerText = await this.extractSubmissionFilesText(submission);

    let score = await this.scoreTexts(referenceText, answerText);

    const due = submission.task?.dueDate;
    const submitted = submission.submittedAt;
    const penaltyPercent = submission.task?.latePenaltyPercent ?? 0;

    if (penaltyPercent > 0) {
      if (submitted.getTime() > due.getTime()) {
        const factor = Math.max(0, 1 - penaltyPercent / 100);
        score = Math.round(score * factor);
      }
    }

    await this.submissionsService.updateAutoScore(submissionId, score);

    return score;
  }

  // Загальний метод оцінювання для довільних джерел
  async score(reference: TextSource, answer: TextSource): Promise<number> {
    const ref = await this.resolveTextSource(reference, 'reference');
    const ans = await this.resolveTextSource(answer, 'answer');
    return this.scoreTexts(ref, ans);
  }

  // Встановлення фінальної оцінки
  async setFinalScore(
    submissionId: string,
    finalScore: number,
  ): Promise<StudentSubmission> {
    return this.submissionsService.updateFinalScore(submissionId, finalScore);
  }

  // ---------------- Ядро: ембеддинги та подібність ----------------

  private async ensurePipeline(): Promise<FeatureExtractionPipeline> {
    if (this.featureExtractor) return this.featureExtractor;

    this.transformersModule = await import('@xenova/transformers');
    const pipeline = await this.transformersModule.pipeline(
      'feature-extraction',
      MODEL_ID,
      { quantized: true },
    );

    if (typeof pipeline !== 'function') {
      throw new ServiceUnavailableException(
        'Cannot initialize feature-extraction pipeline',
      );
    }

    this.featureExtractor = pipeline as FeatureExtractionPipeline;
    return this.featureExtractor;
  }

  // Отримання ембеддинга тексту: transformer → last_hidden_state → mean-pooling
  private async embed(text: string): Promise<{ embedding: Float32Array }> {
    const extractor = await this.ensurePipeline();
    const raw = await extractor(text, {
      pooling: 'none',
      normalize: false,
      return_attention_mask: false, // спрощуємо: без маски, середнє по токенах
    });

    const lastHiddenState = this.extractLastHiddenState(raw);
    const pooled = this.meanPool(lastHiddenState);
    // Додаткове l2-нормування не потрібне: косинус рахуємо з власними нормами
    return { embedding: pooled };
  }

  // Оцінка двох текстів: cos ∈ [-1,1] → шкала [0,100]
  private async scoreTexts(ref: string, ans: string): Promise<number> {
    const similarity = await this.similarity(ref, ans);
    return this.toScore(similarity);
  }

  private async similarity(a: string, b: string): Promise<number> {
    const [refEmb, ansEmb] = await Promise.all([
      this.getReferenceEmbedding(a),
      this.embed(b).then((x) => x.embedding),
    ]);

    return this.cosine(refEmb, ansEmb);
  }

  // Косинусна подібність: cos(a, b) = (a·b) / (||a|| * ||b||)
  private cosine(a: Float32Array, b: Float32Array): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      const va = a[i];
      const vb = b[i];
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dot / denom;
  }

  // Лінійне відображення з [-1,1] у [0,100]
  private toScore(similarity: number): number {
    const clamped = Math.max(-1, Math.min(1, similarity));
    const scaled = ((clamped + 1) / 2) * 100;
    return Math.round(Math.max(0, Math.min(100, scaled)));
  }

  // Кеш еталонних ембеддингів
  private async getReferenceEmbedding(text: string): Promise<Float32Array> {
    const cached = this.referenceCache.get(text);
    if (cached) return cached;

    const { embedding } = await this.embed(text);
    this.referenceCache.set(text, embedding);
    return embedding;
  }

  // ---------------- Витяг тексту з файлів подання ----------------

  private async extractSubmissionFilesText(
    submission: StudentSubmission,
  ): Promise<string> {
    const files = submission.files ?? [];
    if (!files.length) {
      throw new BadRequestException('Submission has no files');
    }

    const parts: string[] = [];
    for (const file of files) {
      parts.push(
        await this.resolveTextSource({ filePath: file.fileUrl }, 'answer'),
      );
    }
    return parts.join('\n\n');
  }

  // ---------------- Уніфікація джерел тексту ----------------

  private async resolveTextSource(
    source: TextSource,
    label: 'reference' | 'answer' = 'answer',
  ): Promise<string> {
    const inline = source.text?.trim();
    if (inline) return inline;

    if (!source.filePath) {
      throw new BadRequestException(`No ${label} text or file path provided`);
    }

    const absolutePath = this.resolveFilePath(source.filePath);

    try {
      const extracted = await extractText(absolutePath);
      if (!extracted) throw new Error('empty extract');
      return extracted;
    } catch (err) {
      if (err instanceof UnsupportedMimeTypeError) {
        throw new BadRequestException(
          `Unsupported ${label} file type: ${err.message}`,
        );
      }
      this.logger.error(`Failed to extract ${label} text from ${absolutePath}`);
      throw new ServiceUnavailableException(`Failed to extract ${label} text`);
    }
  }

  private resolveFilePath(filePath: string): string {
    if (isAbsolute(filePath)) return filePath;
    // прибираємо початкові / або \ для надійності
    return join(process.cwd(), filePath.replace(/^[\\/]+/, ''));
  }

  // ---------------- Парсинг виходу трансформера ----------------

  private extractLastHiddenState(raw: unknown): TensorLike {
    // Випадок: повернувся об'єкт { last_hidden_state: Tensor, ... }
    if (raw && typeof raw === 'object' && (raw as any).last_hidden_state) {
      const t = (raw as any).last_hidden_state;
      return this.ensureTensorLike(t);
    }

    // Випадок: повернувся масив, беремо перший елемент
    if (Array.isArray(raw) && raw.length > 0) {
      return this.ensureTensorLike(raw[0]);
    }

    // Випадок: сам тензор
    if (raw && typeof raw === 'object') {
      return this.ensureTensorLike(raw as any);
    }

    throw new ServiceUnavailableException(
      'Unexpected output from feature extractor',
    );
  }

  private ensureTensorLike(value: any): TensorLike {
    if (
      value &&
      typeof value === 'object' &&
      Array.isArray(value.dims) &&
      value.dims.length >= 2 &&
      value.data &&
      typeof value.data.length === 'number'
    ) {
      return value as TensorLike;
    }
    throw new ServiceUnavailableException(
      'Invalid tensor format returned by model',
    );
  }

  // Середнє по токенах (mean-pooling) → вектор розмірності hidden_size
  private meanPool(lastHiddenState: TensorLike): Float32Array {
    // dims зазвичай [batch, tokens, hidden] або [tokens, hidden]
    const dims = lastHiddenState.dims;
    const data = lastHiddenState.data;

    let tokens: number;
    let hidden: number;

    if (dims.length === 3) {
      tokens = dims[1];
      hidden = dims[2];
    } else {
      tokens = dims[0];
      hidden = dims[1];
    }

    const out = new Float32Array(hidden);

    for (let t = 0; t < tokens; t++) {
      const offset = t * hidden;
      for (let h = 0; h < hidden; h++) {
        out[h] += Number(data[offset + h]);
      }
    }

    const inv = tokens > 0 ? 1 / tokens : 1;
    for (let h = 0; h < hidden; h++) {
      out[h] *= inv;
    }

    return out;
  }
}
