import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ObjectLiteral } from 'typeorm';
import { Repository } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
import { Task, TaskStatus } from './entities/task.entity';
import { TasksService } from './tasks.service';

type MockRepo<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepository: MockRepo<Task>;
  let coursesRepository: MockRepo<Course>;

  beforeEach(() => {
    tasksRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };

    coursesRepository = {
      findOne: jest.fn(),
      exist: jest.fn(),
    };

    service = new TasksService(
      tasksRepository as unknown as Repository<Task>,
      coursesRepository as unknown as Repository<Course>,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('create enforces teacher ownership and saves task', async () => {
    const dto = {
      courseId: 'course-id',
      title: 'Task title',
      description: 'Details',
      deadline: '2025-01-01T00:00:00Z',
      referenceFileUrl: '/uploads/reference.pdf',
      latePenaltyPercent: 10,
      status: TaskStatus.Active,
    };

    (coursesRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'course-id',
      teacherId: 'teacher-id',
    });

    const created = { id: 'task-id', ...dto, deadline: new Date(dto.deadline) };
    (tasksRepository.create as jest.Mock).mockReturnValue(created);
    (tasksRepository.save as jest.Mock).mockResolvedValue(created);

    const result = await service.create(dto, 'teacher-id');

    expect(tasksRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'course-id',
        title: 'Task title',
        description: 'Details',
        latePenaltyPercent: 10,
        status: TaskStatus.Active,
      }),
    );
    expect(result).toBe(created);
  });

  it('create throws when teacher does not own course', async () => {
    (coursesRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'course-id',
      teacherId: 'another-teacher',
    });

    await expect(
      service.create(
        {
          courseId: 'course-id',
          title: 'Task',
          deadline: new Date().toISOString(),
          referenceFileUrl: '/file',
        },
        'teacher-id',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('create throws when deadline invalid', async () => {
    (coursesRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'course-id',
      teacherId: 'teacher-id',
    });

    await expect(
      service.create(
        {
          courseId: 'course-id',
          title: 'Task',
          deadline: 'not-a-date',
          referenceFileUrl: '/file',
        },
        'teacher-id',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('findById returns task with relations', async () => {
    const task = { id: 'task-id' } as Task;
    (tasksRepository.findOne as jest.Mock).mockResolvedValue(task);

    const result = await service.findById('task-id');

    expect(tasksRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'task-id' },
      relations: ['course'],
    });
    expect(result).toBe(task);
  });

  it('findById throws when missing', async () => {
    (tasksRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findByCourse requires course to exist', async () => {
    (coursesRepository.exist as jest.Mock).mockResolvedValue(true);
    (tasksRepository.find as jest.Mock).mockResolvedValue([]);

    await service.findByCourse('course-id');

    expect(tasksRepository.find).toHaveBeenCalledWith({
      where: { courseId: 'course-id' },
      order: { deadline: 'ASC' },
    });
  });

  it('findByCourse throws when course missing', async () => {
    (coursesRepository.exist as jest.Mock).mockResolvedValue(false);

    await expect(service.findByCourse('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update allows teacher to modify fields', async () => {
    const task = {
      id: 'task-id',
      title: 'Old',
      description: 'Old desc',
      deadline: new Date(),
      latePenaltyPercent: 0,
      status: TaskStatus.Draft,
      course: { teacherId: 'teacher-id' },
    } as unknown as Task;

    (tasksRepository.findOne as jest.Mock).mockResolvedValue(task);
    (tasksRepository.save as jest.Mock).mockImplementation(
      (entity: Task) => entity,
    );

    const result = await service.update(
      'task-id',
      {
        title: 'New',
        description: 'New desc',
        latePenaltyPercent: 5,
        status: TaskStatus.Active,
      },
      'teacher-id',
    );

    expect(result.title).toBe('New');
    expect(result.description).toBe('New desc');
    expect(result.latePenaltyPercent).toBe(5);
    expect(result.status).toBe(TaskStatus.Active);
  });

  it('update throws when teacher mismatched', async () => {
    (tasksRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'task-id',
      course: { teacherId: 'another-teacher' },
    });

    await expect(
      service.update('task-id', { title: 'New' }, 'teacher-id'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateReference updates reference file when authorized', async () => {
    const task = {
      id: 'task-id',
      referenceFileUrl: '/old',
      course: { teacherId: 'teacher-id' },
    } as unknown as Task;

    (tasksRepository.findOne as jest.Mock).mockResolvedValue(task);
    (tasksRepository.save as jest.Mock).mockImplementation(
      (entity: Task) => entity,
    );

    const result = await service.updateReference(
      'task-id',
      { referenceFileUrl: '/new' },
      'teacher-id',
    );

    expect(result.referenceFileUrl).toBe('/new');
  });
});
