import { UserRole } from '../entities/user.entity';

export interface CreateUserDto {
  fullName: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}
