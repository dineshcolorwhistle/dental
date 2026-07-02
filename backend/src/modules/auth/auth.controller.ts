import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, ResetPasswordDto } from './dto';
import { Public, CurrentUser } from '../../common/decorators';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh tokens' })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('tenant-limits')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current tenant user limits and counts' })
  async getTenantLimits(@CurrentUser('tenantId') tenantId: string | null) {
    return this.authService.getTenantLimits(tenantId);
  }

  @Post('tenant-limits/request')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a limit upgrade for the current tenant' })
  async requestLimitUpgrade(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body('message') message: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.authService.requestLimitUpgrade(tenantId, userId, message);
  }

  @Patch('language')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user language preference' })
  async updateLanguage(
    @CurrentUser('id') userId: string,
    @Body('language') language: 'EN' | 'ES',
  ) {
    if (!language || !['EN', 'ES'].includes(language)) {
      throw new BadRequestException('Language must be EN or ES.');
    }
    return this.authService.updateLanguage(userId, language);
  }
}

