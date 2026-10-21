import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuth } from '../auth/guards'
import { CommunityService } from './community.service'

@Controller()
@UseGuards(JwtAuth())
export class TeacherCommunityController {
  constructor(private svc:CommunityService) {}
  @Get('profile') profile(@Req() req:any) { return this.svc.profile(req.user) }
  @Put('profile') saveProfile(@Req() req:any,@Body() body:any) { return this.svc.saveProfile(req.user,body) }
  @Post('feedback') feedback(@Req() req:any,@Body() body:any) { return this.svc.sendFeedback(req.user,body) }
  @Get('skill-exams') list(@Req() req:any) { return this.svc.listTemplates(req.user) }
  @Post('skill-exams') create(@Req() req:any,@Body() body:any) { return this.svc.createTemplate(req.user,body) }
  @Get('skill-exams/:id/submissions') submissions(@Req() req:any,@Param('id') id:string) { return this.svc.listSubmissions(req.user,id) }
  @Get('skill-exams/:id') get(@Req() req:any,@Param('id') id:string) { return this.svc.getTemplate(req.user,id) }
  @Patch('skill-exams/:id') update(@Req() req:any,@Param('id') id:string,@Body() body:any) { return this.svc.updateTemplate(req.user,id,body) }
  @Delete('skill-exams/:id') remove(@Req() req:any,@Param('id') id:string) { return this.svc.deleteTemplate(req.user,id) }
}
@Controller('skill-exams')
export class PublicSkillController {
  constructor(private svc:CommunityService) {}
  @Get('public/:code') get(@Param('code') code:string) { return this.svc.publicTemplate(code) }
  @Post('public/:code/submit') submit(@Param('code') code:string,@Body() body:any) { return this.svc.submit(code,body) }
  @Post('public/templates/:id/recordings')
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:20*1024*1024}}))
  upload(@Param('id') id:string,@Body('questionId') questionId:string,@UploadedFile() file:any) { return this.svc.uploadRecording(id,questionId,file) }
  @Get('recordings/:token')
  async recording(@Param('token') token:string,@Res() res:any) {
    const file=await this.svc.recording(token)
    res.setHeader('Content-Type',file.mimeType);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, no-store')
    return res.sendFile(file.path)
  }
}
