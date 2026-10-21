// src/storage/storage.controller.ts
import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { StorageService } from './storage.service'

@Controller('storage')
@UseGuards(AuthGuard('jwt'))
export class StorageController {
  private logger = new Logger(StorageController.name)

  constructor(private svc: StorageService) {}

  // Frontend calls this to get a presigned URL, then uploads directly to R2
  @Post('presign')
  presign(@Body() body: { key: string; contentType: string }) {
    this.logger.log(`🔐 [presign] Requesting signed URL for: ${body.key}`)
    const result = this.svc.getPresignedUrl(body.key, body.contentType)
    this.logger.log(`✅ [presign] Generated presigned URL`)
    return result
  }
}
