import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EvaluationService } from './evaluation.service';

class AutoEvaluateDto {
  @IsUUID()
  submission_id!: string;
}

class ManualEvaluateDto {
  @IsUUID()
  submission_id!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  final_score!: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evaluation')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('auto')
  @Roles(UserRole.Teacher)
  async autoEvaluate(@Body() dto: AutoEvaluateDto) {
    const score = await this.evaluationService.autoEvaluate(dto.submission_id);
    return { submission_id: dto.submission_id, auto_score: score };
  }

  @Post('manual')
  @Roles(UserRole.Teacher)
  async manualEvaluate(@Body() dto: ManualEvaluateDto) {
    const submission = await this.evaluationService.setFinalScore(
      dto.submission_id,
      dto.final_score,
    );
    return {
      submission_id: submission.id,
      final_score: submission.finalScore,
      status: submission.status,
    };
  }
}
