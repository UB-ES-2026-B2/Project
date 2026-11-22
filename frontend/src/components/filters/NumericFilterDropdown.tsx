import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import useSearchParams from '../../hooks/useSearchParams';

export const NUMERIC_PARAMS = ['min_price', 'max_price', 'min_rooms', 'min_surface', 'max_surface'] as const;
export type NumericParam = (typeof NUMERIC_PARAMS)[number];
export type NumericValues = Record<NumericParam, string>;

const LABELS: Record<NumericParam, string> = {
  min_price: 'Precio mínimo (€)',
  max_price: 'Precio máximo (€)',
  min_rooms: 'Habitaciones mínimas',
  min_surface: 'Superficie mínima (m²)',
  max_surface: 'Superficie máxima (m²)',
};

/** Valores de la URL; los que no son números enteros no negativos se ignoran. */
export function readNumericFilters(searchParams: URLSearchParams): Partial<NumericValues> {
  const values: Partial<NumericValues> = {};
  NUMERIC_PARAMS.forEach((name) => {
    const value = searchParams.get(name);
    if (value !== null && /^\d+$/.test(value)) values[name] = value;
  });
  return values;
}

/** Errores de validación en cliente, antes de tocar la URL (US 1.5.2). */
export function validateNumeric(values: NumericValues): Partial<Record<NumericParam, string>> {
  const errors: Partial<Record<NumericParam, string>> = {};
  NUMERIC_PARAMS.forEach((name) => {
    const value = values[name].trim();
    if (value && !/^\d+$/.test(value)) errors[name] = 'Introduce un número entero sin signo.';
  });
  if (Number(values.min_rooms) > 50) errors.min_rooms = 'Como máximo 50 habitaciones.';
  const inverted = (min: NumericParam, max: NumericParam) => (
    !errors[min] && !errors[max] && values[min] && values[max] && Number(values[min]) > Number(values[max])
  );
  if (inverted('min_price', 'max_price')) errors.max_price = 'El máximo tiene que ser mayor o igual que el mínimo.';
  if (inverted('min_surface', 'max_surface')) errors.max_surface = 'El máximo tiene que ser mayor o igual que el mínimo.';
  return errors;
}

const EMPTY: NumericValues = { min_price: '', max_price: '', min_rooms: '', min_surface: '', max_surface: '' };

/** Panel de filtros de precio, habitaciones y superficie. Aplica los valores en la URL. */
function NumericFilterDropdown() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<NumericValues>(EMPTY);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const applied = readNumericFilters(searchParams);
  const appliedCount = Object.keys(applied).length;
  const errors = validateNumeric(values);
  const isValid = Object.keys(errors).length === 0;

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const open = () => {
    setValues({ ...EMPTY, ...readNumericFilters(searchParams) });
    setIsOpen((current) => !current);
  };

  const write = (next: Partial<NumericValues>) => {
    const params = new URLSearchParams(searchParams);
    NUMERIC_PARAMS.forEach((name) => {
      const value = next[name]?.trim();
      if (value) params.set(name, value);
      else params.delete(name);
    });
    setSearchParams(params);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) return;
    write(values);
    setIsOpen(false);
  };

  const clear = () => {
    setValues(EMPTY);
    write({});
    setIsOpen(false);
  };

  return (
    <div className="numeric-filter">
      <button
        type="button"
        className="numeric-filter__trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={open}
      >
        Precio y tamaño{appliedCount > 0 ? ` (${appliedCount})` : ''}
      </button>
      {isOpen && (
        <div id={panelId} ref={panelRef} className="numeric-filter__panel" role="dialog" aria-label="Filtros de precio y tamaño">
          <form onSubmit={handleSubmit} noValidate>
            {NUMERIC_PARAMS.map((name) => (
              <div className="numeric-filter__field" key={name}>
                <label htmlFor={`${panelId}-${name}`}>{LABELS[name]}</label>
                <input
                  id={`${panelId}-${name}`}
                  inputMode="numeric"
                  value={values[name]}
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `${panelId}-${name}-error` : undefined}
                  onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                />
                {errors[name] && (
                  <p id={`${panelId}-${name}-error`} className="numeric-filter__error">{errors[name]}</p>
                )}
              </div>
            ))}
            <div className="numeric-filter__actions">
              <button type="button" onClick={clear}>Limpiar</button>
              <button type="submit" disabled={!isValid}>Aplicar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default NumericFilterDropdown;
