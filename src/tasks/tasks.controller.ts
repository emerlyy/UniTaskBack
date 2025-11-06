import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TasksService } from './tasks.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { buildStoredFilePath } from '../config/uploads.config';

const isMulterFile = (value: unknown): value is Express.Multer.File => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Express.Multer.File>;
  return (
    typeof candidate.filename === 'string' &&
    typeof candidate.mimetype === 'string'
  );
};

@UseGuards(JwtAuthGuard)
@Controller('courses/:courseId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Teacher)
  @UseInterceptors(FileInterceptor('file'))
  createTask(
    @Param('courseId') courseId: string,
    @CurrentUserId() teacherId: string,
    @Body() createTaskDto: CreateTaskDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const attachmentPath = isMulterFile(file)
      ? buildStoredFilePath(file.filename)
      : null;
    return this.tasksService.createTask(
      courseId,
      teacherId,
      createTaskDto,
      attachmentPath,
    );
  }

  @Get()
  getTasks(@Param('courseId') courseId: string) {
    return this.tasksService.findTasksByCourse(courseId);
  }
}
