import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Task } from '../tasks/entities/task.entity';
import { StudentSubmission } from './entities/student-submission.entity';
import { SubmissionFile } from './entities/submission-file.entity';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentSubmission, SubmissionFile, Task]),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, RolesGuard],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
