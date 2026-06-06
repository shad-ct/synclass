/**
 * @fileoverview useLocalStorage — Typed hook for synced localStorage state.
 * Reads initial value from localStorage, falls back to defaultValue.
 * Persists every state update to localStorage.
 *
 * @example
 * const [guest, setGuest] = useLocalStorage<GuestProfile>('synclass_guest', null);
 */
import { useState, useCallback } from 'react';

function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = typeof value === 'function'
          ? (value as (prev: T) => T)(prev)
          : value;
        try {
          if (next === null || next === undefined) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, JSON.stringify(next));
          }
        } catch {
          // Storage quota exceeded — fail silently
        }
        return next;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}

export default useLocalStorage;
