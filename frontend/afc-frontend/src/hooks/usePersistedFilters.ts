import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook to persist filter state in localStorage
 * @param storageKey - Unique key for localStorage (e.g., "filters_airfilters")
 * @param initialState - Initial state object for filters
 * @returns [filters, setFilter, clearFilters]
 */
export function usePersistedFilters<T extends Record<string, any>>(
  storageKey: string,
  initialState: T
): [T, (key: keyof T, value: any) => void, () => void] {
  // Initialize state from localStorage or use initial state
  const [filters, setFilters] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with initialState to handle new fields added later
        return { ...initialState, ...parsed };
      }
    } catch (error) {
      console.error(`Error loading filters from localStorage (${storageKey}):`, error);
    }
    return initialState;
  });

  // Save to localStorage whenever filters change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (error) {
      console.error(`Error saving filters to localStorage (${storageKey}):`, error);
    }
  }, [storageKey, filters]);

  // Update a single filter field
  const setFilter = useCallback((key: keyof T, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Clear all filters (reset to initial state)
  const clearFilters = useCallback(() => {
    setFilters(initialState);
  }, [initialState]);

  return [filters, setFilter, clearFilters];
}
