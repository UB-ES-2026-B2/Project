import { OPERATIONS, SPACE_TYPES } from './spaceTypes.js';

// Filtrado en el navegador mientras no haya backend.

export const EMPTY_FILTERS = { operation: null, location: '', spaceType: 'all' };

/** Minúsculas, sin acentos y con un solo tipo de apóstrofo: "L’Hospitalet" == "l'hospitalet". */
export function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .toLowerCase()
    .trim();
}

export function hasActiveFilters(filters) {
  return Boolean(filters.operation || filters.location.trim() || filters.spaceType !== 'all');
}

export function filterProperties(properties, filters) {
  const query = normalizeText(filters.location);

  return properties.filter((property) => {
    if (filters.operation && property.operation !== filters.operation) return false;
    if (filters.spaceType !== 'all' && property.spaceType !== filters.spaceType) return false;
    if (!query) return true;
    return normalizeText(`${property.location} ${property.postalCode ?? ''}`).includes(query);
  });
}

/** Título de la cuadrícula: "12 espacios en alquiler en Barcelona", "1 garaje en venta"… */
export function describeResults(count, filters) {
  if (!hasActiveFilters(filters)) {
    return `${count} ${count === 1 ? 'espacio destacado' : 'espacios destacados'}`;
  }

  const type = SPACE_TYPES.find(({ id }) => id === filters.spaceType);
  const noun = type
    ? (count === 1 ? type.label : type.plural).toLowerCase()
    : (count === 1 ? 'espacio' : 'espacios');
  const parts = [`${count} ${noun}`];
  if (filters.operation) parts.push(OPERATIONS[filters.operation].phrase);
  if (filters.location.trim()) parts.push(`en ${filters.location.trim()}`);
  return parts.join(' ');
}

export function countBySpaceType(properties) {
  return Object.fromEntries(
    SPACE_TYPES.map(({ id }) => [id, properties.filter((property) => property.spaceType === id).length]),
  );
}
