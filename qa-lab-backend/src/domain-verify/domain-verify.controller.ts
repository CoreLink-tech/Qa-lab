import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DomainVerifyService } from './domain-verify.service';

@ApiTags('domain-verify')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('websites')
export class DomainVerifyController {
  constructor(private readonly domainVerify: DomainVerifyService) {}

  @Post(':websiteId/verify/start')
  @ApiOperation({ summary: 'Start domain ownership verification' })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
  ) {
    return this.domainVerify.startVerification(user.id, websiteId);
  }

  @Post(':websiteId/verify/confirm')
  @ApiOperation({ summary: 'Confirm domain ownership (DNS TXT or well-known)' })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
  ) {
    return this.domainVerify.verify(user.id, websiteId);
  }
}
