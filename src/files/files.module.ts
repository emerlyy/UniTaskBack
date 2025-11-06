import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesController } from './files.controller';
import { fileFilter, storage } from './multer.config';

@Module({
  imports: [
    MulterModule.register({
      storage,
      fileFilter,
    }),
  ],
  controllers: [FilesController],
})
export class FilesModule {}
