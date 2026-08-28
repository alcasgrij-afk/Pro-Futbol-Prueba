import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorador para restringir un endpoint a ciertos roles.
 * Uso: @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
 */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
