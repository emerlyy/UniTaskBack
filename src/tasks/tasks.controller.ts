import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateReferenceDto } from './dto/update-reference.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Teacher)
  create(@CurrentUserId() teacherId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto, teacherId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findById(id);
  }

  @Get('by-course/:courseId')
  findByCourse(@Param('courseId') courseId: string) {
    return this.tasksService.findByCourse(courseId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Teacher)
  update(
    @Param('id') id: string,
    @CurrentUserId() teacherId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, dto, teacherId);
  }

  @Patch(':id/reference')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Teacher)
  updateReference(
    @Param('id') id: string,
    @CurrentUserId() teacherId: string,
    @Body() dto: UpdateReferenceDto,
  ) {
    return this.tasksService.updateReference(id, dto, teacherId);
  }
}
