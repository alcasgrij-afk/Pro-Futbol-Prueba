/**
 * Calculo de edad y sugerencia de categoria por edad. Funcion pura para
 * poder testearla sin base de datos ni reloj real (se recibe la fecha de
 * referencia como parametro en vez de usar `new Date()` internamente).
 *
 * Las categorias son las convencionales de ligas formativas juveniles.
 * Es una SUGERENCIA: el admin puede editar la categoria libremente al
 * registrar al alumno (ver AlumnosService.crear) si el negocio agrupa
 * distinto (por ejemplo, por nivel en vez de por edad).
 */

const CATEGORIAS: { edadMaxima: number; categoria: string }[] = [
  { edadMaxima: 7, categoria: 'Sub-8' },
  { edadMaxima: 9, categoria: 'Sub-10' },
  { edadMaxima: 11, categoria: 'Sub-12' },
  { edadMaxima: 13, categoria: 'Sub-14' },
  { edadMaxima: 15, categoria: 'Sub-16' },
  { edadMaxima: 17, categoria: 'Sub-18' },
];
const CATEGORIA_ADULTOS = 'Libre / Adultos';

export function calcularEdad(fechaNacimiento: Date, fechaReferencia: Date = new Date()): number {
  let edad = fechaReferencia.getFullYear() - fechaNacimiento.getFullYear();
  const noHaCumplidoAnosEsteAnio =
    fechaReferencia.getMonth() < fechaNacimiento.getMonth() ||
    (fechaReferencia.getMonth() === fechaNacimiento.getMonth() &&
      fechaReferencia.getDate() < fechaNacimiento.getDate());
  if (noHaCumplidoAnosEsteAnio) edad--;
  return edad;
}

export function sugerirCategoria(edad: number): string {
  if (edad < 0) throw new Error('La edad no puede ser negativa.');
  const encontrada = CATEGORIAS.find((c) => edad <= c.edadMaxima);
  return encontrada ? encontrada.categoria : CATEGORIA_ADULTOS;
}

export function sugerirCategoriaPorFechaNacimiento(
  fechaNacimiento: Date,
  fechaReferencia: Date = new Date(),
): string {
  return sugerirCategoria(calcularEdad(fechaNacimiento, fechaReferencia));
}
