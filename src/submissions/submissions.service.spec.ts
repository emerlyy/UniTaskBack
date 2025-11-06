import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ObjectLiteral } from 'typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';
import {
  StudentSubmission,
  SubmissionStatus,
} from './entities/student-submission.entity';
import { SubmissionFile } from './entities/submission-file.entity';
import { SubmissionsService } from './submissions.service';

type MockRepo<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let submissionsRepository: MockRepo<StudentSubmission>;
  let submissionFilesRepository: MockRepo<SubmissionFile>;
  let tasksRepository: MockRepo<Task>;

  beforeEach(() => {
    submissionsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };

    submissionFilesRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    tasksRepository = {
      findOne: jest.fn(),
    };

    service = new SubmissionsService(
      submissionsRepository as unknown as Repository<StudentSubmission>,
      submissionFilesRepository as unknown as Repository<SubmissionFile>,
      tasksRepository as unknown as Repository<Task>,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('createSubmission saves submission and files', async () => {
    const task = {
      id: 'task-id',
      course: { teacherId: 'teacher-id' },
    } as unknown as Task;
    (tasksRepository.findOne as jest.Mock).mockResolvedValue(task);

    const createdSubmission = {
      id: 'submission-id',
      taskId: 'task-id',
      studentId: 'student-id',
      status: SubmissionStatus.Pending,
    } as unknown as StudentSubmission;

    (submissionsRepository.create as jest.Mock).mockReturnValue(
      createdSubmission,
    );
    (submissionsRepository.save as jest.Mock).mockResolvedValue(
      createdSubmission,
    );
    (submissionFilesRepository.create as jest.Mock).mockImplementation(
      (value: SubmissionFile) => ({ ...value }) as SubmissionFile,
    );
    (submissionFilesRepository.save as jest.Mock).mockResolvedValue([]);
    (submissionsRepository.findOne as jest.Mock).mockResolvedValue({
      ...createdSubmission,
      files: [],
    });

    const result = await service.createSubmission('student-id', {
      taskId: 'task-id',
      fileUrls: ['/uploads/file1', '/uploads/file2'],
    });

    expect(submissionFilesRepository.create).toHaveBeenCalledTimes(2);
    expect(submissionFilesRepository.create).toHaveBeenCalledWith({
      submissionId: 'submission-id',
      fileUrl: '/uploads/file1',
    });
    expect(result.id).toBe('submission-id');
  });

  it('createSubmission throws when task missing', async () => {
    (tasksRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.createSubmission('student', {
        taskId: 'missing',
        fileUrls: ['/file'],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('findById returns submission with relations', async () => {
    const submission = { id: 'submission-id' } as StudentSubmission;
    (submissionsRepository.findOne as jest.Mock).mockResolvedValue(submission);

    const result = await service.findById('submission-id');

    expect(submissionsRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'submission-id' },
      relations: ['files', 'student', 'task', 'task.course'],
    });
    expect(result).toBe(submission);
  });

  it('findById throws when missing', async () => {
    (submissionsRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findByStudent retrieves submissions ordered by date', async () => {
    (submissionsRepository.find as jest.Mock).mockResolvedValue([]);

    await service.findByStudent('student-id');

    expect(submissionsRepository.find).toHaveBeenCalledWith({
      where: { studentId: 'student-id' },
      relations: ['task', 'files'],
      order: { submittedAt: 'DESC' },
    });
  });

  it('findByTask enforces teacher ownership', async () => {
    const task = {
      id: 'task-id',
      course: { teacherId: 'teacher-id' },
    };
    (tasksRepository.findOne as jest.Mock).mockResolvedValue(task);
    (submissionsRepository.find as jest.Mock).mockResolvedValue([]);

    await service.findByTask('task-id', 'teacher-id');

    expect(submissionsRepository.find).toHaveBeenCalledWith({
      where: { taskId: 'task-id' },
      relations: ['student', 'files'],
      order: { submittedAt: 'DESC' },
    });
  });

  it('findByTask throws when teacher does not own task', async () => {
    const task = {
      id: 'task-id',
      course: { teacherId: 'another' },
    };
    (tasksRepository.findOne as jest.Mock).mockResolvedValue(task);

    await expect(service.findByTask('task-id', 'teacher-id')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('updateAutoScore updates submission and returns populated entity', async () => {
    (submissionsRepository.update as jest.Mock).mockResolvedValue(undefined);
    (submissionsRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'submission-id',
      autoScore: 80,
    });

    const result = await service.updateAutoScore('submission-id', 80);

    expect(submissionsRepository.update).toHaveBeenCalledWith('submission-id', {
      autoScore: 80,
    });
    expect(result.autoScore).toBe(80);
  });

  it('updateFinalScore persists final score and marks graded', async () => {
    (submissionsRepository.update as jest.Mock).mockResolvedValue(undefined);
    (submissionsRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'submission-id',
      finalScore: 90,
      status: SubmissionStatus.Graded,
    });

    const result = await service.updateFinalScore('submission-id', 90);

    expect(submissionsRepository.update).toHaveBeenCalledWith('submission-id', {
      finalScore: 90,
      status: SubmissionStatus.Graded,
    });
    expect(result.finalScore).toBe(90);
  });
});
