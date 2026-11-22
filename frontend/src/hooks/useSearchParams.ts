import { useCallback, useEffect, useState } from 'react';

/** Evento con el que todas las instancias del hook se enteran de un cambio en la URL. */
export const SEARCH_PARAMS_EVENT = 'searchparamschange';

type SearchParamsInit = URLSearchParams | Record<string, string>;
type SetSearchParams = (next: SearchParamsInit) => void;

function readSearchParams() {
  return new URLSearchParams(window.location.search);
}

function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const [searchParams, setSearchParamsState] = useState(readSearchParams);

  useEffect(() => {
    const handlePopState = () => setSearchParamsState(readSearchParams());
    window.addEventListener('popstate', handlePopState);
    window.addEventListener(SEARCH_PARAMS_EVENT, handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(SEARCH_PARAMS_EVENT, handlePopState);
    };
  }, []);

  const setSearchParams = useCallback<SetSearchParams>((next) => {
    const params = new URLSearchParams(next);
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
    setSearchParamsState(params);
    // Los filtros y el listado usan instancias distintas del hook: así se sincronizan.
    window.dispatchEvent(new Event(SEARCH_PARAMS_EVENT));
  }, []);

  return [searchParams, setSearchParams];
}

export default useSearchParams;
