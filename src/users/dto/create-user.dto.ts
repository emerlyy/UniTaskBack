import { UserRole } from '../entities/user.entity';

export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}
