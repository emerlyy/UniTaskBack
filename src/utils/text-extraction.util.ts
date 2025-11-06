import { promises as fs } from 'node:fs';
import { lookup as lookupMimeType } from 'mime-types';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';

type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'image/jpeg'
  | 'image/png';

const OCR_LANGUAGE = process.env.OCR_LANGUAGE ?? 'eng';

const isSupportedMimeType = (mimeType: string): mimeType is SupportedMimeType =>
  [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
  ].includes(mimeType);

export class UnsupportedMimeTypeError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported MIME type: ${mimeType}`);
    this.name = 'UnsupportedMimeTypeError';
  }
}

export const detectMimeType = (filePath: string): string =>
  lookupMimeType(filePath) || 'application/octet-stream';

export async function extractText(filePath: string): Promise<string> {
  const mimeType = detectMimeType(filePath);

  if (!isSupportedMimeType(mimeType)) {
    throw new UnsupportedMimeTypeError(mimeType);
  }

  switch (mimeType) {
    case 'application/pdf':
      return extractFromPdf(filePath);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractFromDocx(filePath);
    case 'text/plain':
      return extractFromText(filePath);
    case 'image/jpeg':
    case 'image/png':
      return extractFromImage(filePath);
    default:
      throw new UnsupportedMimeTypeError(mimeType);
  }
}

const extractFromPdf = async (filePath: string): Promise<string> => {
  const buffer = await fs.readFile(filePath);
  const result = await pdfParse(buffer);
  return normalizeWhitespace(result.text);
};

const extractFromDocx = async (filePath: string): Promise<string> => {
  const { value } = await mammoth.extractRawText({ path: filePath });
  return normalizeWhitespace(value);
};

const extractFromText = async (filePath: string): Promise<string> => {
  const content = await fs.readFile(filePath, 'utf8');
  return normalizeWhitespace(content);
};

const extractFromImage = async (filePath: string): Promise<string> => {
  const result = await Tesseract.recognize(filePath, OCR_LANGUAGE, {
    logger: undefined,
  });
  return normalizeWhitespace(result.data.text);
};

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();
