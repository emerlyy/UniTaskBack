import { join } from 'node:path';
import { EvaluationService } from './evaluation.service';
import type { SubmissionsService } from '../submissions/submissions.service';

describe('EvaluationService (unit)', () => {
  let service: EvaluationService;
  const submissionsService = {
    updateAutoScore: jest.fn(),
  } as unknown as SubmissionsService;

  beforeEach(() => {
    service = new EvaluationService(submissionsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('score resolves sources and delegates to scoreTexts', async () => {
    const serviceAny = service as unknown as {
      resolveTextSource: jest.Mock;
      scoreTexts: jest.Mock;
    };

    const resolveSpy = jest
      .spyOn(serviceAny, 'resolveTextSource')
      .mockResolvedValueOnce('reference text')
      .mockResolvedValueOnce('answer text');
    const scoreTextsSpy = jest
      .spyOn(serviceAny, 'scoreTexts')
      .mockResolvedValue(92);

    const score = await service.score(
      { text: 'ref' },
      { filePath: '/tmp/answer.txt' },
    );

    expect(resolveSpy).toHaveBeenNthCalledWith(1, { text: 'ref' }, 'reference');
    expect(resolveSpy).toHaveBeenNthCalledWith(
      2,
      { filePath: '/tmp/answer.txt' },
      'answer',
    );
    expect(scoreTextsSpy).toHaveBeenCalledWith('reference text', 'answer text');
    expect(score).toBe(92);
  });

  it('scoreTexts returns cosine-based score without penalty', async () => {
    const serviceAny = service as unknown as {
      similarityTexts: jest.Mock;
      contradictionProbability: jest.Mock;
      scoreTexts: (reference: string, answer: string) => Promise<number>;
    };

    jest.spyOn(serviceAny, 'similarityTexts').mockResolvedValue(0.6);
    jest.spyOn(serviceAny, 'contradictionProbability').mockResolvedValue(0);

    const score = await serviceAny.scoreTexts('reference', 'answer');

    expect(score).toBe(80);
  });

  it('scoreTexts applies contradiction penalty when probability is high', async () => {
    const serviceAny = service as unknown as {
      similarityTexts: jest.Mock;
      contradictionProbability: jest.Mock;
      scoreTexts: (reference: string, answer: string) => Promise<number>;
    };

    jest.spyOn(serviceAny, 'similarityTexts').mockResolvedValue(0.5);
    jest.spyOn(serviceAny, 'contradictionProbability').mockResolvedValue(0.9);

    const score = await serviceAny.scoreTexts('reference', 'answer');

    const baseScore = Math.round(((0.5 + 1) / 2) * 100);
    const severity = Math.min(1, (0.9 - 0.4) / (1 - 0.4));
    const penaltyFactor = Math.max(0, 1 - severity);
    const expected = Math.round(baseScore * penaltyFactor);

    expect(score).toBe(expected);
  });

  it('scoreTexts returns zero when similarity maps to zero score', async () => {
    const serviceAny = service as unknown as {
      similarityTexts: jest.Mock;
      contradictionProbability: jest.Mock;
      scoreTexts: (reference: string, answer: string) => Promise<number>;
    };

    jest.spyOn(serviceAny, 'similarityTexts').mockResolvedValue(-1);
    jest.spyOn(serviceAny, 'contradictionProbability').mockResolvedValue(0.95);

    const score = await serviceAny.scoreTexts('reference', 'answer');

    expect(score).toBe(0);
  });

  it('resolveFilePath returns absolute path for relative inputs', () => {
    const serviceAny = service as unknown as {
      resolveFilePath: (path: string) => string;
    };

    const resolved = serviceAny.resolveFilePath('uploads/file.txt');
    expect(resolved).toBe(join(process.cwd(), 'uploads', 'file.txt'));
  });

  it('resolveFilePath returns absolute path unchanged', () => {
    const serviceAny = service as unknown as {
      resolveFilePath: (path: string) => string;
    };

    const absolutePath = join(process.cwd(), 'uploads', 'file.txt');
    expect(serviceAny.resolveFilePath(absolutePath)).toBe(absolutePath);
  });
});
