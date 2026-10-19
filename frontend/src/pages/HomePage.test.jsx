import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import HomePage from './HomePage.jsx';

// Usa los 12 anuncios de ejemplo reales de useProperties.

function resultsHeading() {
  return document.getElementById('destacados-title');
}

function cardTitles() {
  return screen.queryAllByRole('heading', { level: 3 })
    .filter((heading) => heading.classList.contains('property-card__title'))
    .map((heading) => heading.textContent);
}

describe('HomePage', () => {
  it('shows every featured listing before searching', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: '12 espacios destacados' })).toBeInTheDocument();
    expect(cardTitles()).toHaveLength(12);
  });

  it('switches between the Comprar and Alquilar tabs with the mouse and the keyboard', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    const buy = screen.getByRole('tab', { name: 'Comprar' });
    const rent = screen.getByRole('tab', { name: 'Alquilar' });

    expect(buy).toHaveAttribute('aria-selected', 'true');
    await user.click(rent);
    expect(rent).toHaveAttribute('aria-selected', 'true');
    expect(buy).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', rent.id);

    fireEvent.keyDown(rent, { key: 'ArrowRight' });
    expect(buy).toHaveAttribute('aria-selected', 'true');
    expect(buy).toHaveFocus();
  });

  it('filters by operation and location (ignoring accents and apostrophes)', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole('tab', { name: 'Alquilar' }));
    await user.type(screen.getByLabelText('Ubicación'), 'Barcelona');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(resultsHeading()).toHaveTextContent('3 espacios en alquiler en Barcelona');
    expect(resultsHeading()).toHaveFocus();
    expect(cardTitles()).toEqual([
      'Piso de dos habitaciones junto a la Rambla',
      'Oficina diáfana en el distrito 22@',
      'Plaza de aparcamiento con acceso 24 h',
    ]);

    await user.clear(screen.getByLabelText('Ubicación'));
    await user.type(screen.getByLabelText('Ubicación'), "l'hospitalet");
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(resultsHeading()).toHaveTextContent("1 espacio en alquiler en l'hospitalet");
  });

  it('finds listings by postal code', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.type(screen.getByLabelText('Ubicación'), '08014');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(resultsHeading()).toHaveTextContent('2 espacios en venta en 08014');
  });

  it('filters by space type from the search selector', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.selectOptions(screen.getByLabelText('Tipo de espacio'), 'garaje');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(resultsHeading()).toHaveTextContent('1 garaje en venta');
    expect(cardTitles()).toEqual(['Plaza de garaje para coche grande']);
  });

  it('filters by space type from the space type grid and syncs the selector', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    const offices = screen.getByRole('button', { name: /Oficinas\s*1 anuncio/ });

    await user.click(offices);

    expect(offices).toHaveAttribute('aria-pressed', 'true');
    expect(resultsHeading()).toHaveTextContent('1 oficina');
    expect(screen.getByLabelText('Tipo de espacio')).toHaveValue('oficina');
  });

  it('shows the counts per space type', () => {
    render(<HomePage />);

    expect(screen.getByRole('button', { name: /Pisos\s*4 anuncios/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trasteros\s*1 anuncio$/ })).toBeInTheDocument();
  });

  it('shows an empty state and clears the search', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.type(screen.getByLabelText('Ubicación'), 'Tarragona');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(screen.getByText('No hay espacios que coincidan con tu búsqueda.')).toBeInTheDocument();
    expect(cardTitles()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(resultsHeading()).toHaveTextContent('12 espacios destacados');
    expect(screen.getByLabelText('Ubicación')).toHaveValue('');
  });

  it('removes a single active filter from its chip', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole('tab', { name: 'Alquilar' }));
    await user.selectOptions(screen.getByLabelText('Tipo de espacio'), 'local');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(resultsHeading()).toHaveTextContent('1 local en alquiler');

    const chips = screen.getByRole('list', { name: 'Filtros activos' });
    await user.click(within(chips).getByRole('button', { name: 'Quitar filtro: Locales' }));

    expect(resultsHeading()).toHaveTextContent('6 espacios en alquiler');
    expect(screen.getByLabelText('Tipo de espacio')).toHaveValue('all');
  });

  it('filters by operation from the header links', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });

    await user.click(within(nav).getByRole('link', { name: 'Alquilar' }));
    expect(resultsHeading()).toHaveTextContent('6 espacios en alquiler');
    expect(screen.getByRole('tab', { name: 'Alquilar' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(nav).getByRole('link', { name: 'Comprar' }));
    expect(resultsHeading()).toHaveTextContent('6 espacios en venta');
  });

  it('opens and closes the mobile menu', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    const toggle = screen.getByRole('button', { name: 'Abrir menú' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Cerrar menú');

    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('announces features that are not available yet', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(screen.getByRole('status')).toHaveTextContent('Iniciar sesión: próximamente.');
  });

  it('shows the academic project footer with the current year', () => {
    render(<HomePage />);

    expect(screen.getByText('Proyecto académico · Ingeniería del Software · Universitat de Barcelona · Grupo B2'))
      .toBeInTheDocument();
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()}`))).toBeInTheDocument();
  });
});
