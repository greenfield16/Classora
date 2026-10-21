import mongoose from 'mongoose'
import * as bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '../.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const uri = process.env.MONGO_URI_MGMT || process.env.MONGODB_URI_MGMT || process.env.MONGODB_URI
if (!uri) {
  console.error('Missing MONGODB_URI')
  process.exit(1)
}

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true, trim: true },
  password: String,
  name: String,
  role: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'users' })

async function seed() {
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_MGMT || process.env.MONGODB_DB || 'greenfield_mgmt',
  })

  const User = mongoose.model('User', UserSchema)
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password || password.length < 16) {
    await mongoose.disconnect()
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 16 characters) explicitly')
  }

  const existing = await User.findOne({ email })
  if (!existing) {
    await User.create({
      email,
      password: await bcrypt.hash(password, 12),
      name: 'Administrator',
      role: 'SUPER_ADMIN',
      isActive: true,
    })
    console.log(`Admin created: ${email}`)
  } else {
    console.log(`Admin already exists: ${email}`)
  }

  await mongoose.disconnect()
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
