import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubmissionsModule } from '../submissions/submissions.module';
import { EvaluationService } from './evaluation.service';
import { EvaluationController } from './evaluation.controller';

@Module({
  imports: [SubmissionsModule],
  providers: [EvaluationService, RolesGuard],
  controllers: [EvaluationController],
  exports: [EvaluationService],
})
export class EvaluationModule {}
