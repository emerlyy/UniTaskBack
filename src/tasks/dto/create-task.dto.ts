import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { TaskStatus } from '../entities/task.entity';

export class CreateTaskDto {
  @IsUUID()
  courseId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  dueDate!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  latePenaltyPercent?: number;

  @IsString()
  @MinLength(1)
  referenceFileUrl!: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;
}
