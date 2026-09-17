import { calcularEdad, sugerirCategoria, sugerirCategoriaPorFechaNacimiento } from './categoria.util';

describe('categoria.util', () => {
  describe('calcularEdad', () => {
    it('calcula la edad cumpliendo años en el año', () => {
      expect(calcularEdad(new Date('2016-04-12'), new Date('2026-08-01'))).toBe(10);
    });

    it('resta un año si todavía no cumplió años este año', () => {
      expect(calcularEdad(new Date('2016-04-12'), new Date('2026-03-01'))).toBe(9);
    });
  });

  describe('sugerirCategoria', () => {
    it('Sub-8 para edad <= 7', () => expect(sugerirCategoria(7)).toBe('Sub-8'));
    it('Sub-10 para edad <= 9', () => expect(sugerirCategoria(9)).toBe('Sub-10'));
    it('Sub-12 para edad <= 11', () => expect(sugerirCategoria(10)).toBe('Sub-12'));
    it('Libre / Adultos para edad > 17', () => expect(sugerirCategoria(18)).toBe('Libre / Adultos'));
    it('lanza error para edad negativa', () => expect(() => sugerirCategoria(-1)).toThrow());
  });

  it('sugerirCategoriaPorFechaNacimiento combina ambas', () => {
    expect(sugerirCategoriaPorFechaNacimiento(new Date('2016-04-12'), new Date('2026-08-01'))).toBe('Sub-12');
  });
});
