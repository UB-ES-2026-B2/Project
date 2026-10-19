import { useEffect, useState } from 'react';

function toCardProperty(property) {
  return {
    ...property,
    previousPrice: property.previous_price,
    images: property.image_url ? [property.image_url] : [],
  };
}

function useProperties() {
  const [properties, setProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/properties?page=1&limit=12')
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar el catálogo');
        return response.json();
      })
      .then(({ items }) => setProperties(items.map(toCardProperty)))
      .catch(() => setProperties([]))
      .finally(() => setIsLoading(false));
  }, []);

  return { properties, isLoading };
}

export default useProperties;
