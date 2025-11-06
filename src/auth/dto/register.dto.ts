import { UserRole } from '../../users/entities/user.entity';

export interface RegisterDto {
  fullName: string;
  email: string;
  password: string;
  role?: UserRole;
}
