import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserRole } from './entities/user.entity';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create({
      fullName: createUserDto.fullName,
      email: createUserDto.email,
      passwordHash: createUserDto.passwordHash,
      role: createUserDto.role ?? UserRole.Student,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findAllTeachers(): Promise<User[]> {
    return this.usersRepository.find({
      where: {
        role: UserRole.Teacher,
      },
    });
  }

  stripSensitiveFields(user: User | null): SafeUser | null {
    if (!user) {
      return null;
    }

    const { passwordHash: _password, ...safe } = user;
    void _password;
    return safe as SafeUser;
  }
}
