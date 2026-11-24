import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmptyFavoritesState from './EmptyFavoritesState';

describe('EmptyFavoritesState', () => {
  it('renders title, description and button linking to home', () => {
    render(<EmptyFavoritesState />);

    expect(screen.getByRole('heading', { name: 'Aún no tienes favoritos' })).toBeInTheDocument();
    expect(screen.getByText(/Guarda los inmuebles que te interesen/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Explorar inmuebles' });
    expect(link).toHaveAttribute('href', '/');
  });
});
