import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { RequireScopes } from '../auth/decorators/require-scopes.decorator';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { CreateScanDto } from './dto/create-scan.dto';
import { ScansService } from './scans.service';

@ApiTags('scans')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-API-Key',
  required: false,
  description: 'API key (qalab_…). Alternative to Bearer JWT or Bearer qalab_…',
})
@UseGuards(JwtOrApiKeyGuard, ScopesGuard)
@Controller('scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  @RequireScopes('scans:write')
  @ApiOperation({
    summary: 'Queue a new scan for a website',
    description:
      'JWT user or API key with scans:write. API keys are limited to websites in their organization.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScanDto,
  ) {
    return this.scansService.createForPrincipal(user, dto);
  }

  @Get()
  @RequireScopes('scans:read')
  @ApiOperation({ summary: 'List scans for a website or project' })
  @ApiQuery({ name: 'websiteId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('websiteId') websiteId?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (websiteId) {
      return this.scansService.listByWebsiteForPrincipal(user, websiteId);
    }
    if (projectId) {
      return this.scansService.listByProject(user.userId || user.id, projectId);
    }
    return [];
  }

  @Get(':scanId')
  @RequireScopes('scans:read')
  @ApiOperation({ summary: 'Get scan detail including report' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scanId', ParseUUIDPipe) scanId: string,
  ) {
    return this.scansService.getByIdForPrincipal(user, scanId);
  }

  @Post(':scanId/cancel')
  @RequireScopes('scans:write')
  @ApiOperation({ summary: 'Cancel a queued or running scan' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scanId', ParseUUIDPipe) scanId: string,
  ) {
    return this.scansService.cancel(user.userId || user.id, scanId);
  }
}
