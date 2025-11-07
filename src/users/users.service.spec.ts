import type { ObjectLiteral } from 'typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';

type MockRepo<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: MockRepo<User>;

  beforeEach(() => {
    usersRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };

    service = new UsersService(usersRepository as unknown as Repository<User>);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('create stores user with default student role', async () => {
    const dto = {
      firstName: 'Test',
      lastName: 'User',
      email: 'user@example.com',
      passwordHash: 'hash',
    };
    const created = { id: 'user-id', ...dto, role: UserRole.Student } as User;
    (usersRepository.create as jest.Mock).mockReturnValue(created);
    (usersRepository.save as jest.Mock).mockResolvedValue(created);

    const result = await service.create(dto);

    expect(usersRepository.create).toHaveBeenCalledWith({
      ...dto,
      role: UserRole.Student,
    });
    expect(result.role).toBe(UserRole.Student);
  });

  it('stripSensitiveFields removes password hash', () => {
    const user = {
      id: 'user-id',
      firstName: 'Test',
      lastName: 'User',
      email: 'user@example.com',
      passwordHash: 'hash',
      role: UserRole.Teacher,
    } as User;

    const safe = service.stripSensitiveFields(user);

    expect(safe).toEqual({
      id: 'user-id',
      firstName: 'Test',
      lastName: 'User',
      email: 'user@example.com',
      role: UserRole.Teacher,
    });
  });
});
