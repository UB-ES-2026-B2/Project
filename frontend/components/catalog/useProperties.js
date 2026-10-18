import { useQuery } from '@tanstack/react-query';

export const PROPERTIES_QUERY_KEY = ['properties'];

const MOCK_PROPERTIES = [
  {
    id: 'eixample-01',
    isFavorite: false,
    title: 'Piso luminoso con balcón',
    location: 'L’Eixample, Barcelona',
    price: 385000,
    previousPrice: 410000,
    bedrooms: 3,
    bathrooms: 2,
    area: 96,
    images: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    id: 'gracia-02',
    isFavorite: false,
    title: 'Ático reformado con terraza',
    location: 'Gràcia, Barcelona',
    price: 520000,
    bedrooms: 2,
    bathrooms: 2,
    area: 82,
    images: [
      'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    id: 'sants-03',
    isFavorite: false,
    title: 'Vivienda familiar exterior',
    location: 'Sants, Barcelona',
    price: 319000,
    bedrooms: 4,
    bathrooms: 1,
    area: 104,
    images: [
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80',
    ],
  },
];

function useProperties() {
  const { data: properties, isLoading } = useQuery({
    queryKey: PROPERTIES_QUERY_KEY,
    queryFn: () => MOCK_PROPERTIES,
    initialData: MOCK_PROPERTIES,
    staleTime: Infinity,
  });
  return { properties, isLoading };
}

export default useProperties;
