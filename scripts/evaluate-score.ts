import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EvaluationService } from '../src/evaluation/evaluation.service';
import { SubmissionsService } from '../src/submissions/submissions.service';

class StubSubmissionsService {
  async updateAutoScore(
    submissionId: string,
    autoScore: number,
  ) {
    return Promise.resolve({ submissionId, autoScore });
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [
    EvaluationService,
    {
      provide: SubmissionsService,
      useClass: StubSubmissionsService,
    },
  ],
})
class EvaluationCliModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(EvaluationCliModule, {
    logger: ['error', 'warn'],
  });

  try {
    const evaluationService = app.get(EvaluationService);

    const referenceText =
      'Deep learning models can capture semantic relationships between sentences.';
    const submissionText =
      'Yarik lapa loves his mom';

    const score = await evaluationService.score(
      { text: referenceText },
      { text: submissionText },
    );

    console.log('Reference:', referenceText);
    console.log('Submission:', submissionText);
    console.log('Auto score:', score);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('Failed to run evaluation sample:', error);
  process.exit(1);
});
