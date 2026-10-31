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
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateScanDto } from './dto/create-scan.dto';
import { ScansService } from './scans.service';

@ApiTags('scans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  @ApiOperation({
    summary: 'Queue a new scan for a website',
    description:
      'Creates a Scan row and enqueues a BullMQ job. The in-process worker runs the QA Lab scanner library with SSRF protection.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScanDto,
  ) {
    return this.scansService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List scans by websiteId or projectId' })
  @ApiQuery({ name: 'websiteId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('websiteId') websiteId?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (websiteId) {
      return this.scansService.listByWebsite(user.id, websiteId);
    }
    if (projectId) {
      return this.scansService.listByProject(user.id, projectId);
    }
    return [];
  }

  @Get(':scanId')
  @ApiOperation({ summary: 'Get scan status and report' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scanId', ParseUUIDPipe) scanId: string,
  ) {
    return this.scansService.getOne(user.id, scanId);
  }

  @Post(':scanId/cancel')
  @ApiOperation({ summary: 'Cancel a queued or running scan' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scanId', ParseUUIDPipe) scanId: string,
  ) {
    return this.scansService.cancel(user.id, scanId);
  }
}
