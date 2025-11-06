import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const UPLOADS_RELATIVE_PATH = 'uploads';
export const UPLOADS_DIR = join(process.cwd(), UPLOADS_RELATIVE_PATH);

export const ensureUploadsDir = (): void => {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
};

export const buildStoredFilePath = (filename: string): string =>
  `${UPLOADS_RELATIVE_PATH}/${filename}`;
