import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import type { FileFilterCallback } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, basename } from 'node:path';
import type { Request } from 'express';
import {
  UPLOADS_DIR,
  ensureUploadsDir,
  UPLOADS_URL_PREFIX,
} from '../config/uploads.config';

ensureUploadsDir();

const ALLOWED_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/jpg',
]);

export const storage = diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, UPLOADS_DIR);
  },
  filename: (_req, file, callback) => {
    const extension = extname(file.originalname);
    const base = basename(file.originalname, extension)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
    const safeBase = base.length > 0 ? base : 'file';
    const uniqueName = `${safeBase}-${randomUUID()}${extension.toLowerCase()}`;
    callback(null, uniqueName);
  },
});

export const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
): void => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(new BadRequestException('Unsupported file type'));
    return;
  }
  callback(null, true);
};

export const toPublicUrl = (filename: string): string =>
  `${UPLOADS_URL_PREFIX}/${filename}`;
