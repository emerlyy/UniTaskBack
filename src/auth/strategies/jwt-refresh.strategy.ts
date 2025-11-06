import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  JwtPayload,
  JwtPayloadWithRefresh,
} from '../interfaces/jwt-payload.interface';

type JwtExtractor = {
  fromAuthHeaderAsBearerToken(): (req: Request) => string | null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly configService: ConfigService) {
    const jwtFromRequest = (
      ExtractJwt as JwtExtractor
    ).fromAuthHeaderAsBearerToken();

    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? 'secret',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): JwtPayloadWithRefresh {
    const refreshToken = this.extractToken(req);

    return {
      ...payload,
      refreshToken,
    };
  }

  private extractToken(req: Request): string {
    const authHeader = req.get('authorization');
    if (!authHeader) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const [, token] = authHeader.split(' ');
    if (!token) {
      throw new UnauthorizedException('Refresh token malformed');
    }

    return token;
  }
}
