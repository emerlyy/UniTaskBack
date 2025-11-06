import { SafeUser } from '../../users/users.service';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: SafeUser;
}
