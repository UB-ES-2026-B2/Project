import { useEffect, useState } from 'react';

export const DEFAULT_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delay = DEFAULT_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebouncedValue;
