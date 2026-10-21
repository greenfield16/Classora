// backend/src/migrate.ts
import { MongoClient, ObjectId } from 'mongodb'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'

dotenv.config()

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault()
  })
}
const db = getFirestore()

const mongoUri = process.env.MONGO_URI_MGMT || process.env.MONGODB_URI || 'mongodb://localhost:27017'
const mongoDbName = process.env.MONGODB_DB || 'greenfield_mgmt'

async function runMigration() {
  console.log('🚀 Starting Greenfield MongoDB to Firestore migration...')
  const client = new MongoClient(mongoUri)
  await client.connect()
  const mongoDb = client.db(mongoDbName)

  // 1. Migrate Subjects
  console.log('⚡ Migrating Subjects...')
  const subjects = await mongoDb.collection('subjects').find({}).toArray()
  for (const subject of subjects) {
    const firestoreId = subject._id.toString()
    await db.collection('subjects').doc(firestoreId).set({
      name: subject.name,
      code: subject.code,
      gradeLevels: subject.gradeLevels || [],
      color: subject.color || '#a3e635',
      isActive: subject.isActive !== false,
      organizationId: subject.organizationId ? subject.organizationId.toString() : null
    })
  }
  console.log(`✅ Migrated ${subjects.length} subjects.`)

  // 2. Migrate Questions
  console.log('⚡ Migrating Questions...')
  const questions = await mongoDb.collection('questions').find({}).toArray()
  for (const q of questions) {
    const firestoreId = q._id.toString()
    await db.collection('questions').doc(firestoreId).set({
      subjectId: q.subjectId ? q.subjectId.toString() : null,
      gradeLevel: Number(q.gradeLevel) || 10,
      type: q.type || 'MULTIPLE_CHOICE',
      content: q.content || '',
      options: q.options || null,
      correctAnswer: q.correctAnswer || null,
      statements: q.statements || null,
      shortAnswer: q.shortAnswer || null,
      difficulty: q.difficulty || 'NHAN_BIET',
      chapter: q.chapter || null,
      topic: q.topic || null,
      tags: q.tags || [],
      usageCount: Number(q.usageCount) || 0,
      isActive: q.isActive !== false,
      createdBy: q.createdBy ? q.createdBy.toString() : null,
      organizationId: q.organizationId ? q.organizationId.toString() : null,
      createdAt: q.createdAt ? new Date(q.createdAt).toISOString() : new Date().toISOString()
    })
  }
  console.log(`✅ Migrated ${questions.length} questions.`)

  // 3. Migrate Exams
  console.log('⚡ Migrating Exams...')
  const exams = await mongoDb.collection('exams').find({}).toArray()
  for (const exam of exams) {
    const firestoreId = exam._id.toString()

    const p1Ids = exam.part1Questions || []
    const p2Ids = exam.part2Questions || []
    const p3Ids = exam.part3Questions || []

    const answerKeyPart1: Record<string, string> = {}
    const answerKeyPart2: Record<string, boolean[]> = {}
    const answerKeyPart3: Record<string, string> = {}

    for (const qid of p1Ids) {
      const q = await mongoDb.collection('questions').findOne({ _id: new ObjectId(qid) })
      if (q) answerKeyPart1[qid.toString()] = q.correctAnswer || ''
    }
    for (const qid of p2Ids) {
      const q = await mongoDb.collection('questions').findOne({ _id: new ObjectId(qid) })
      if (q) answerKeyPart2[qid.toString()] = (q.statements || []).map((s: any) => s.answer === true)
    }
    for (const qid of p3Ids) {
      const q = await mongoDb.collection('questions').findOne({ _id: new ObjectId(qid) })
      if (q) answerKeyPart3[qid.toString()] = q.shortAnswer || ''
    }

    await db.collection('exams').doc(firestoreId).collection('answerKeys').doc('master').set({
      part1: answerKeyPart1,
      part2: answerKeyPart2,
      part3: answerKeyPart3
    })

    await db.collection('exams').doc(firestoreId).set({
      title: exam.title || '',
      subjectId: exam.subjectId ? exam.subjectId.toString() : null,
      gradeLevel: Number(exam.gradeLevel) || 10,
      timeLimit: Number(exam.timeLimit) || 90,
      structure: exam.structure || {},
      variantCount: Number(exam.variantCount) || 4,
      status: exam.status || 'DRAFT',
      accessCode: exam.accessCode || null,
      sessionCount: Number(exam.sessionCount) || 0,
      part1Questions: p1Ids.map((id: any) => id.toString()),
      part2Questions: p2Ids.map((id: any) => id.toString()),
      part3Questions: p3Ids.map((id: any) => id.toString()),
      defaultSchool: exam.defaultSchool || 'GDTX Lê Quí Đôn',
      organizationId: exam.organizationId ? exam.organizationId.toString() : null,
      createdAt: exam.createdAt ? new Date(exam.createdAt).toISOString() : new Date().toISOString(),
      activatedAt: exam.activatedAt ? new Date(exam.activatedAt).toISOString() : null,
      endTime: exam.endTime ? new Date(exam.endTime).toISOString() : null
    })
  }
  console.log(`✅ Migrated ${exams.length} exams.`)

  // 4. Migrate Students
  console.log('⚡ Migrating Students...')
  const students = await mongoDb.collection('students').find({}).toArray()
  for (const student of students) {
    const firestoreId = student._id.toString()
    await db.collection('students').doc(firestoreId).set({
      fullName: student.fullName || '',
      className: student.className || '',
      academicYear: student.academicYear || '',
      school: student.school || 'GDTX Lê Quí Đôn',
      organizationId: student.organizationId ? student.organizationId.toString() : null
    })
  }
  console.log(`✅ Migrated ${students.length} students.`)

  // 5. Migrate Attempts
  console.log('⚡ Migrating Attempts...')
  const sessions = await mongoDb.collection('examsessions').find({ status: 'SUBMITTED' }).toArray()
  for (const session of sessions) {
    const firestoreId = session._id.toString()
    await db.collection('attempts').doc(firestoreId).set({
      user_id: session.studentId ? session.studentId.toString() : 'migrated_user',
      exam_id: session.examId ? session.examId.toString() : '',
      studentInfo: {
        fullName: session.studentInfo?.fullName || '',
        className: session.studentInfo?.className || '',
        school: session.studentInfo?.school || 'GDTX Lê Quí Đôn',
        academicYear: session.studentInfo?.academicYear || '2026-2027'
      },
      answers: session.answers || {},
      score: Number(session.score) || 0,
      scoreBreakdown: session.scoreBreakdown || {},
      submittedAt: session.submittedAt ? Timestamp.fromDate(new Date(session.submittedAt)) : FieldValue.serverTimestamp(),
      totalQuestions: Number(session.totalQuestions) || 0,
      answeredCount: Number(session.answeredCount) || 0,
      unansweredCount: Number(session.unansweredCount) || 0
    })
  }
  console.log(`✅ Migrated ${sessions.length} exam attempts.`)

  await client.close()
  console.log('🎉 MongoDB to Firestore migration completed successfully!')
}

runMigration().catch(console.error)
