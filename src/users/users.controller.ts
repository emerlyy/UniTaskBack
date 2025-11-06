import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { UserRole } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUserId() userId: string) {
    const user = await this.usersService.findById(userId);
    return this.usersService.stripSensitiveFields(user);
  }

  @Get('teachers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Teacher)
  async findTeachers() {
    const teachers = await this.usersService.findAllTeachers();
    return teachers
      .map((teacher) => this.usersService.stripSensitiveFields(teacher))
      .filter((teacher): teacher is NonNullable<typeof teacher> => !!teacher);
  }
}
