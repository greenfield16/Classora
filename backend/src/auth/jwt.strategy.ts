// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService, private auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: cfg.get('JWT_SECRET'),
    })
  }

  async validate(payload: any) {
    const user = await this.auth.validateById(payload.sub)
    if (!user || !user.isActive) throw new UnauthorizedException()
    const result = typeof (user as any).toObject === 'function' ? (user as any).toObject() : user
    return { ...result, userId: String((user as any)._id), organizationId: (user as any).organizationId || (user as any)._id }
  }
}
