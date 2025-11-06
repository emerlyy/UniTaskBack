import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsInt,
  Min,
} from 'class-validator';
import { TaskStatus } from '../entities/task.entity';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  deadline?: Date | string;

  @IsInt()
  @Min(0)
  @IsOptional()
  latePenaltyPercent?: number;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;
}
