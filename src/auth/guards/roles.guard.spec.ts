import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../users/entities/user.entity';

const createContext = (user: unknown): ExecutionContext =>
  ({
    getClass: () => class TestController {},
    getHandler: () => function handler() {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it('allows when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(createContext({ role: UserRole.Teacher }))).toBe(
      true,
    );
  });

  it('allows when user role matches', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.Teacher,
    ]);
    expect(guard.canActivate(createContext({ role: UserRole.Teacher }))).toBe(
      true,
    );
  });

  it('denies when user role missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.Teacher,
    ]);
    expect(guard.canActivate(createContext({ role: UserRole.Student }))).toBe(
      false,
    );
  });

  it('denies when request has no user', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.Teacher,
    ]);
    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });
});
