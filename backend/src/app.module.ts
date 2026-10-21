import { CommunityModule } from './community/community.module'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { AuthModule } from './auth/auth.module'
import { ExamsModule } from './exams/exams.module'
import { StorageModule } from './storage/storage.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      connectionName: 'mgmt',
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get<string>('MONGODB_URI') || '',
        dbName: cfg.get<string>('MONGODB_DB') || 'classora',
      }),
    }),
    CommunityModule,
    AuthModule,
    StorageModule,
    ExamsModule,
  ],
})
export class AppModule {}
