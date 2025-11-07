// No ConfigService is needed; we use env vars directly

// Capture constructor calls of passport-jwt Strategy
const strategyCtor = jest.fn();

jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (S: unknown) => S as new (...args: any[]) => any,
}));

jest.mock('passport-jwt', () => ({
  Strategy: function (options: unknown) {
    strategyCtor(options);
    // Return any object; PassportStrategy wrapper won't use it further in unit test
    return {} as unknown;
  },
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: jest.fn().mockReturnValue(() => null),
  },
}));

// Import after mocking
import { JwtRefreshStrategy } from './jwt-refresh.strategy';

describe('JwtRefreshStrategy (secrets)', () => {
  beforeEach(() => {
    strategyCtor.mockClear();
  });

  it('uses JWT_REFRESH_SECRET when provided', () => {
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    process.env.JWT_SECRET = 'fallback-secret';

    new JwtRefreshStrategy();

    expect(strategyCtor).toHaveBeenCalledTimes(1);
    expect(strategyCtor).toHaveBeenCalledWith(
      expect.objectContaining({ secretOrKey: 'refresh-secret' }),
    );
  });

  it('falls back to JWT_SECRET when refreshSecret is missing', () => {
    delete process.env.JWT_REFRESH_SECRET;
    process.env.JWT_SECRET = 'fallback-secret';

    new JwtRefreshStrategy();

    expect(strategyCtor).toHaveBeenCalledTimes(1);
    expect(strategyCtor).toHaveBeenCalledWith(
      expect.objectContaining({ secretOrKey: 'fallback-secret' }),
    );
  });
});
