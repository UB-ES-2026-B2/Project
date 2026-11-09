import { useCallback, useEffect, useState } from 'react';

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
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setSearchParams = useCallback<SetSearchParams>((next) => {
    const params = new URLSearchParams(next);
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
    setSearchParamsState(params);
  }, []);

  return [searchParams, setSearchParams];
}

export default useSearchParams;
