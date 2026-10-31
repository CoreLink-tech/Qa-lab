import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateWebsiteDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: 'Homepage' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'https://example.com' })
  @IsUrl({ require_tld: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url!: string;
}
