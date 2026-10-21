require('reflect-metadata');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Module,ValidationPipe}=require('@nestjs/common');
const {NestFactory}=require('@nestjs/core');
const {JwtModule,JwtService}=require('@nestjs/jwt');
const {PassportModule}=require('@nestjs/passport');
const {ConfigService}=require('@nestjs/config');
const {AuthController}=require('../src/auth/auth.controller');
const {AuthService}=require('../src/auth/auth.service');
const {JwtStrategy}=require('../src/auth/jwt.strategy');
const {ExamsController}=require('../src/exams/exams.controller');
const {ExamsService}=require('../src/exams/exams.service');
const {ExamAiService}=require('../src/exams/services/exam-ai.service');
const {LicensingService}=require('../src/licensing/licensing.service');
const {LicenseGuard}=require('../src/licensing/license.guard');

test('Nest HTTP adapter preserves authentication, DTO validation and exam route behavior',async()=>{
  const config=new ConfigService({JWT_SECRET:'synthetic-http-test-only'});
  const identity={_id:'synthetic-teacher',isActive:true,organizationId:'synthetic-school'};
  const subjects=[{_id:'synthetic-subject',name:'Synthetic mathematics'}];
  const svc={
    getSubjects:async(org)=>{assert.equal(org,identity.organizationId);return subjects;},
    createSubject:async(body,org)=>{assert.equal(org,identity.organizationId);return body;},
  };
  class TestModule {}
  Module({imports:[PassportModule,JwtModule.register({secret:config.get('JWT_SECRET')})],controllers:[AuthController,ExamsController],providers:[
    JwtStrategy,LicenseGuard,
    {provide:ConfigService,useValue:config},
    {provide:AuthService,useValue:{validateById:async()=>identity}},
    {provide:ExamsService,useValue:svc},
    {provide:ExamAiService,useValue:{}},
    {provide:LicensingService,useValue:{}},
  ]})(TestModule);
  const app=await NestFactory.create(TestModule,{logger:false});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
  try {
    await app.listen(0,'127.0.0.1');
    const base=await app.getUrl();
    const unauthenticated=await fetch(base+'/exams/subjects');assert.equal(unauthenticated.status,401);
    const token=app.get(JwtService).sign({sub:identity._id});
    const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
    const response=await fetch(base+'/exams/subjects',{headers});assert.equal(response.status,200);assert.deepEqual(await response.json(),subjects);
    const created=await fetch(base+'/exams/subjects',{method:'POST',headers,body:JSON.stringify({name:'Synthetic science'})});assert.equal(created.status,201);assert.deepEqual(await created.json(),{name:'Synthetic science'});
    const invalid=await fetch(base+'/auth/login',{method:'POST',headers,body:JSON.stringify({email:'invalid',password:'x'})});assert.equal(invalid.status,400);
  } finally {await app.close();}
});
