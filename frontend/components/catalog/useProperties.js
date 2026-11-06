import { useEffect, useState } from 'react';

export const PROPERTIES_QUERY_KEY = ['properties'];

function toCardProperty(property) {
  return {
    ...property,
    previousPrice: property.previous_price,
    images: property.image_url ? [property.image_url] : [],
  };
}

export function propertiesUrl(locationId) {
  const params = new URLSearchParams({ page: '1', limit: '12' });
  if (locationId) params.set('location_id', locationId);
  return `/api/v1/properties?${params}`;
}

/**
 * Carga el catálogo. Si se pasa `locationId` (US 1.3.2), lo filtra por esa ubicación
 * con `GET /api/v1/properties?location_id=` (contrato de la US 1.3.1).
 */
function useProperties(locationId = null) {
  const url = propertiesUrl(locationId);
  const [result, setResult] = useState({ url: null, properties: [] });

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar el catálogo');
        return response.json();
      })
      .then(({ items }) => {
        if (!cancelled) setResult({ url, properties: items.map(toCardProperty) });
      })
      .catch(() => {
        if (!cancelled) setResult({ url, properties: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { properties: result.properties, isLoading: result.url !== url };
}

export default useProperties;
