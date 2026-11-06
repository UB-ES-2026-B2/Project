import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useDebouncedValue from './useDebouncedValue.ts';
import useSearchParams from './useSearchParams.ts';
import { propertiesUrl } from '../../components/catalog/useProperties.js';

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers());

  it('only returns the new value after the delay without changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: 'abc' });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('abc');
  });
});

describe('useSearchParams', () => {
  beforeEach(() => window.history.replaceState(null, '', '/?location=girona&page=2'));

  it('reads the current URL parameters', () => {
    const { result } = renderHook(() => useSearchParams());

    expect(result.current[0].get('location')).toBe('girona');
    expect(result.current[0].get('page')).toBe('2');
  });

  it('replaces the URL without adding a history entry', () => {
    const historyLength = window.history.length;
    const { result } = renderHook(() => useSearchParams());

    act(() => result.current[1]({ location: 'barcelona' }));

    expect(window.location.search).toBe('?location=barcelona');
    expect(window.history.length).toBe(historyLength);
    expect(result.current[0].get('location')).toBe('barcelona');
  });

  it('syncs when the user navigates back or forward', () => {
    const { result } = renderHook(() => useSearchParams());

    act(() => {
      window.history.replaceState(null, '', '/?location=sitges');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current[0].get('location')).toBe('sitges');
  });
});

describe('propertiesUrl', () => {
  it('filters the catalog by location_id only when a location is selected', () => {
    expect(propertiesUrl(null)).toBe('/api/v1/properties?page=1&limit=12');
    expect(propertiesUrl('loc-bcn')).toBe('/api/v1/properties?page=1&limit=12&location_id=loc-bcn');
  });
});
