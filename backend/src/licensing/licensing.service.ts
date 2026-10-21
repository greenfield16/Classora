import { Injectable } from '@nestjs/common'

@Injectable()
export class LicensingService {
  async consumeAiQuota(_organizationId?: string, _amount = 1) {
    return { ok: true }
  }

  async validateOrgLicense(_organizationId?: string, _feature?: string) {
    return { valid: true }
  }
}
