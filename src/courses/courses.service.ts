import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCourseDto } from './dto/create-course.dto';
import { Course } from './entities/course.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async createCourse(teacherId: string, dto: CreateCourseDto): Promise<Course> {
    const course = this.coursesRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      teacherId,
    });

    return this.coursesRepository.save(course);
  }

  async findAll(): Promise<Course[]> {
    return this.coursesRepository.find({
      relations: ['teacher'],
    });
  }

  async findByTeacher(teacherId: string): Promise<Course[]> {
    return this.coursesRepository.find({
      where: { teacherId },
      relations: ['teacher'],
    });
  }

  async findById(id: string): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: ['teacher'],
    });

    if (!course) {
      throw new NotFoundException(`Course ${id} not found`);
    }

    return course;
  }
}
