require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {Reflector} = require('@nestjs/core');
const {ConfigService} = require('@nestjs/config');
const {ValidationPipe} = require('@nestjs/common');
const {RolesGuard, Roles} = require('../src/auth/guards');
const {JwtStrategy} = require('../src/auth/jwt.strategy');
const {AuthService} = require('../src/auth/auth.service');
const {TrackExamEventDto} = require('../src/exams/dtos/exam-analytics.dto');
const {CreateStudentDto} = require('../src/exams/dtos/student-management.dto');
test('class role restrictions reject missing/student identities and allow admin', () => {
  class AdminController {}; Roles('ADMIN')(AdminController);
  const handler=()=>{}; const guard=new RolesGuard(new Reflector());
  for(const role of [undefined,'STUDENT','ADMIN']) {
    const ctx={getHandler:()=>handler,getClass:()=>AdminController,switchToHttp:()=>({getRequest:()=>({user:role?{role}:null})})};
    assert.equal(guard.canActivate(ctx),role==='ADMIN');
  }
});
test('JWT rejects revoked/deleted accounts even when token previously valid', async () => {
  for(const user of [null,{isActive:false},{isActive:true}]) {
    const strategy = new JwtStrategy(new ConfigService({JWT_SECRET:'synthetic-test-only-key'}),{validateById:async()=>user});
    if(user?.isActive) assert.equal((await strategy.validate({sub:'synthetic'})).isActive,true);
    else await assert.rejects(strategy.validate({sub:'synthetic'}),e=>e.getStatus()===401);
  }
});
test('password login never signs a token for unknown or inactive users', async()=>{
  for(const user of [null,{isActive:false}]) {
    const service=new AuthService({findOne:async()=>user},{sign:()=>assert.fail('must not sign')});
    await assert.rejects(service.login('student@example.invalid','synthetic-password'),e=>e.getStatus()===401);
  }
});
test('HTTP validation rejects malformed student and event payloads; strips extra fields',async()=>{
  const pipe=new ValidationPipe({whitelist:true,transform:true});
  await assert.rejects(pipe.transform({fullName:123,className:'Demo',academicYear:'2026-2027'},{type:'body',metatype:CreateStudentDto}));
  await assert.rejects(pipe.transform({sessionId:'demo',eventType:'ADMIN_OVERRIDE'},{type:'body',metatype:TrackExamEventDto}));
  const result=await pipe.transform({sessionId:'demo',eventType:'START',role:'ADMIN'},{type:'body',metatype:TrackExamEventDto});
  assert.equal(result.eventType,'START'); assert.equal(result.role,undefined);
});

test('flashcard access code keeps exactly one sparse unique index',()=>{
  const {FlashcardSetSchema}=require('../src/exams/schemas/flashcard-set.schema');
  const indexes=FlashcardSetSchema.indexes().filter(([fields])=>fields.accessCode===1);
  assert.equal(indexes.length,1);
  assert.equal(indexes[0][1].unique,true);
  assert.equal(indexes[0][1].sparse,true);
});

test('active email/password login signs identity without exposing the password hash',async()=>{
  const bcrypt=require('bcryptjs');
  const password='synthetic-correct-password';
  const user={_id:'synthetic-teacher',email:'teacher@example.invalid',name:'Demo Teacher',role:'ADMIN',organizationId:'synthetic-school',isActive:true,password:await bcrypt.hash(password,4)};
  const service=new AuthService({findOne:async(query)=>{assert.equal(query.email,user.email);return user;}},{sign:(payload)=>{assert.equal(payload.sub,user._id);assert.equal(payload.organizationId,user.organizationId);assert.equal(payload.password,undefined);return 'synthetic-signed-token';}});
  const result=await service.login('TEACHER@EXAMPLE.INVALID',password);
  assert.equal(result.access_token,'synthetic-signed-token');
  assert.equal(result.user.email,user.email);
  assert.equal(result.user.password,undefined);
});
