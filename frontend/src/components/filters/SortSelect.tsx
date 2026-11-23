import type { ChangeEvent } from 'react';
import useSearchParams from '../../hooks/useSearchParams';

export const SORT_PARAM = 'sort';
export const DEFAULT_SORT = 'newest';
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'price_asc', label: 'Precio: de menor a mayor' },
  { value: 'price_desc', label: 'Precio: de mayor a menor' },
  { value: 'area_asc', label: 'Superficie: de menor a mayor' },
  { value: 'area_desc', label: 'Superficie: de mayor a menor' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

/** Lee el orden de la URL; cualquier valor desconocido vuelve al orden por defecto. */
export function readSort(searchParams: URLSearchParams): SortValue {
  const value = searchParams.get(SORT_PARAM);
  return SORT_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_SORT;
}

/** Selector de orden de los resultados (US 1.6). Guarda la elección en `?sort=`. */
function SortSelect() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = readSort(searchParams);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(searchParams);
    if (event.target.value === DEFAULT_SORT) next.delete(SORT_PARAM);
    else next.set(SORT_PARAM, event.target.value);
    setSearchParams(next);
  };

  return (
    <div className="sort-select">
      <label htmlFor="sort-select">Ordenar por</label>
      <select id="sort-select" value={sort} onChange={handleChange}>
        {SORT_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}

export default SortSelect;
