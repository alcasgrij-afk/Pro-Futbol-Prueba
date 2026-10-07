import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearAlumnoDto } from './dto/crear-alumno.dto';
import { ActualizarAlumnoDto } from './dto/actualizar-alumno.dto';
import { sugerirCategoriaPorFechaNacimiento } from './categoria.util';

@Injectable()
export class AlumnosService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearAlumnoDto) {
    const fechaNacimiento = new Date(dto.fechaNacimiento);
    const categoria = dto.categoria?.trim() || sugerirCategoriaPorFechaNacimiento(fechaNacimiento);

    const duplicado = await this.prisma.alumno.findFirst({
      where: {
        nombres: { equals: dto.nombres, mode: 'insensitive' },
        apellidos: { equals: dto.apellidos, mode: 'insensitive' },
      },
    });
    if (duplicado) throw new ConflictException('Ya existe un alumno con este nombre completo.');

    return this.prisma.alumno.create({
      data: {
        nombres: dto.nombres,
        apellidos: dto.apellidos,
        fechaNacimiento,
        categoria,
        encargadoNombre: dto.encargadoNombre,
        encargadoTelefono: dto.encargadoTelefono,
      },
    });
  }

  async listar(filtros: { categoria?: string; activo?: boolean } = {}) {
    return this.prisma.alumno.findMany({
      where: {
        ...(filtros.categoria ? { categoria: filtros.categoria } : {}),
        ...(filtros.activo !== undefined ? { activo: filtros.activo } : {}),
      },
      orderBy: [{ nombres: 'asc' }, { apellidos: 'asc' }],
    });
  }

  async obtenerPorId(alumnoId: string) {
    const alumno = await this.prisma.alumno.findUnique({ where: { id: alumnoId } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado.');
    return alumno;
  }

  async desactivar(alumnoId: string) {
    await this.obtenerPorId(alumnoId);
    return this.prisma.alumno.update({ where: { id: alumnoId }, data: { activo: false } });
  }

  async actualizar(alumnoId: string, dto: ActualizarAlumnoDto) {
    await this.obtenerPorId(alumnoId);
    return this.prisma.alumno.update({
      where: { id: alumnoId },
      data: {
        ...(dto.nombres !== undefined ? { nombres: dto.nombres } : {}),
        ...(dto.apellidos !== undefined ? { apellidos: dto.apellidos } : {}),
        ...(dto.fechaNacimiento !== undefined ? { fechaNacimiento: new Date(dto.fechaNacimiento) } : {}),
        ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
        ...(dto.encargadoNombre !== undefined ? { encargadoNombre: dto.encargadoNombre } : {}),
        ...(dto.encargadoTelefono !== undefined ? { encargadoTelefono: dto.encargadoTelefono } : {}),
      },
    });
  }
}
