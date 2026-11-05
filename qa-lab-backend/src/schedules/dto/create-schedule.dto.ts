import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty()
  @IsUUID()
  websiteId!: string;

  @ApiPropertyOptional({
    default: 24,
    description: 'Hours between scans (1–168)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  intervalHours?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxPages?: number;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxDepth?: number;
}
