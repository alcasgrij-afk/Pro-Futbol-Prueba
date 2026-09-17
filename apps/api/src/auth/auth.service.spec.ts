import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
import * as bcrypt from 'bcrypt';

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks(); // aisla el historial de llamadas entre tests
    prisma = {
      usuario: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'u1',
          passwordHash: '$2b$10$hashActual',
        }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
    };
    service = new AuthService(prisma, new JwtService({}), new ConfigService());
  });

  describe('cambiarPassword', () => {
    it('actualiza el hash cuando la contrasena actual es correcta', async () => {
      bcryptMock.compare.mockResolvedValue(true as never);
      bcryptMock.hash.mockResolvedValue('$2b$10$nuevoHash' as never);

      const resultado = await service.cambiarPassword('u1', 'actual', 'nuevaSegura123');

      expect(resultado.mensaje).toContain('actualizada');
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: '$2b$10$nuevoHash' },
      });
    });

    it('rechaza cuando la contrasena actual no coincide', async () => {
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(service.cambiarPassword('u1', 'incorrecta', 'nuevaSegura123')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
  });

  describe('login (bloqueo de cuenta - PENDIENTES 3.1)', () => {
    const usuarioBase = {
      id: 'u1',
      email: 'admin@profutbolantigua.com',
      rol: 'ADMIN',
      activo: true,
      passwordHash: '$2b$10$hash',
      intentosFallidos: 0,
      bloqueadoHasta: null as Date | null,
    };

    it('bloquea la cuenta al 5to fallo consecutivo', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ ...usuarioBase });
      bcryptMock.compare.mockResolvedValue(false as never);
      // El update del incremento devuelve el contador actualizado.
      prisma.usuario.update.mockResolvedValueOnce({ intentosFallidos: 5 });

      await expect(service.login('admin@profutbolantigua.com', 'mala')).rejects.toThrow(
        'Correo o contrasena incorrectos.',
      );
      // 2do update: fija bloqueadoHasta.
      expect(prisma.usuario.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bloqueadoHasta: expect.any(Date) }),
        }),
      );
    });

    it('rechaza sin verificar hash cuando la cuenta esta bloqueada', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioBase,
        bloqueadoHasta: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(service.login('admin@profutbolantigua.com', 'cualquiera')).rejects.toThrow(
        'temporalmente bloqueada',
      );
      expect(bcryptMock.compare).not.toHaveBeenCalled();
    });

    it('limpia contadores al iniciar sesion con exito', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ ...usuarioBase, intentosFallidos: 3 });
      bcryptMock.compare.mockResolvedValue(true as never);

      await expect(service.login('admin@profutbolantigua.com', 'buena')).resolves.toBeDefined();
      expect(prisma.usuario.update).toHaveBeenLastCalledWith({
        where: { id: 'u1' },
        data: { intentosFallidos: 0, bloqueadoHasta: null },
      });
    });
  });
});
