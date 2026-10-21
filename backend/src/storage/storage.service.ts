// src/storage/storage.service.ts
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly s3: S3Client
  private readonly bucket: string
  private readonly publicUrl: string

  constructor(private config: ConfigService) {
    this.bucket    = config.get('R2_BUCKET_NAME') || 'itservices-media'
    this.publicUrl = config.get('R2_PUBLIC_URL')  || ''

    // Dùng endpoint trực tiếp từ R2 dashboard
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: config.get('R2_ENDPOINT') ||
        `https://${config.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     config.get('R2_ACCESS_KEY_ID')     || '',
        secretAccessKey: config.get('R2_SECRET_ACCESS_KEY') || '',
      },
    })
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.s3.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
    }))
    return `${this.publicUrl}/${key}`
  }

  async uploadFromUrl(url: string, key: string): Promise<string | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return null
      const buffer      = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      return this.upload(key, buffer, contentType)
    } catch (e) {
      this.logger.warn(`Upload from URL failed [${url}]: ${e.message}`)
      return null
    }
  }

  async getPresignedUrl(key: string, contentType: string, expiresIn = 3600) {
    if (!this.publicUrl || !this.config.get('R2_ACCESS_KEY_ID') || !this.config.get('R2_SECRET_ACCESS_KEY')) throw new ServiceUnavailableException('Image storage is not configured')
    this.logger.log(`📝 [getPresignedUrl] Creating presigned URL for ${key} (${contentType})`)
    const command = new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      ContentType: contentType,
    })
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn })
    this.logger.log(`🎫 [getPresignedUrl] Presigned URL created successfully`)
    return { uploadUrl, publicUrl: `${this.publicUrl}/${key}` }
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}
