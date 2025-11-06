import { IsString, MinLength } from 'class-validator';

export class UpdateReferenceDto {
  @IsString()
  @MinLength(1)
  referenceFileUrl!: string;
}
