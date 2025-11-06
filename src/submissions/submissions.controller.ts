import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionsService } from './submissions.service';

@UseGuards(JwtAuthGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Student)
  create(@CurrentUserId() studentId: string, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.createSubmission(studentId, dto);
  }

  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Student)
  findMine(@CurrentUserId() studentId: string) {
    return this.submissionsService.findByStudent(studentId);
  }

  @Get(':taskId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Teacher)
  findByTask(
    @Param('taskId') taskId: string,
    @CurrentUserId() teacherId: string,
  ) {
    return this.submissionsService.findByTask(taskId, teacherId);
  }
}
