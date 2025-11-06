import { UserRole } from '../../users/entities/user.entity';

export interface RegisterDto {
  email: string;
  password: string;
  role?: UserRole;
}
