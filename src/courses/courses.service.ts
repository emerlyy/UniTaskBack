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

  async createCourse(
    teacherId: string,
    createCourseDto: CreateCourseDto,
  ): Promise<Course> {
    const course = this.coursesRepository.create({
      ...createCourseDto,
      teacherId,
    });

    return this.coursesRepository.save(course);
  }

  async findAll(): Promise<Course[]> {
    return this.coursesRepository.find();
  }

  async findById(courseId: string): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    return course;
  }
}
