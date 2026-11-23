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
 * @param {string | null} locationId
 * @param {string | number | null} operationTypeOrLimit
 * @param {string[]} propertyTypes
 */
export function propertiesUrl(locationId, operationTypeOrLimit = null, propertyTypes = []) {
  const operationType = typeof operationTypeOrLimit === 'string'
    ? operationTypeOrLimit
    : null;
  const limit = typeof operationTypeOrLimit === 'number' ? operationTypeOrLimit : 12;
  const params = new URLSearchParams({ page: '1', limit: String(limit) });
  if (locationId) params.set('location_id', locationId);
  if (operationType) params.set('operation_type', operationType);
  propertyTypes.forEach((propertyType) => params.append('property_types', propertyType));
  return `/api/v1/properties?${params}`;
}

/**
 * @param {string | null} locationId
 * @param {string | number | null} operationTypeOrLimit
 * @param {string[]} propertyTypes
 */
function useProperties(locationId = null, operationTypeOrLimit = null, propertyTypes = []) {
  const url = propertiesUrl(locationId, operationTypeOrLimit, propertyTypes);
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
