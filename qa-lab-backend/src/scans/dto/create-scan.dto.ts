import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateScanDto {
  @ApiProperty({ description: 'Website to scan' })
  @IsUUID()
  websiteId!: string;

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

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  concurrency?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  respectRobotsTxt?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Opt-in passive check for well-known sensitive paths. Authorization-gated.',
  })
  @IsOptional()
  @IsBoolean()
  checkExposedPaths?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  checkAssets?: boolean;
}
