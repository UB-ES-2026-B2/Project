import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EditPropertyModal, { validateEdit } from './EditPropertyModal.tsx';

const property = {
  id: 3,
  title: 'Casa con jardín',
  location: 'Sant Cugat',
  price: 500000,
  previous_price: null,
  bedrooms: 4,
  bathrooms: 2,
  area: 200,
  image_url: null,
  is_active: true,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => (
    String(url).endsWith('/images')
      ? { ok: true, status: 200, json: async () => [] }
      : { ok: false, status: 500, json: async () => ({}) }
  )));
});
afterEach(() => vi.unstubAllGlobals());

describe('validateEdit', () => {
  it('accepts valid values and rejects the wrong ones', () => {
    const valid = { title: 'Casa con jardín', price: '1', area: '10', bedrooms: '0', bathrooms: '50' };
    expect(validateEdit(valid)).toEqual({});
    expect(Object.keys(validateEdit({ title: 'abc', price: '-1', area: '1.5', bedrooms: '51', bathrooms: 'x' })))
      .toEqual(['title', 'price', 'area', 'bedrooms', 'bathrooms']);
  });
});

describe('EditPropertyModal', () => {
  it('starts with the listing data and blocks invalid changes', () => {
    render(<EditPropertyModal property={property} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText('Título')).toHaveValue('Casa con jardín');
    fireEvent.change(screen.getByLabelText('Superficie (m²)'), { target: { value: '0' } });

    expect(screen.getByText('Introduce una superficie entera mayor que cero.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it('shows an error when saving fails and closes with Escape', async () => {
    const onClose = vi.fn();
    render(<EditPropertyModal property={property} onClose={onClose} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron guardar los cambios');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
