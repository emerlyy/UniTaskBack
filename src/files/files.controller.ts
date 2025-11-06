import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { fileFilter, storage, toPublicUrl } from './multer.config';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', undefined, {
      storage,
      fileFilter,
    }),
  )
  uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    return {
      files: files.map((file) => ({
        file_url: toPublicUrl(file.filename),
        original_name: file.originalname,
      })),
    };
  }
}
