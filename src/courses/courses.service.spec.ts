import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CoursesService } from './courses.service';
import { Course } from './entities/course.entity';

import type { ObjectLiteral } from 'typeorm';

type MockRepo<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('CoursesService', () => {
  let service: CoursesService;
  let coursesRepository: MockRepo<Course>;

  beforeEach(() => {
    coursesRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    service = new CoursesService(
      coursesRepository as unknown as Repository<Course>,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('createCourse persists a course with teacherId', async () => {
    const dto = { name: 'Math', description: 'Desc' };
    const created = { id: 'course-id', ...dto, teacherId: 'teacher-id' };

    (coursesRepository.create as jest.Mock).mockReturnValue(created);
    (coursesRepository.save as jest.Mock).mockResolvedValue(created);

    const result = await service.createCourse('teacher-id', dto);

    expect(coursesRepository.create).toHaveBeenCalledWith({
      name: 'Math',
      description: 'Desc',
      teacherId: 'teacher-id',
    });
    expect(result).toEqual(created);
  });

  it('findAll returns list with teacher relation', async () => {
    (coursesRepository.find as jest.Mock).mockResolvedValue([]);

    await service.findAll();

    expect(coursesRepository.find).toHaveBeenCalledWith({
      relations: ['teacher'],
    });
  });

  it('findByTeacher filters by teacher id', async () => {
    (coursesRepository.find as jest.Mock).mockResolvedValue([]);

    await service.findByTeacher('teacher-id');

    expect(coursesRepository.find).toHaveBeenCalledWith({
      where: { teacherId: 'teacher-id' },
      relations: ['teacher'],
    });
  });

  it('findById returns course when found', async () => {
    const course = { id: 'course-id' } as Course;
    (coursesRepository.findOne as jest.Mock).mockResolvedValue(course);

    const result = await service.findById('course-id');

    expect(coursesRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'course-id' },
      relations: ['teacher'],
    });
    expect(result).toBe(course);
  });

  it('findById throws when missing', async () => {
    (coursesRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
