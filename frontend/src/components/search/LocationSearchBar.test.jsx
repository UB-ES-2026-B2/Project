import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocationSearchBar from './LocationSearchBar.tsx';

const SUGGESTIONS = [
  { id: 'loc-bcn', name: 'Barcelona', type: 'city' },
  { id: 'loc-bdn', name: 'Badalona', type: 'city' },
  { id: 'loc-08001', name: '08001', type: 'postal_code' },
];

function mockSuggest(items = SUGGESTIONS) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => items }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function getInput() {
  return screen.getByRole('combobox', { name: 'Buscar por ubicación' });
}

function type(value) {
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
  it('waits 300 ms after the last keystroke before calling the API (debounce)', async () => {
    vi.useFakeTimers();
    const fetchMock = mockSuggest();
    render(<LocationSearchBar />);

    type('b');
    type('ba');
    type('bar');
    await act(async () => { vi.advanceTimersByTime(299); });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(1); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/locations/suggest?q=bar');
  });

  it('does not search with fewer than 2 characters', async () => {
    vi.useFakeTimers();
    const fetchMock = mockSuggest();
    render(<LocationSearchBar />);

    type('b');
    await act(async () => { vi.advanceTimersByTime(500); });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('shows the suggestions as an accessible listbox', async () => {
    mockSuggest();
    render(<LocationSearchBar />);

    const input = type('ba');

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'BarcelonaCiudad',
      'BadalonaCiudad',
      '08001Código postal',
    ]);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
  });

  it('navigates with the arrow keys and selects with Enter, syncing ?location= in the URL', async () => {
    mockSuggest();
    const onLocationChange = vi.fn();
    render(<LocationSearchBar onLocationChange={onLocationChange} />);
    const input = type('ba');
    await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0].id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('Barcelona');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(window.location.search).toBe('?location=barcelona');
    expect(onLocationChange).toHaveBeenLastCalledWith(SUGGESTIONS[0]);
  });

  it('selects a suggestion with the mouse', async () => {
    mockSuggest();
    const onLocationChange = vi.fn();
    render(<LocationSearchBar onLocationChange={onLocationChange} />);
    type('ba');

    fireEvent.click(await screen.findByRole('option', { name: /Badalona/ }));

    expect(getInput()).toHaveValue('Badalona');
    expect(window.location.search).toBe('?location=badalona');
    expect(onLocationChange).toHaveBeenLastCalledWith(SUGGESTIONS[1]);
  });

  it('shows an empty state whose action clears the search and the URL', async () => {
    mockSuggest([]);
    const onLocationChange = vi.fn();
    window.history.replaceState(null, '', '/?page=2');
    render(<LocationSearchBar onLocationChange={onLocationChange} />);
    type('zzz');

    expect(await screen.findByText('No encontramos ubicaciones para «zzz».')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(getInput()).toHaveValue('');
    expect(screen.queryByText(/No encontramos ubicaciones/)).not.toBeInTheDocument();
    expect(window.location.search).toBe('?page=2');
    expect(onLocationChange).toHaveBeenLastCalledWith(null);
  });

  it('restores the location from ?location= when the page loads', async () => {
    window.history.replaceState(null, '', '/?location=barcelona');
    const fetchMock = mockSuggest();
    const onLocationChange = vi.fn();
    render(<LocationSearchBar onLocationChange={onLocationChange} />);

    expect(getInput()).toHaveValue('barcelona');
    await waitFor(() => expect(onLocationChange).toHaveBeenCalledWith(SUGGESTIONS[0]));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/locations/suggest?q=barcelona');
    expect(getInput()).toHaveValue('Barcelona');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('typing again after a selection removes the location filter', async () => {
    mockSuggest();
    const onLocationChange = vi.fn();
    render(<LocationSearchBar onLocationChange={onLocationChange} />);
    const input = type('ba');
    fireEvent.click(await screen.findByRole('option', { name: /Barcelona/ }));

    fireEvent.change(input, { target: { value: 'Barcelon' } });

    expect(window.location.search).toBe('');
    expect(onLocationChange).toHaveBeenLastCalledWith(null);
  });

  it('closes the suggestions with Escape and clears the field with a second Escape', async () => {
    mockSuggest();
    render(<LocationSearchBar />);
    const input = type('ba');
    await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(input).toHaveValue('ba');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('shows an error message when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    render(<LocationSearchBar />);
    type('ba');

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las sugerencias');
  });

  it('ignores malformed items returned by the API', async () => {
    mockSuggest([{ id: 1, name: 'Sin id de texto', type: 'city' }, SUGGESTIONS[0]]);
    render(<LocationSearchBar />);
    type('ba');

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Barcelona');
  });

  it('clears the field with the × button', async () => {
    mockSuggest();
    render(<LocationSearchBar />);
    type('ba');

    fireEvent.click(screen.getByRole('button', { name: 'Borrar el texto de búsqueda' }));

    expect(getInput()).toHaveValue('');
  });
});
