// src/storage/storage.controller.ts
import { Controller, Post, Body, UseGuards, Logger, Req, BadRequestException } from '@nestjs/common'
import { JwtAuth } from '../auth/guards'
import { randomUUID } from 'node:crypto'
import { StorageService } from './storage.service'

@Controller('storage')
@UseGuards(JwtAuth())
export class StorageController {
  private logger = new Logger(StorageController.name)

  constructor(private svc: StorageService) {}

  // Frontend calls this to get a presigned URL, then uploads directly to R2
  @Post('presign')
  presign(@Body() body: { key: string; contentType: string }, @Req() req: any) {
    const types: Record<string,string> = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' }
    if (!types[body.contentType]) throw new BadRequestException('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP')
    const key = `uploads/${req.user.organizationId}/${randomUUID()}.${types[body.contentType]}`
    return this.svc.getPresignedUrl(key, body.contentType)
  }
}
