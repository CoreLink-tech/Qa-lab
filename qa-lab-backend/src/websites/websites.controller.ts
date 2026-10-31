import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateWebsiteDto } from './dto/create-website.dto';
import { UpdateWebsiteDto } from './dto/update-website.dto';
import { WebsitesService } from './websites.service';

@ApiTags('websites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('websites')
export class WebsitesController {
  constructor(private readonly websitesService: WebsitesService) {}

  @Post()
  @ApiOperation({ summary: 'Add a website to a project' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWebsiteDto,
  ) {
    return this.websitesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List websites in a project' })
  @ApiQuery({ name: 'projectId', required: true })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.websitesService.listByProject(user.id, projectId);
  }

  @Get(':websiteId')
  @ApiOperation({ summary: 'Get website details' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
  ) {
    return this.websitesService.getOne(user.id, websiteId);
  }

  @Patch(':websiteId')
  @ApiOperation({ summary: 'Update a website' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body() dto: UpdateWebsiteDto,
  ) {
    return this.websitesService.update(user.id, websiteId, dto);
  }
}
