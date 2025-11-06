import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskStatus } from './entities/task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async create(dto: CreateTaskDto, teacherId: string): Promise<Task> {
    const course = await this.coursesRepository.findOne({
      where: { id: dto.courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course ${dto.courseId} not found`);
    }

    if (course.teacherId !== teacherId) {
      throw new ForbiddenException('Only the course owner can create tasks');
    }

    const deadline = this.parseDeadline(dto.deadline);

    const task = this.tasksRepository.create({
      courseId: dto.courseId,
      title: dto.title,
      description: dto.description ?? null,
      deadline,
      latePenaltyPercent: dto.latePenaltyPercent ?? 0,
      referenceFileUrl: dto.referenceFileUrl,
      status: dto.status ?? TaskStatus.Draft,
    });

    return this.tasksRepository.save(task);
  }

  async findById(id: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['course'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    return task;
  }

  async findByCourse(courseId: string): Promise<Task[]> {
    const courseExists = await this.coursesRepository.exist({
      where: { id: courseId },
    });

    if (!courseExists) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    return this.tasksRepository.find({
      where: { courseId },
      order: { deadline: 'ASC' },
    });
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    teacherId: string,
  ): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['course'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    if (task.course.teacherId !== teacherId) {
      throw new ForbiddenException('Only the course owner can update tasks');
    }

    if (dto.title !== undefined) {
      task.title = dto.title;
    }
    if (dto.description !== undefined) {
      task.description = dto.description ?? null;
    }
    if (dto.deadline !== undefined) {
      task.deadline = this.parseDeadline(dto.deadline);
    }
    if (dto.latePenaltyPercent !== undefined) {
      task.latePenaltyPercent = dto.latePenaltyPercent;
    }
    if (dto.status !== undefined) {
      task.status = dto.status;
    }

    return this.tasksRepository.save(task);
  }

  async updateReference(
    id: string,
    dto: UpdateReferenceDto,
    teacherId: string,
  ): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['course'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    if (task.course.teacherId !== teacherId) {
      throw new ForbiddenException(
        'Only the course owner can update reference',
      );
    }

    task.referenceFileUrl = dto.referenceFileUrl;
    return this.tasksRepository.save(task);
  }

  private parseDeadline(value: string | Date): Date {
    if (value instanceof Date) {
      return value;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid deadline');
    }
    return parsed;
  }
}
