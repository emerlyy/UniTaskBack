import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  UPLOADS_DIR,
  UPLOADS_URL_PREFIX,
  ensureUploadsDir,
} from './config/uploads.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  ensureUploadsDir();
  app.useStaticAssets(UPLOADS_DIR, {
    prefix: `${UPLOADS_URL_PREFIX}/`,
  });

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application', error);
  process.exit(1);
});
