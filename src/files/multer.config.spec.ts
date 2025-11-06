import { BadRequestException } from '@nestjs/common';
import { fileFilter, toPublicUrl } from './multer.config';

describe('multer config', () => {
  it('fileFilter accepts allowed MIME types', () => {
    const callback = jest.fn();

    fileFilter({} as never, { mimetype: 'application/pdf' } as never, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('fileFilter rejects unsupported MIME types', () => {
    const callback = jest.fn();

    fileFilter({} as never, { mimetype: 'application/zip' } as never, callback);

    expect(callback).toHaveBeenCalledWith(expect.any(BadRequestException));
  });

  it('toPublicUrl prefixes with uploads path', () => {
    expect(toPublicUrl('file.txt')).toBe('/uploads/file.txt');
  });
});
