// src/auth/guards.ts
import { Injectable, CanActivate, ExecutionContext, SetMetadata, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'

@Injectable()
export class TeacherJwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) throw err || new UnauthorizedException()
    if (!['SUPER_ADMIN', 'ADMIN', 'TEACHER'].includes(user.role)) throw new ForbiddenException('Teacher access required')
    return user
  }
}
export const JwtAuth = () => TeacherJwtGuard

// Roles guard
export const Roles = (...roles: string[]) => SetMetadata('roles', roles)

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('roles', [ctx.getHandler(), ctx.getClass()])
    if (!required?.length) return true
    const { user } = ctx.switchToHttp().getRequest()
    return required.includes(user?.role)
  }
}
