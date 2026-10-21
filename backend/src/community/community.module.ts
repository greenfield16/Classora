import { Module } from '@nestjs/common'
import { CommunityService } from './community.service'
import { TeacherCommunityController, PublicSkillController } from './community.controller'
import { AiController } from '../ai/ai.controller'
@Module({providers:[CommunityService],controllers:[TeacherCommunityController,PublicSkillController,AiController]})
export class CommunityModule {}
