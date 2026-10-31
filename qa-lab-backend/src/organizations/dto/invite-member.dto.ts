import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsUUID } from 'class-validator';
import { OrganizationRole } from '../../generated/prisma/client';

export class InviteMemberDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;

  @ApiProperty({ example: 'teammate@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['ADMIN', 'MEMBER', 'VIEWER'] })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
