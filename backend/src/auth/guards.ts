// src/auth/guards.ts
import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'

export const JwtAuth = () => AuthGuard('jwt')

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
