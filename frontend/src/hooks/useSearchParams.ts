import { useCallback, useEffect, useState } from 'react';

type SearchParamsInit = URLSearchParams | Record<string, string>;
type SetSearchParams = (next: SearchParamsInit) => void;

const SEARCH_PARAMS_CHANGE_EVENT = 'searchparamschange';

function readSearchParams() {
  return new URLSearchParams(window.location.search);
}

function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const [searchParams, setSearchParamsState] = useState(readSearchParams);

  useEffect(() => {
    const handleChange = () => setSearchParamsState(readSearchParams());
    window.addEventListener('popstate', handleChange);
    window.addEventListener(SEARCH_PARAMS_CHANGE_EVENT, handleChange);
    return () => {
      window.removeEventListener('popstate', handleChange);
      window.removeEventListener(SEARCH_PARAMS_CHANGE_EVENT, handleChange);
    };
  }, []);

  const setSearchParams = useCallback<SetSearchParams>((next) => {
    const params = new URLSearchParams(next);
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new Event(SEARCH_PARAMS_CHANGE_EVENT));
    setSearchParamsState(params);
  }, []);

  return [searchParams, setSearchParams];
}

export default useSearchParams;
