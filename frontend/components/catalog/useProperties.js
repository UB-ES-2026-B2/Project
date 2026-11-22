import { useEffect, useState } from 'react';

export const PROPERTIES_QUERY_KEY = ['properties'];

function toCardProperty(property) {
  return {
    ...property,
    previousPrice: property.previous_price,
    images: property.image_url ? [property.image_url] : [],
  };
}

/**
 * URL del catálogo. `options` añade el resto de parámetros de GET /api/v1/properties
 * (p. ej. `{ sort: 'price_asc' }`); los vacíos no se envían.
 */
export function propertiesUrl(locationId, operationType = null, propertyTypes = [], options = {}) {
  const params = new URLSearchParams({ page: '1', limit: '12' });
  if (locationId) params.set('location_id', locationId);
  if (operationType) params.set('operation_type', operationType);
  propertyTypes.forEach((propertyType) => params.append('property_types', propertyType));
  Object.entries(options).forEach(([name, value]) => {
    if (value !== null && value !== undefined && value !== '') params.set(name, String(value));
  });
  return `/api/v1/properties?${params}`;
}

function useProperties(locationId = null, operationType = null, propertyTypes = [], options = {}) {
  const url = propertiesUrl(locationId, operationType, propertyTypes, options);
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

  return {
    properties: result.properties,
    isLoading: result.url !== url,
  };
}

export default useProperties;
