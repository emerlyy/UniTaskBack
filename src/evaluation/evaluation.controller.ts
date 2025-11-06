import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsString, MinLength } from 'class-validator';
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
}
