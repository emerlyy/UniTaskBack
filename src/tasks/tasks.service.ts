import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async createTask(
    courseId: string,
    teacherId: string,
    createTaskDto: CreateTaskDto,
  ): Promise<Task> {
    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
      select: {
        id: true,
        teacherId: true,
      },
    });

    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    if (course.teacherId !== teacherId) {
      throw new ForbiddenException('Only the course owner can create tasks');
    }

    const task = this.tasksRepository.create({
      ...createTaskDto,
      dueDate: this.parseDueDate(createTaskDto.dueDate),
      courseId,
      creatorId: teacherId,
    });

    return this.tasksRepository.save(task);
  }

  async findTasksByCourse(courseId: string): Promise<Task[]> {
    const courseExists = await this.coursesRepository.exist({
      where: { id: courseId },
    });

    if (!courseExists) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    return this.tasksRepository.find({
      where: { courseId },
      order: { dueDate: 'ASC' },
    });
  }

  private parseDueDate(
    dueDate: CreateTaskDto['dueDate'],
  ): Date | null | undefined {
    if (!dueDate) {
      return null;
    }

    if (dueDate instanceof Date) {
      return dueDate;
    }

    const parsed = new Date(dueDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid due date');
    }

    return parsed;
  }
}
