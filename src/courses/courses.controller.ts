import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';

@UseGuards(JwtAuthGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Teacher)
  create(@CurrentUserId() teacherId: string, @Body() dto: CreateCourseDto) {
    return this.coursesService.createCourse(teacherId, dto);
  }

  @Get()
  findAll() {
    return this.coursesService.findAll();
  }

  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Teacher)
  findMine(@CurrentUserId() teacherId: string) {
    return this.coursesService.findByTeacher(teacherId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findById(id);
  }
}
