import { Module, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import multer, {
  type DiskStorageOptions,
  type FileFilterCallback,
} from 'multer';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Express, Request } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Course } from '../courses/entities/course.entity';
import { Task } from './entities/task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { UPLOADS_DIR, ensureUploadsDir } from '../config/uploads.config';

ensureUploadsDir();

const ALLOWED_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const multerStorageOptions: DiskStorageOptions = {
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    callback: (error: Error | null, destination: string) => void,
  ) => {
    callback(null, UPLOADS_DIR);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void,
  ) => {
    const extension = extname(file.originalname).toLowerCase();
    const baseName = file.originalname.replace(extension, '');
    const normalizedBaseName = baseName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
    const safeBaseName = normalizedBaseName.length
      ? normalizedBaseName
      : 'file';
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    callback(null, `${safeBaseName}-${uniqueSuffix}${extension}`);
  },
};

const multerStorage = multer.diskStorage(multerStorageOptions);

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
): void => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const error = new BadRequestException('Invalid file type');
    callback(error);
    return;
  }

  callback(null, true);
};

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Course]),
    MulterModule.register({
      storage: multerStorage,
      fileFilter,
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, RolesGuard],
})
export class TasksModule {}
