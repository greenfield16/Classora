import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common'

export const RequireLicenseFeature = (_feature: 'exams' | 'ai' | 'advancedReports') => SetMetadata('license_feature', _feature)

@Injectable()
export class LicenseGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true
  }
}
