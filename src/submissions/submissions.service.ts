import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StudentSubmission,
  SubmissionStatus,
} from './entities/student-submission.entity';
import { SubmissionFile } from './entities/submission-file.entity';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(StudentSubmission)
    private readonly submissionsRepository: Repository<StudentSubmission>,
    @InjectRepository(SubmissionFile)
    private readonly submissionFilesRepository: Repository<SubmissionFile>,
  ) {}

  async findById(id: string): Promise<StudentSubmission> {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['files', 'student', 'task'],
    });

    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    return submission;
  }

  async save(submission: StudentSubmission): Promise<StudentSubmission> {
    return this.submissionsRepository.save(submission);
  }

  async saveFiles(
    submissionId: string,
    fileUrls: string[],
  ): Promise<SubmissionFile[]> {
    const entities = fileUrls.map((fileUrl) =>
      this.submissionFilesRepository.create({
        submissionId,
        fileUrl,
      }),
    );

    return this.submissionFilesRepository.save(entities);
  }

  async updateAutoScore(
    submissionId: string,
    autoScore: number,
  ): Promise<StudentSubmission> {
    await this.submissionsRepository.update(submissionId, {
      autoScore,
      status: SubmissionStatus.Graded,
    });
    return this.findById(submissionId);
  }

  async updateFinalScore(
    submissionId: string,
    finalScore: number,
  ): Promise<StudentSubmission> {
    await this.submissionsRepository.update(submissionId, {
      finalScore,
      status: SubmissionStatus.Graded,
    });
    return this.findById(submissionId);
  }
}
