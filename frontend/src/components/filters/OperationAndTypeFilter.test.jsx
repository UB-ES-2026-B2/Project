import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OperationAndTypeFilter from './OperationAndTypeFilter';

describe('OperationAndTypeFilter', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('selects operation tabs and updates the URL', () => {
    render(<OperationAndTypeFilter />);

    const rentTab = screen.getByRole('tab', { name: 'Alquiler' });
    fireEvent.click(rentTab);

    expect(rentTab).toHaveAttribute('aria-selected', 'true');
    expect(new URLSearchParams(window.location.search).get('operation_type')).toBe('rent');
  });

  it('shows a selected-type counter and resets URL parameters', () => {
    const onChange = vi.fn();
    render(<OperationAndTypeFilter onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tipo de inmueble' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Piso' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Oficina' }));

    expect(screen.getByRole('button', { name: 'Tipo de inmueble (2)' })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).getAll('property_types')).toEqual([
      'flat',
      'office',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(window.location.search).toBe('');
    expect(onChange).toHaveBeenLastCalledWith({
      operationType: null,
      propertyTypes: [],
    });
  });

  it('closes the popover with Escape', () => {
    render(<OperationAndTypeFilter />);

    fireEvent.click(screen.getByRole('button', { name: 'Tipo de inmueble' }));
    expect(screen.getByRole('dialog', { name: 'Seleccionar tipos de inmueble' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Seleccionar tipos de inmueble' })).not.toBeInTheDocument();
  });
});
