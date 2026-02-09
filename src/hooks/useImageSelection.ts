import { useState, useCallback, useEffect } from 'react';

interface UseImageSelectionOptions {
  availableKeys: string[];
}

interface UseImageSelectionResult {
  selectedKeys: Set<string>;
  selectedCount: number;
  allSelected: boolean;
  isSelected: (key: string) => boolean;
  toggle: (key: string) => void;
  selectAll: () => void;
  clear: () => void;
  getSelectedArray: () => string[];
}

export function useImageSelection(options: UseImageSelectionOptions): UseImageSelectionResult {
  const { availableKeys } = options;
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Clean up selection when available keys change
  useEffect(() => {
    if (selectedKeys.size === 0) return;
    const visibleKeys = new Set(availableKeys);
    setSelectedKeys(prev => {
      const next = new Set([...prev].filter(key => visibleKeys.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [availableKeys]);

  const toggle = useCallback((key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(availableKeys));
  }, [availableKeys]);

  const isSelected = useCallback((key: string) => {
    return selectedKeys.has(key);
  }, [selectedKeys]);

  const getSelectedArray = useCallback(() => {
    return Array.from(selectedKeys);
  }, [selectedKeys]);

  const allSelected = availableKeys.length > 0 && availableKeys.every(key => selectedKeys.has(key));

  return {
    selectedKeys,
    selectedCount: selectedKeys.size,
    allSelected,
    isSelected,
    toggle,
    selectAll,
    clear,
    getSelectedArray,
  };
}
