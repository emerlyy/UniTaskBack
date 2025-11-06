import { existsSync, mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const configuredDir = process.env.FILES_DIR ?? 'uploads';

export const UPLOADS_RELATIVE_PATH = configuredDir.replace(/^[\\/]+/, '');
export const UPLOADS_DIR = isAbsolute(configuredDir)
  ? configuredDir
  : join(process.cwd(), UPLOADS_RELATIVE_PATH);
export const UPLOADS_URL_PREFIX = '/uploads';

export const ensureUploadsDir = (): void => {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
};

export const buildStoredFilePath = (filename: string): string =>
  `${UPLOADS_URL_PREFIX}/${filename}`;
