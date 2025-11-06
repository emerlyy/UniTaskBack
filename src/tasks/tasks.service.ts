import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
import { Task, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async createTask(dto: CreateTaskDto, teacherId: string): Promise<Task> {
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

  private parseDeadline(deadline: CreateTaskDto['deadline']): Date {
    if (deadline instanceof Date) {
      return deadline;
    }

    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid deadline');
    }

    return parsed;
  }
}
