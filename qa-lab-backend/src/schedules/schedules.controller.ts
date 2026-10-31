import {
  Body,
  Controller,
  Delete,
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
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a recurring scan schedule for a website' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedulesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List schedules for a website' })
  @ApiQuery({ name: 'websiteId', required: true })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('websiteId', ParseUUIDPipe) websiteId: string,
  ) {
    return this.schedulesService.listByWebsite(user.id, websiteId);
  }

  @Patch(':scheduleId')
  @ApiOperation({ summary: 'Enable or disable a schedule' })
  setEnabled(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.schedulesService.setEnabled(
      user.id,
      scheduleId,
      Boolean(body.enabled),
    );
  }

  @Delete(':scheduleId')
  @ApiOperation({ summary: 'Delete a schedule' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ) {
    return this.schedulesService.remove(user.id, scheduleId);
  }
}
