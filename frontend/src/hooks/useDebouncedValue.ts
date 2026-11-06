import { useEffect, useState } from 'react';

export const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Devuelve `value` solo cuando ha dejado de cambiar durante `delay` milisegundos.
 * Sirve para no lanzar una petición a la API en cada pulsación de tecla.
 */
function useDebouncedValue<T>(value: T, delay = DEFAULT_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebouncedValue;
