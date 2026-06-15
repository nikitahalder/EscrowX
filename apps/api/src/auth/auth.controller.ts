import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChallengeDto, VerifySignatureDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('challenge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a challenge nonce for wallet signature' })
  getChallenge(@Body() dto: ChallengeDto) {
    return this.authService.getChallenge(dto);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify wallet signature and get JWT' })
  verify(@Body() dto: VerifySignatureDto) {
    return this.authService.verifySignature(dto);
  }
}
