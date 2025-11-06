import { Module } from '@nestjs/common';
import { SubmissionsModule } from '../submissions/submissions.module';
import { EvaluationService } from './evaluation.service';
import { EvaluationController } from './evaluation.controller';

@Module({
  imports: [SubmissionsModule],
  providers: [EvaluationService],
  controllers: [EvaluationController],
  exports: [EvaluationService],
})
export class EvaluationModule {}
