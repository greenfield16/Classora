// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { JwtService } from '@nestjs/jwt'
import { Model } from 'mongoose'
import * as bcrypt from 'bcryptjs'
import { User, UserDocument } from '../schemas'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name, 'mgmt') private userModel: Model<UserDocument>,
    private jwt: JwtService,
  ) { }

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() })
    if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng')
    if (!user.isActive) throw new UnauthorizedException('Tài khoản đã bị khoá')

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng')

    const payload = { sub: user._id, email: user.email, role: user.role, name: user.name, organizationId: (user as any).organizationId }
    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user._id, email: user.email,
        name: user.name, role: user.role,
        organizationId: (user as any).organizationId,
      },
    }
  }

  async validateById(id: string) {
    return this.userModel.findById(id).select('-password')
  }
  async getMe(id: string) {
    const user = await this.userModel.findById(id).select('-password').lean()
    if (!user) throw new UnauthorizedException()
    return { id: user._id, email: user.email, name: user.name, role: user.role }
  }

  async updateMe(id: string, name: string) {
    await this.userModel.updateOne({ _id: id }, { $set: { name: name.trim() } })
    return this.getMe(id)
  }

  async changePassword(id: string, oldPassword: string, newPassword: string) {
    const user = await this.userModel.findById(id)
    if (!user || !await bcrypt.compare(oldPassword, user.password)) throw new UnauthorizedException('Mật khẩu hiện tại không đúng')
    await this.userModel.updateOne({ _id: id }, { $set: { password: await bcrypt.hash(newPassword, 12) } })
    return { success: true }
  }
}
