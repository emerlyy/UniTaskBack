import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('courses/:courseId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Teacher)
  async createTask(
    @Param('courseId') courseId: string,
    @CurrentUserId() teacherId: string,
    @Body() dto: CreateTaskDto,
  ) {
    const payload: CreateTaskDto = {
      ...dto,
      courseId,
    };

    return this.tasksService.createTask(payload, teacherId);
  }

  @Get()
  async getTasks(@Param('courseId') courseId: string) {
    return this.tasksService.findByCourse(courseId);
  }
}
