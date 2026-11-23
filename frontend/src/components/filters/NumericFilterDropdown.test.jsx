import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import NumericFilterDropdown, { readNumericFilters, validateNumeric } from './NumericFilterDropdown.tsx';

const empty = { min_price: '', max_price: '', min_rooms: '', min_surface: '', max_surface: '' };

afterEach(() => window.history.replaceState(null, '', '/'));

describe('readNumericFilters', () => {
  it('keeps only non-negative integers', () => {
    expect(readNumericFilters(new URLSearchParams('min_price=100&max_price=-5&min_rooms=abc&max_surface=90')))
      .toEqual({ min_price: '100', max_surface: '90' });
  });
});

describe('validateNumeric', () => {
  it('accepts empty and valid ranges', () => {
    expect(validateNumeric(empty)).toEqual({});
    expect(validateNumeric({ ...empty, min_price: '100', max_price: '100' })).toEqual({});
  });

  it('flags text, negative numbers, too many rooms and inverted ranges', () => {
    const errors = validateNumeric({
      min_price: '500', max_price: '100', min_rooms: '60', min_surface: '-3', max_surface: '2.5',
    });
    expect(Object.keys(errors).sort()).toEqual(['max_price', 'max_surface', 'min_rooms', 'min_surface']);
  });
});

describe('NumericFilterDropdown', () => {
  it('applies valid values to the URL and shows how many are active', () => {
    window.history.replaceState(null, '', '/?operation_type=sale');
    render(<NumericFilterDropdown />);

    fireEvent.click(screen.getByRole('button', { name: 'Precio y tamaño' }));
    fireEvent.change(screen.getByLabelText('Precio máximo (€)'), { target: { value: '300000' } });
    fireEvent.change(screen.getByLabelText('Habitaciones mínimas'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(window.location.search).toBe('?operation_type=sale&max_price=300000&min_rooms=2');
    expect(screen.getByRole('button', { name: 'Precio y tamaño (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks an inverted range before touching the URL', () => {
    render(<NumericFilterDropdown />);

    fireEvent.click(screen.getByRole('button', { name: 'Precio y tamaño' }));
    fireEvent.change(screen.getByLabelText('Superficie mínima (m²)'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Superficie máxima (m²)'), { target: { value: '50' } });

    expect(screen.getByText('El máximo tiene que ser mayor o igual que el mínimo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
    expect(window.location.search).toBe('');
  });

  it('opens with the applied values and clears them', () => {
    window.history.replaceState(null, '', '/?min_price=1000&sort=price_asc');
    render(<NumericFilterDropdown />);

    fireEvent.click(screen.getByRole('button', { name: 'Precio y tamaño (1)' }));
    expect(screen.getByLabelText('Precio mínimo (€)')).toHaveValue('1000');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    expect(window.location.search).toBe('?sort=price_asc');
  });
});
