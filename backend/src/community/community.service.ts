import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Connection, Schema, Types } from 'mongoose'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

const text = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : ''
const id = (value: string) => { if (!Types.ObjectId.isValid(value)) throw new BadRequestException('Invalid ID'); return new Types.ObjectId(value) }
const model = (db: Connection, name: string, collection: string, fields: any) => db.models[name] || db.model(name, new Schema(fields, { timestamps: true, collection }))
const serialize = (doc: any) => ({ ...doc, id: String(doc._id), ownerId: String(doc.ownerId) })

@Injectable()
export class CommunityService {
  private profiles: any
  private feedback: any
  private templates: any
  private submissions: any
  private recordings: any
  readonly recordingRoot = resolve(process.env.UPLOAD_DIR || './uploads', 'recordings')
  constructor(@InjectConnection('mgmt') db: Connection) {
    this.profiles = model(db, 'TeacherProfile', 'teacher_profiles', { ownerId: {type: Schema.Types.ObjectId, unique:true}, fullName: String, phone: String, position: String, subjectSpecialization: String, workplaces: [String], defaultWorkplace: String, gradeLevels: [Number], bio: String })
    this.feedback = model(db, 'TeacherFeedback', 'teacher_feedback', { ownerId: Schema.Types.ObjectId, type: String, priority: String, title: String, message: String, contactBack: Boolean, page: String, status: String })
    this.templates = model(db, 'SkillExamTemplate', 'skill_exam_templates', {ownerId: {type: Schema.Types.ObjectId,index:true}, title:String, subject:String, gradeLevel:Number, durationMinutes:Number, instructions:String, inviteEmails:[String], sections:[Schema.Types.Mixed], status:String, accessCode:{type:String,unique:true}})
    this.submissions = model(db, 'SkillExamSubmission', 'skill_exam_submissions', {ownerId: {type:Schema.Types.ObjectId,index:true}, templateId: Schema.Types.ObjectId, accessCode:String, student:Schema.Types.Mixed, answers:Schema.Types.Mixed, recordings:Schema.Types.Mixed, submittedAt:Date})
    this.recordings = model(db, 'SkillRecording', 'skill_recordings', {templateId:Schema.Types.ObjectId,questionId:String,token:{type:String,unique:true},mimeType:String,size:Number})
  }
  async profile(user: any) {
    const p = await this.profiles.findOne({ ownerId:user._id }).lean() || {}
    return { uid:String(user._id), email:user.email, fullName:p.fullName || user.name, phone:p.phone || '', position:p.position || '', subjectSpecialization:p.subjectSpecialization || '', workplaces:p.workplaces || [], defaultWorkplace:p.defaultWorkplace || '', gradeLevels:p.gradeLevels?.length?p.gradeLevels:[10,11,12], bio:p.bio || '', updatedAt:p.updatedAt }
  }
  async saveProfile(user: any, input: any) {
    const workplaces = [...new Set((Array.isArray(input.workplaces)?input.workplaces:[]).map((v:any)=>text(v)).filter(Boolean))].slice(0,30)
    const fullName = text(input.fullName,150)
    if (!fullName) throw new BadRequestException('Nhập họ tên')
    await this.profiles.findOneAndUpdate({ownerId:user._id}, {$set:{fullName,phone:text(input.phone),position:text(input.position),subjectSpecialization:text(input.subjectSpecialization),workplaces,defaultWorkplace:workplaces.includes(input.defaultWorkplace)?input.defaultWorkplace:workplaces[0] || '',gradeLevels:(Array.isArray(input.gradeLevels)?input.gradeLevels:[]).filter((n:any)=>[10,11,12].includes(n)),bio:text(input.bio,3000)}},{upsert:true})
    return this.profile(user)
  }
  async sendFeedback(user: any, input: any) {
    const title=text(input.title,200), message=text(input.message,10000)
    if (!title || !message) throw new BadRequestException('Thiếu tiêu đề hoặc nội dung')
    return this.feedback.create({ownerId:user._id,title,message,type:['BUG','FEATURE','CONTENT','UX','OTHER'].includes(input.type)?input.type:'OTHER',priority:['LOW','NORMAL','HIGH'].includes(input.priority)?input.priority:'NORMAL',contactBack:input.contactBack===true,page:text(input.page,1000),status:'NEW'})
  }
  private templateInput(input: any, partial = false) {
    const result: any = {}
    for (const key of ['title','subject','instructions']) if (input[key] !== undefined) result[key]=text(input[key],key==='instructions'?10000:200)
    for (const key of ['gradeLevel','durationMinutes']) if (input[key] !== undefined) { const n=Number(input[key]); if(!Number.isInteger(n)||n<1||n>(key==='durationMinutes'?1440:12)) throw new BadRequestException('Invalid '+key);result[key]=n }
    if (input.status !== undefined) { if (!['DRAFT','PUBLISHED','CLOSED'].includes(input.status)) throw new BadRequestException('Invalid status'); result.status=input.status }
    if(input.inviteEmails!==undefined) result.inviteEmails=(Array.isArray(input.inviteEmails)?input.inviteEmails:[]).slice(0,500).map((v:any)=>text(v,254))
    if(input.sections!==undefined) {
      if(!Array.isArray(input.sections)||input.sections.length>50) throw new BadRequestException('Invalid sections')
      const questionIds=new Set<string>()
      result.sections=input.sections.map((s:any)=>{
        if(!s || !['READING','LISTENING','WRITING','QUIZ'].includes(s.skill)||!Array.isArray(s.questions)||s.questions.length>200) throw new BadRequestException('Invalid section')
        return {id:text(s.id,100),skill:s.skill,title:text(s.title),instructions:text(s.instructions,10000),content:text(s.content,100000),questions:s.questions.map((q:any)=>{
          const qid=text(q?.id,100), points=Number(q?.points)
          if(!qid || !/^[A-Za-z0-9_-]+$/.test(qid) || ['__proto__','constructor','prototype'].includes(qid) || questionIds.has(qid)||!Number.isFinite(points)||points<0||points>100) throw new BadRequestException('Invalid question')
          questionIds.add(qid)
          const options=Array.isArray(q.options)?q.options.slice(0,20).map((v:any)=>text(v,10000)):undefined
          const correctOption=q.correctOption
          if(correctOption!==undefined && (!Number.isInteger(correctOption)||!options||correctOption<0||correctOption>=options.length)) throw new BadRequestException('Invalid correct option')
          return {id:qid,prompt:text(q.prompt,10000),points,options,correctOption,requiresRecording:q.requiresRecording===true}
        })}
      })
    }
    if (!partial && (!result.title || !result.sections?.length)) throw new BadRequestException('Thiếu tên đề hoặc phần thi')
    return result
  }
  async listTemplates(user: any) { return (await this.templates.find({ownerId:user._id}).sort({updatedAt:-1}).lean()).map(serialize) }
  async createTemplate(user: any, input: any) { const data=this.templateInput(input); return serialize((await this.templates.create({...data,ownerId:user._id,status:'DRAFT',accessCode:randomBytes(8).toString('hex').toUpperCase()})).toObject()) }
  async getTemplate(user: any, templateId: string) { const doc=await this.templates.findOne({_id:id(templateId),ownerId:user._id}).lean();if(!doc) throw new NotFoundException();return serialize(doc) }
  async updateTemplate(user: any, templateId: string, input: any) { const doc=await this.templates.findOneAndUpdate({_id:id(templateId),ownerId:user._id},{$set:this.templateInput(input,true)},{new:true,runValidators:true}).lean();if(!doc) throw new NotFoundException();return serialize(doc) }
  async deleteTemplate(user: any, templateId: string) { const result=await this.templates.deleteOne({_id:id(templateId),ownerId:user._id});if(!result.deletedCount) throw new NotFoundException();return {success:true} }
  async publicTemplate(code: string) {
    const doc=await this.templates.findOne({accessCode:code,status:'PUBLISHED'}).lean();if(!doc) throw new NotFoundException('Đề thi không tồn tại hoặc chưa mở')
    const out=serialize(doc);delete out.inviteEmails
    out.sections=out.sections.map((s:any)=>({...s,questions:s.questions.map(({correctOption,...q}:any)=>q)}))
    return out
  }
  async submit(code: string, input: any) {
    const t=await this.templates.findOne({accessCode:code,status:'PUBLISHED'}).lean();if(!t) throw new NotFoundException()
    const student={fullName:text(input.student?.fullName,150),className:text(input.student?.className,100),email:text(input.student?.email,254)}
    if(!student.fullName||!student.className) throw new BadRequestException('Thiếu họ tên hoặc lớp')
    const answers:any={}, recordings:any={}
    for(const q of t.sections.flatMap((s:any)=>s.questions)) {
      const value=input.answers?.[q.id]
      if(typeof value==='string') answers[q.id]=text(value,20000)
      else if(typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<(q.options?.length||0)) answers[q.id]=value
      const recording=input.recordings?.[q.id]
      if(recording) {
        const token=String(recording.url||'').split('/').pop()
        const r=await this.recordings.findOne({token,templateId:t._id,questionId:q.id}).lean()
        if(!r) throw new BadRequestException('Invalid recording')
        recordings[q.id]={url:`/skill-exams/recordings/${r.token}`,durationSeconds:Math.max(0,Math.min(7200,Number(recording.durationSeconds)||0))}
      }
    }
    const doc=await this.submissions.create({templateId:t._id,ownerId:t.ownerId,accessCode:t.accessCode,student,answers,recordings,submittedAt:new Date()})
    return {id:String(doc._id)}
  }
  async listSubmissions(user:any, templateId:string) { await this.getTemplate(user,templateId);return (await this.submissions.find({templateId:id(templateId),ownerId:user._id}).sort({submittedAt:-1}).lean()).map(serialize) }
  async uploadRecording(templateId:string, questionId:string, file:any) {
    const t=await this.templates.findOne({_id:id(templateId),status:'PUBLISHED'}).lean()
    if(!t || !t.sections.some((s:any)=>s.questions.some((q:any)=>q.id===questionId&&q.requiresRecording))) throw new BadRequestException('Invalid recording question')
    const mimeType=String(file?.mimetype||'').split(';')[0]
    if(!file?.buffer || !['audio/webm','audio/ogg','audio/mp4','video/webm'].includes(mimeType)) throw new BadRequestException('Unsupported recording')
    const token=randomUUID();await mkdir(this.recordingRoot,{recursive:true});await writeFile(resolve(this.recordingRoot,token),file.buffer,{flag:'wx'})
    try { await this.recordings.create({templateId:t._id,questionId,token,mimeType,size:file.buffer.length}) }
    catch(err) { await unlink(resolve(this.recordingRoot,token));throw err }
    return {url:`/skill-exams/recordings/${token}`}
  }
  async recording(token:string) {
    if(!/^[a-f0-9-]{36}$/.test(token)) throw new NotFoundException()
    const doc=await this.recordings.findOne({token}).lean();if(!doc) throw new NotFoundException();return {path:resolve(this.recordingRoot,token),mimeType:doc.mimeType}
  }
}
