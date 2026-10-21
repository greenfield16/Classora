// src/auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, Get, Patch, Req, UseGuards } from '@nestjs/common'
import { JwtAuth } from './guards'
import { AuthService } from './auth.service'
import { IsEmail, IsString, MinLength } from 'class-validator'

class LoginDto {
  @IsEmail() email: string
  @IsString() @MinLength(6) password: string
}

class PasswordDto {
  @IsString() oldPassword: string
  @IsString() @MinLength(12) newPassword: string
}
class UpdateMeDto {
  @IsString() @MinLength(1) name: string
}
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password)
  }
  @Get('me')
  @UseGuards(JwtAuth())
  me(@Req() req: any) { return this.auth.getMe(req.user._id.toString()) }

  @Patch('me')
  @UseGuards(JwtAuth())
  updateMe(@Req() req: any, @Body() body: UpdateMeDto) { return this.auth.updateMe(req.user._id.toString(), body.name) }

  @Post('password')
  @UseGuards(JwtAuth())
  changePassword(@Req() req: any, @Body() body: PasswordDto) {
    return this.auth.changePassword(req.user._id.toString(), body.oldPassword, body.newPassword)
  }
}
