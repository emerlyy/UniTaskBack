import {
  ArrayNotEmpty,
  IsArray,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateSubmissionDto {
  @IsUUID()
  taskId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  fileUrls!: string[];
}
