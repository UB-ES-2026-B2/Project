import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { propertiesUrl } from '../../components/catalog/useProperties.js';
import useDebouncedValue from './useDebouncedValue.ts';
import useSearchParams from './useSearchParams.ts';

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers());

  it('waits for the value to remain unchanged for the configured delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'b' },
    });

    rerender({ value: 'ba' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: 'bar' });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('b');

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('bar');
  });
});

describe('useSearchParams', () => {
  beforeEach(() => window.history.replaceState(null, '', '/?location=girona&page=2'));

  it('reads the current parameters and replaces the URL while preserving passed parameters', () => {
    const historyLength = window.history.length;
    const { result } = renderHook(() => useSearchParams());

    expect(result.current[0].get('location')).toBe('girona');
    expect(result.current[0].get('page')).toBe('2');
    act(() => result.current[1]({ location: 'barcelona', page: '2' }));

    expect(window.location.search).toBe('?location=barcelona&page=2');
    expect(window.history.length).toBe(historyLength);
  });

  it('updates its value when browser navigation dispatches popstate', () => {
    const { result } = renderHook(() => useSearchParams());

    act(() => {
      window.history.replaceState(null, '', '/?location=sitges');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current[0].get('location')).toBe('sitges');
  });
});

describe('propertiesUrl', () => {
  it('adds a location filter only when a location is selected', () => {
    expect(propertiesUrl(null)).toBe('/api/v1/properties?page=1&limit=12');
    expect(propertiesUrl('loc-bcn')).toBe(
      '/api/v1/properties?page=1&limit=12&location_id=loc-bcn',
    );
  });
});
