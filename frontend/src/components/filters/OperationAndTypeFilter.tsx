import { useEffect, useId, useRef, useState } from 'react';
import useSearchParams from '../../hooks/useSearchParams';

export type PropertyFilters = {
  operationType: 'sale' | 'rent' | null;
  propertyTypes: string[];
};

type OperationAndTypeFilterProps = {
  onChange?: (filters: PropertyFilters) => void;
};

const OPERATIONS = [
  { value: 'sale' as const, label: 'Compra' },
  { value: 'rent' as const, label: 'Alquiler' },
];

const PROPERTY_TYPES = [
  { value: 'flat', label: 'Piso' },
  { value: 'house', label: 'Casa' },
  { value: 'local', label: 'Local' },
  { value: 'office', label: 'Oficina' },
  { value: 'garage', label: 'Garaje' },
  { value: 'storage', label: 'Trastero' },
];

export const OPERATION_PARAM = 'operation_type';
export const PROPERTY_TYPES_PARAM = 'property_types';

function OperationAndTypeFilter({ onChange }: OperationAndTypeFilterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  const operationValue = searchParams.get(OPERATION_PARAM);
  const operationType = operationValue === 'sale' || operationValue === 'rent'
    ? operationValue
    : null;
  const propertyTypes = PROPERTY_TYPES
    .map(({ value }) => value)
    .filter((value) => searchParams.getAll(PROPERTY_TYPES_PARAM).includes(value));

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)
        && !triggerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const notifyChange = (filters: PropertyFilters) => onChange?.(filters);

  const setOperation = (operation: 'sale' | 'rent') => {
    const next = new URLSearchParams(searchParams);
    next.set(OPERATION_PARAM, operation);
    setSearchParams(next);
    notifyChange({ operationType: operation, propertyTypes });
  };

  const togglePropertyType = (propertyType: string) => {
    const nextTypes = propertyTypes.includes(propertyType)
      ? propertyTypes.filter((value) => value !== propertyType)
      : [...propertyTypes, propertyType];
    const next = new URLSearchParams(searchParams);
    next.delete(PROPERTY_TYPES_PARAM);
    nextTypes.forEach((value) => next.append(PROPERTY_TYPES_PARAM, value));
    setSearchParams(next);
    notifyChange({ operationType, propertyTypes: nextTypes });
  };

  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete(OPERATION_PARAM);
    next.delete(PROPERTY_TYPES_PARAM);
    setSearchParams(next);
    notifyChange({ operationType: null, propertyTypes: [] });
  };

  return (
    <div className="operation-type-filter">
      <div className="operation-type-filter__tabs" role="tablist" aria-label="Tipo de operación">
        {OPERATIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={operationType === value}
            className={operationType === value ? 'is-active' : ''}
            onClick={() => setOperation(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="operation-type-filter__popover-wrap" ref={popoverRef}>
        <button
          ref={triggerRef}
          className="operation-type-filter__trigger"
          type="button"
          aria-expanded={isOpen}
          aria-controls={popoverId}
          onClick={() => setIsOpen((open) => !open)}
        >
          Tipo de inmueble{propertyTypes.length > 0 ? ` (${propertyTypes.length})` : ''}
        </button>
        {isOpen && (
          <div
            id={popoverId}
            className="operation-type-filter__popover"
            role="dialog"
            aria-label="Seleccionar tipos de inmueble"
          >
            <fieldset>
              <legend>Tipo de inmueble</legend>
              {PROPERTY_TYPES.map(({ value, label }) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={propertyTypes.includes(value)}
                    onChange={() => togglePropertyType(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <button
              className="operation-type-filter__reset"
              type="button"
              onClick={resetFilters}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OperationAndTypeFilter;
