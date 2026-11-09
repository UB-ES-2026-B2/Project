import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import useDebouncedValue, { DEFAULT_DEBOUNCE_MS } from '../../hooks/useDebouncedValue';
import useSearchParams from '../../hooks/useSearchParams';
import EmptyState from './EmptyState';

export type LocationSuggestion = {
  id: string;
  name: string;
  type: 'city' | 'neighborhood' | 'postal_code';
};

type LocationSearchBarProps = {
  onLocationChange?: (location: LocationSuggestion | null) => void;
};

type SuggestResult = {
  query: string;
  items: LocationSuggestion[];
  failed: boolean;
};

export const MIN_QUERY_LENGTH = 2;
export const LOCATION_PARAM = 'location';

const TYPE_LABELS: Record<LocationSuggestion['type'], string> = {
  city: 'Ciudad',
  neighborhood: 'Barrio',
  postal_code: 'Código postal',
};

function LocationSearchBar({ onLocationChange }: LocationSearchBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialLocation] = useState(() => searchParams.get(LOCATION_PARAM) ?? '');
  const [query, setQuery] = useState(initialLocation);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [result, setResult] = useState<SuggestResult | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim(), DEFAULT_DEBOUNCE_MS);
  const inputRef = useRef<HTMLInputElement>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const resolvedInitialLocation = useRef(false);
  const listboxId = useId();

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  });

  const shouldSearch = debouncedQuery.length >= MIN_QUERY_LENGTH
    && query.trim().length >= MIN_QUERY_LENGTH
    && debouncedQuery !== selectedName;

  useEffect(() => {
    if (!shouldSearch) return undefined;
    const controller = new AbortController();

    fetch(`/api/v1/locations/suggest?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('No se pudieron cargar las sugerencias');
        return response.json();
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error('La respuesta de sugerencias no es válida');
        const items = data.filter(isLocationSuggestion);
        setResult({ query: debouncedQuery, items, failed: false });

        if (!resolvedInitialLocation.current && initialLocation
          && debouncedQuery.toLowerCase() === initialLocation.toLowerCase()) {
          resolvedInitialLocation.current = true;
          const match = items.find((item) => item.name.toLowerCase() === initialLocation.toLowerCase());
          if (match) {
            setQuery(match.name);
            setSelectedName(match.name);
            onLocationChangeRef.current?.(match);
          }
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setResult({ query: debouncedQuery, items: [], failed: true });
      });

    return () => controller.abort();
  }, [debouncedQuery, shouldSearch, initialLocation]);

  const isLoading = shouldSearch && result?.query !== debouncedQuery;
  const hasFailed = shouldSearch && !isLoading && Boolean(result?.failed);
  const suggestions = shouldSearch && !isLoading && result ? result.items : [];
  const showPopup = (isOpen || Boolean(initialLocation)) && shouldSearch;
  const showListbox = showPopup && suggestions.length > 0;
  const currentIndex = activeIndex < suggestions.length ? activeIndex : -1;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const updateUrl = (location: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (location) next.set(LOCATION_PARAM, location);
    else next.delete(LOCATION_PARAM);
    setSearchParams(next);
  };

  const selectSuggestion = (suggestion: LocationSuggestion) => {
    setQuery(suggestion.name);
    setSelectedName(suggestion.name);
    setIsOpen(false);
    setActiveIndex(-1);
    updateUrl(suggestion.name.toLowerCase());
    onLocationChange?.(suggestion);
  };

  const clearSearch = () => {
    setQuery('');
    setSelectedName(null);
    setIsOpen(false);
    setActiveIndex(-1);
    updateUrl(null);
    onLocationChange?.(null);
    inputRef.current?.focus();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setQuery(value);
    setIsOpen(true);
    setActiveIndex(-1);
    if (selectedName !== null) {
      setSelectedName(null);
      updateUrl(null);
      onLocationChange?.(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      if (suggestions.length > 0) setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      if (suggestions.length > 0) {
        setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      }
    } else if (event.key === 'Enter' && showListbox && currentIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[currentIndex]);
    } else if (event.key === 'Escape') {
      if (showPopup) {
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
      } else if (query) {
        event.preventDefault();
        clearSearch();
      }
    }
  };

  return (
    <div className="location-search">
      <label className="location-search__label" htmlFor={`${listboxId}-input`}>
        Buscar por ubicación
      </label>
      <div className="location-search__field">
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          className="location-search__input"
          type="text"
          role="combobox"
          placeholder="Ciudad, barrio o código postal"
          autoComplete="off"
          value={query}
          aria-autocomplete="list"
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-activedescendant={showListbox && currentIndex >= 0 ? optionId(currentIndex) : undefined}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
        />
        {query && (
          <button
            className="location-search__clear"
            type="button"
            aria-label="Borrar el texto de búsqueda"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSearch}
          >
            ×
          </button>
        )}
      </div>

      <ul
        id={listboxId}
        className="location-search__listbox"
        role="listbox"
        aria-label="Sugerencias de ubicación"
        hidden={!showListbox}
      >
        {showListbox && suggestions.map((suggestion, index) => (
          <li
            key={suggestion.id}
            id={optionId(index)}
            className={`location-search__option${index === currentIndex ? ' location-search__option--active' : ''}`}
            role="option"
            aria-selected={index === currentIndex}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectSuggestion(suggestion)}
          >
            <span>{suggestion.name}</span>
            <span className="location-search__type">{TYPE_LABELS[suggestion.type]}</span>
          </li>
        ))}
      </ul>

      <div className="location-search__popup" onMouseDown={(event) => event.preventDefault()}>
        {showPopup && isLoading && (
          <p className="location-search__status" role="status">Buscando…</p>
        )}
        {showPopup && hasFailed && (
          <p className="location-search__status location-search__status--error" role="alert">
            No se pudieron cargar las sugerencias. Inténtalo de nuevo.
          </p>
        )}
        {showPopup && !isLoading && !hasFailed && suggestions.length === 0 && (
          <EmptyState
            title={`No encontramos ubicaciones para «${debouncedQuery}».`}
            description="Prueba con otra ciudad, barrio o código postal."
            onAction={clearSearch}
          />
        )}
      </div>
    </div>
  );
}

function isLocationSuggestion(value: unknown): value is LocationSuggestion {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && (item.type === 'city' || item.type === 'neighborhood' || item.type === 'postal_code');
}

export default LocationSearchBar;
