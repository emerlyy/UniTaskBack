import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
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
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
  ) {}

  async createSubmission(
    studentId: string,
    dto: CreateSubmissionDto,
  ): Promise<StudentSubmission> {
    const task = await this.tasksRepository.findOne({
      where: { id: dto.taskId },
      relations: ['course'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${dto.taskId} not found`);
    }

    const submission = this.submissionsRepository.create({
      taskId: task.id,
      studentId,
      status: SubmissionStatus.Pending,
    });

    const saved = await this.submissionsRepository.save(submission);

    await this.saveFiles(saved.id, dto.fileUrls);

    return this.findById(saved.id);
  }

  async findById(id: string): Promise<StudentSubmission> {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['files', 'student', 'task', 'task.course'],
    });

    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    return submission;
  }

  async findByStudent(studentId: string): Promise<StudentSubmission[]> {
    return this.submissionsRepository.find({
      where: { studentId },
      relations: ['task', 'files'],
      order: { submittedAt: 'DESC' },
    });
  }

  async findByTask(
    taskId: string,
    teacherId: string,
  ): Promise<StudentSubmission[]> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: ['course'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    if (task.course.teacherId !== teacherId) {
      throw new ForbiddenException(
        'Only the course owner can view submissions',
      );
    }

    return this.submissionsRepository.find({
      where: { taskId },
      relations: ['student', 'files'],
      order: { submittedAt: 'DESC' },
    });
  }

  async updateAutoScore(
    submissionId: string,
    autoScore: number,
  ): Promise<StudentSubmission> {
    await this.submissionsRepository.update(submissionId, {
      autoScore,
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

  private async saveFiles(
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
}
