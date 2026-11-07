import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocationSearchBar from './LocationSearchBar.tsx';

const suggestions = [
  { id: 'loc-bcn', name: 'Barcelona', type: 'city' },
  { id: 'loc-bdn', name: 'Badalona', type: 'city' },
];

function mockSuggestions(items = suggestions) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => items }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function getInput() {
  return screen.getByRole('combobox', { name: 'Buscar por ubicación' });
}

function typeQuery(value) {
  const input = getInput();
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  return input;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LocationSearchBar', () => {
  it('debounces suggestion requests by 300 ms', async () => {
    vi.useFakeTimers();
    const fetchMock = mockSuggestions();
    render(<LocationSearchBar />);
    typeQuery('bar');

    await act(async () => { vi.advanceTimersByTime(299); });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(1); });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/locations/suggest?q=bar',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('supports arrow-key navigation and selects with Enter, updating the URL', async () => {
    mockSuggestions();
    const onLocationChange = vi.fn();
    render(<LocationSearchBar onLocationChange={onLocationChange} />);
    const input = typeQuery('ba');

    const options = await screen.findAllByRole('option');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('Barcelona');
    expect(window.location.search).toBe('?location=barcelona');
    expect(onLocationChange).toHaveBeenLastCalledWith(suggestions[0]);
  });

  it('restores a location from the URL and reports failed requests', async () => {
    window.history.replaceState(null, '', '/?location=barcelona');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    render(<LocationSearchBar />);

    expect(getInput()).toHaveValue('barcelona');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar las sugerencias',
    );
  });

  it('shows an empty state and clears the query and URL', async () => {
    mockSuggestions([]);
    const onLocationChange = vi.fn();
    window.history.replaceState(null, '', '/?page=2');
    render(<LocationSearchBar onLocationChange={onLocationChange} />);
    typeQuery('zzz');

    expect(await screen.findByText('No encontramos ubicaciones para «zzz».')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(getInput()).toHaveValue('');
    expect(window.location.search).toBe('?page=2');
    expect(onLocationChange).toHaveBeenLastCalledWith(null);
  });

  it('clears the selected location when the user edits its text', async () => {
    mockSuggestions();
    const onLocationChange = vi.fn();
    render(<LocationSearchBar onLocationChange={onLocationChange} />);
    const input = typeQuery('ba');
    fireEvent.click(await screen.findByRole('option', { name: /Barcelona/ }));

    fireEvent.change(input, { target: { value: 'Barcelon' } });

    expect(window.location.search).toBe('');
    expect(onLocationChange).toHaveBeenLastCalledWith(null);
  });
});
