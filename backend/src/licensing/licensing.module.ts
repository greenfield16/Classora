import { Module } from '@nestjs/common'
import { LicensingService } from './licensing.service'
import { LicenseGuard } from './license.guard'

@Module({
  providers: [LicensingService, LicenseGuard],
  exports: [LicensingService, LicenseGuard],
})
export class LicensingModule {}
