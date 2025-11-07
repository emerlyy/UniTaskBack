import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  const originalEnv = process.env;

  const baseUser = {
    id: 'user-id',
    fullName: 'Test User',
    email: 'user@example.com',
    passwordHash: 'hashed',
    role: UserRole.Student,
  };

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      stripSensitiveFields: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      signAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.JWT_ACCESS_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_ACCESS_EXP = '15m';
    process.env.JWT_REFRESH_EXP = '7d';
    (mockedBcrypt.hash as unknown as jest.Mock).mockResolvedValue(
      'hashed-password',
    );
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);

    service = new AuthService(usersService, jwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  it('register hashes password and returns tokens', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockImplementation((dto) =>
      Promise.resolve({
        ...baseUser,
        passwordHash: dto.passwordHash,
      }),
    );
    usersService.stripSensitiveFields.mockReturnValue({
      id: baseUser.id,
      fullName: baseUser.fullName,
      email: baseUser.email,
      role: baseUser.role,
    });
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.register({
      fullName: 'Test User',
      email: 'user@example.com',
      password: 'secret123',
      role: UserRole.Student,
    });

    expect(mockedBcrypt.hash).toHaveBeenCalledWith(
      'secret123',
      expect.any(Number),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const createMock = usersService.create as unknown as jest.Mock;
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Test User',
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        role: UserRole.Student,
      }),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const signAsyncMock = jwtService.signAsync as unknown as jest.Mock;
    expect(signAsyncMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sub: baseUser.id }),
      expect.objectContaining({ secret: 'access-secret', expiresIn: '15m' }),
    );
    expect(signAsyncMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sub: baseUser.id }),
      expect.objectContaining({ secret: 'refresh-secret', expiresIn: '7d' }),
    );
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'user-id',
        fullName: 'Test User',
        email: 'user@example.com',
        role: UserRole.Student,
      },
    });
  });

  it('register throws when email already exists', async () => {
    usersService.findByEmail.mockResolvedValue(baseUser as never);

    await expect(
      service.register({
        fullName: 'Test',
        email: 'user@example.com',
        password: 'secret123',
        role: UserRole.Student,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('login validates password and returns tokens', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...baseUser,
      passwordHash: 'stored-hash',
    } as never);
    usersService.stripSensitiveFields.mockReturnValue({
      id: baseUser.id,
      fullName: baseUser.fullName,
      email: baseUser.email,
      role: baseUser.role,
    });
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(true);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.login({
      email: 'user@example.com',
      password: 'secret123',
    });

    expect(mockedBcrypt.compare).toHaveBeenCalledWith(
      'secret123',
      'stored-hash',
    );
    expect(result.access_token).toBe('access-token');
  });

  it('login throws when user not found', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login throws when password invalid', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...baseUser,
      passwordHash: 'stored-hash',
    } as never);
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      service.login({ email: 'user@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refreshTokens issues new tokens for existing user', async () => {
    usersService.findById.mockResolvedValue(baseUser as never);
    usersService.stripSensitiveFields.mockReturnValue({
      id: baseUser.id,
      fullName: baseUser.fullName,
      email: baseUser.email,
      role: baseUser.role,
    });
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.refreshTokens('user-id');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const findByIdMock = usersService.findById as unknown as jest.Mock;
    expect(findByIdMock).toHaveBeenCalledWith('user-id');
    expect(result.access_token).toBe('access-token');
  });

  it('refreshTokens throws when user missing', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(service.refreshTokens('missing-id')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('logout resolves without side effects', () => {
    expect(service.logout('user-id')).toBeUndefined();
  });
});
