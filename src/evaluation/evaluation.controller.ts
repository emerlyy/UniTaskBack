import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { EvaluationService } from './evaluation.service';

class ScoreRequestDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  reference?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  referenceFilePath?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  answer?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  answerFilePath?: string;
}

class ScoreBatchRequestDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  reference?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  referenceFilePath?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  answers?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  answerFilePaths?: string[];
}

class ScoreSubmissionDto extends ScoreRequestDto {
  @IsUUID()
  submissionId!: string;
}

@Controller('evaluation')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('score')
  async score(@Body() dto: ScoreRequestDto) {
    const score = await this.evaluationService.score(
      this.buildSource(dto.reference, dto.referenceFilePath, 'reference'),
      this.buildSource(dto.answer, dto.answerFilePath, 'answer'),
    );
    return { score };
  }

  @Post('score-batch')
  async scoreBatch(@Body() dto: ScoreBatchRequestDto) {
    const referenceSource = this.buildSource(
      dto.reference,
      dto.referenceFilePath,
      'reference',
    );

    const answerSources = this.buildBatchSources(
      dto.answers,
      dto.answerFilePaths,
    );

    const scores = await this.evaluationService.scoreBatch(
      referenceSource,
      answerSources,
    );
    return { scores };
  }

  @Post('score-submission')
  async scoreSubmission(@Body() dto: ScoreSubmissionDto) {
    const score = await this.evaluationService.scoreSubmission(
      dto.submissionId,
      this.buildSource(dto.reference, dto.referenceFilePath, 'reference'),
      this.buildOptionalSource(
        dto.answer,
        dto.answerFilePath,
      ),
    );
    return { score };
  }

  private buildSource(
    text: string | undefined,
    filePath: string | undefined,
    label: 'reference' | 'answer',
  ) {
    const trimmedText = text?.trim();
    const trimmedPath = filePath?.trim();

    if (!trimmedText && !trimmedPath) {
      throw new BadRequestException(
        `Provide either ${label} text or ${label}FilePath`,
      );
    }

    return {
      text: trimmedText,
      filePath: trimmedPath,
    };
  }

  private buildOptionalSource(
    text: string | undefined,
    filePath: string | undefined,
  ) {
    const trimmedText = text?.trim();
    const trimmedPath = filePath?.trim();

    if (!trimmedText && !trimmedPath) {
      return undefined;
    }

    return {
      text: trimmedText,
      filePath: trimmedPath,
    };
  }

  private buildBatchSources(
    answers?: string[],
    answerFilePaths?: string[],
  ) {
    const textList = answers ?? [];
    const filePathList = answerFilePaths ?? [];

    if (!textList.length && !filePathList.length) {
      throw new BadRequestException(
        'Provide answers or answerFilePaths for batch scoring',
      );
    }

    if (
      textList.length &&
      filePathList.length &&
      textList.length !== filePathList.length
    ) {
      throw new BadRequestException(
        'answers and answerFilePaths must be the same length when both are provided',
      );
    }

    const maxLength = Math.max(textList.length, filePathList.length);
    const sources = [];

    for (let index = 0; index < maxLength; index += 1) {
      sources.push(
        this.buildSource(
          textList[index],
          filePathList[index],
          'answer',
        ),
      );
    }

    return sources;
  }
}
