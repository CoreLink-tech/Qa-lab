import { SetMetadata } from '@nestjs/common';
import { OrganizationRole } from '../../generated/prisma/client';

export const ORG_ROLES_KEY = 'org_roles';

/**
 * Restrict a route to members who hold one of the listed roles
 * in the organization identified by the request (param or body).
 */
export const OrgRoles = (...roles: OrganizationRole[]) =>
  SetMetadata(ORG_ROLES_KEY, roles);
