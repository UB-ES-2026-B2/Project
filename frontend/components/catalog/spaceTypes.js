// Catálogo de tipos de espacio y operaciones. Un solo sitio para etiquetas y plurales.

export const SPACE_TYPES = [
  { id: 'piso', label: 'Piso', plural: 'Pisos' },
  { id: 'casa', label: 'Casa', plural: 'Casas' },
  { id: 'local', label: 'Local', plural: 'Locales' },
  { id: 'oficina', label: 'Oficina', plural: 'Oficinas' },
  { id: 'garaje', label: 'Garaje', plural: 'Garajes' },
  { id: 'trastero', label: 'Trastero', plural: 'Trasteros' },
];

export const SPACE_TYPE_LABELS = Object.fromEntries(SPACE_TYPES.map((type) => [type.id, type.label]));

export const OPERATIONS = {
  sale: { tab: 'Comprar', badge: 'En venta', phrase: 'en venta' },
  rent: { tab: 'Alquilar', badge: 'En alquiler', phrase: 'en alquiler' },
};
