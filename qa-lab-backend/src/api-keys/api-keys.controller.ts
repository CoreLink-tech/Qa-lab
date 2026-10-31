import {
  Body,
  Controller,
  Delete,
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
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an API key (raw value returned once)',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List active API keys for an organization' })
  @ApiQuery({ name: 'organizationId', required: true })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.apiKeysService.list(user.id, organizationId);
  }

  @Delete(':keyId')
  @ApiOperation({ summary: 'Revoke an API key' })
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ) {
    return this.apiKeysService.revoke(user.id, keyId);
  }
}
