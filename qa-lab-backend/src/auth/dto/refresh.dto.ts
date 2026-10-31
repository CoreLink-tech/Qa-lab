import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Refresh token issued at login or previous refresh',
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  refreshToken?: string;
}
