import { ConfigService } from '@nestjs/config';

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

  it('uses jwt.refreshSecret when provided', () => {
    const cfg = {
      get: (key: string) => {
        if (key === 'jwt.refreshSecret') return 'refresh-secret';
        if (key === 'jwt.secret') return 'fallback-secret';
        return undefined;
      },
    } as unknown as ConfigService;

    new JwtRefreshStrategy(cfg);

    expect(strategyCtor).toHaveBeenCalledTimes(1);
    expect(strategyCtor).toHaveBeenCalledWith(
      expect.objectContaining({ secretOrKey: 'refresh-secret' }),
    );
  });

  it('falls back to jwt.secret when refreshSecret is missing', () => {
    const cfg = {
      get: (key: string) => {
        if (key === 'jwt.refreshSecret') return undefined;
        if (key === 'jwt.secret') return 'fallback-secret';
        return undefined;
      },
    } as unknown as ConfigService;

    new JwtRefreshStrategy(cfg);

    expect(strategyCtor).toHaveBeenCalledTimes(1);
    expect(strategyCtor).toHaveBeenCalledWith(
      expect.objectContaining({ secretOrKey: 'fallback-secret' }),
    );
  });
});
