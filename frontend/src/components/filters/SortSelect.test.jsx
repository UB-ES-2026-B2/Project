import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SortSelect, { readSort } from './SortSelect.tsx';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('readSort', () => {
  it('falls back to newest for missing or unknown values', () => {
    expect(readSort(new URLSearchParams(''))).toBe('newest');
    expect(readSort(new URLSearchParams('sort=cheapest'))).toBe('newest');
    expect(readSort(new URLSearchParams('sort=price_desc'))).toBe('price_desc');
  });
});

describe('SortSelect', () => {
  it('starts from the order in the URL', () => {
    window.history.replaceState(null, '', '/?sort=area_desc');
    render(<SortSelect />);

    expect(screen.getByLabelText('Ordenar por')).toHaveValue('area_desc');
  });

  it('writes the chosen order to the URL and keeps the other filters', () => {
    window.history.replaceState(null, '', '/?operation_type=rent');
    render(<SortSelect />);

    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'price_asc' } });
    expect(window.location.search).toBe('?operation_type=rent&sort=price_asc');

    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'newest' } });
    expect(window.location.search).toBe('?operation_type=rent');
  });
});
