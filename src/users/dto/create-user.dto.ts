import { UserRole } from '../entities/user.entity';

export interface CreateUserDto {
  email: string;
  password: string;
  role?: UserRole;
}
