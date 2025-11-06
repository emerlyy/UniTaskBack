import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from './entities/submission.entity';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
  ) {}

  async findById(id: string): Promise<Submission> {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    return submission;
  }

  async updateAutoScore(
    id: string,
    autoScore: number,
    answerText?: string,
  ): Promise<Submission> {
    const updatePayload: Partial<Submission> = { autoScore };

    if (answerText !== undefined) {
      updatePayload.answerText = answerText;
    }

    await this.submissionsRepository.update(id, updatePayload);
    return this.findById(id);
  }
}
