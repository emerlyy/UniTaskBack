import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

type JwtExtractor = {
  fromAuthHeaderAsBearerToken(): (req: Request) => string | null;
};

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const jwtFromRequest = (
      ExtractJwt as JwtExtractor
    ).fromAuthHeaderAsBearerToken();

    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'secret',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
