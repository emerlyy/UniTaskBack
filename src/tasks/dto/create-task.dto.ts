import { TaskStatus } from '../entities/task.entity';

export class CreateTaskDto {
  courseId!: string;
  title!: string;
  description?: string;
  deadline!: Date | string;
  latePenaltyPercent?: number;
  referenceFileUrl!: string;
  status?: TaskStatus;
}
