import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsString, MinLength, IsUUID } from 'class-validator';
import { EvaluationService } from './evaluation.service';

class ScoreRequestDto {
  @IsString()
  @MinLength(1)
  reference!: string;

  @IsString()
  @MinLength(1)
  answer!: string;
}

class ScoreBatchRequestDto {
  @IsString()
  @MinLength(1)
  reference!: string;

  @IsArray()
  @IsString({ each: true })
  answers!: string[];
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
    const score = await this.evaluationService.score(dto.reference, dto.answer);
    return { score };
  }

  @Post('score-batch')
  async scoreBatch(@Body() dto: ScoreBatchRequestDto) {
    const scores = await this.evaluationService.scoreBatch(
      dto.reference,
      dto.answers,
    );
    return { scores };
  }

  @Post('score-submission')
  async scoreSubmission(@Body() dto: ScoreSubmissionDto) {
    const score = await this.evaluationService.scoreSubmission(
      dto.submissionId,
      dto.reference,
      dto.answer,
    );
    return { score };
  }
}
