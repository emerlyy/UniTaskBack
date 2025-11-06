import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CoursesService } from './courses.service';
import type { CreateCourseDto } from './dto/create-course.dto';

@UseGuards(JwtAuthGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Teacher)
  createCourse(
    @CurrentUserId() teacherId: string,
    @Body() createCourseDto: CreateCourseDto,
  ) {
    return this.coursesService.createCourse(teacherId, createCourseDto);
  }

  @Get()
  getCourses() {
    return this.coursesService.findAll();
  }

  @Get(':courseId')
  getCourse(@Param('courseId') courseId: string) {
    return this.coursesService.findById(courseId);
  }
}
