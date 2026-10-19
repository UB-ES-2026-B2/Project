import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  countBySpaceType,
  describeResults,
  filterProperties,
  normalizeText,
} from './filterProperties.js';

const properties = [
  { id: 'a', location: 'L’Hospitalet de Llobregat', postalCode: '08901', operation: 'rent', spaceType: 'local' },
  { id: 'b', location: 'Gràcia, Barcelona', postalCode: '08012', operation: 'sale', spaceType: 'piso' },
  { id: 'c', location: 'Centre, Badalona', operation: 'sale', spaceType: 'garaje' },
];

describe('filterProperties', () => {
  it('normalizes accents, case and apostrophes', () => {
    expect(normalizeText('  L’Hospitalet GRÀCIA ')).toBe("l'hospitalet gracia");
  });

  it('returns everything without filters', () => {
    expect(filterProperties(properties, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('combines operation, space type and location (name or postal code)', () => {
    const ids = (filters) => filterProperties(properties, { ...EMPTY_FILTERS, ...filters }).map(({ id }) => id);

    expect(ids({ operation: 'sale' })).toEqual(['b', 'c']);
    expect(ids({ operation: 'sale', spaceType: 'garaje' })).toEqual(['c']);
    expect(ids({ location: 'gracia' })).toEqual(['b']);
    expect(ids({ location: '08901' })).toEqual(['a']);
    expect(ids({ location: 'girona' })).toEqual([]);
  });

  it('describes the results with the active filters', () => {
    expect(describeResults(12, EMPTY_FILTERS)).toBe('12 espacios destacados');
    expect(describeResults(1, EMPTY_FILTERS)).toBe('1 espacio destacado');
    expect(describeResults(12, { operation: 'rent', location: ' Barcelona ', spaceType: 'all' }))
      .toBe('12 espacios en alquiler en Barcelona');
    expect(describeResults(1, { operation: 'sale', location: '', spaceType: 'local' })).toBe('1 local en venta');
    expect(describeResults(2, { operation: null, location: '', spaceType: 'oficina' })).toBe('2 oficinas');
  });

  it('counts listings per space type, including types without listings', () => {
    expect(countBySpaceType(properties)).toEqual({
      piso: 1, casa: 0, local: 1, oficina: 0, garaje: 1, trastero: 0,
    });
  });
});
