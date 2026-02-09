import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { apiRequest } from '../utils/api';
import { getErrorMessage } from '../utils/errors';
import { useApiAction } from '../hooks/useApiAction';

export type TagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

export const TAG_COLORS: TagColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

interface ImageMeta {
  tags: TagColor[];
  favorite: boolean;
}

interface MetaData {
  version: number;
  updatedAt: string;
  images: Record<string, ImageMeta>;
}

interface ImageMetaContextType {
  meta: Record<string, ImageMeta>;
  loading: boolean;
  error: string;
  refreshMeta: () => Promise<void>;
  toggleTag: (key: string, tag: TagColor) => Promise<void>;
  toggleFavorite: (key: string) => Promise<void>;
  getTags: (key: string) => TagColor[];
  isFavorite: (key: string) => boolean;
  getFavoriteCount: () => number;
  getTagCount: (tag: TagColor) => number;
}

const ImageMetaContext = createContext<ImageMetaContextType | null>(null);

export function ImageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Record<string, ImageMeta>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { run } = useApiAction();

  const refreshMeta = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await run(() => apiRequest<MetaData>('/api/metadata'));
      setMeta(data.images || {});
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Failed to load metadata'));
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta]);

  const updateMeta = useCallback(async (key: string, updates: Partial<ImageMeta>) => {
    const current = meta[key] || { tags: [], favorite: false };
    const updated = { ...current, ...updates };

    // Optimistic update
    setMeta(prev => {
      if (updated.tags.length === 0 && !updated.favorite) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: updated };
    });

    try {
      await run(() => apiRequest('/api/metadata', {
        method: 'PUT',
        body: { key, ...updates },
      }));
      setError('');
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Failed to update metadata'));
      // Rollback on failure
      setMeta(prev => ({ ...prev, [key]: current }));
    }
  }, [meta, run]);

  const toggleTag = useCallback(async (key: string, tag: TagColor) => {
    const current = meta[key]?.tags || [];
    const tags = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    await updateMeta(key, { tags });
  }, [meta, updateMeta]);

  const toggleFavorite = useCallback(async (key: string) => {
    const current = meta[key]?.favorite || false;
    await updateMeta(key, { favorite: !current });
  }, [meta, updateMeta]);

  const getTags = useCallback((key: string): TagColor[] => {
    return meta[key]?.tags || [];
  }, [meta]);

  const isFavorite = useCallback((key: string): boolean => {
    return meta[key]?.favorite || false;
  }, [meta]);

  const getFavoriteCount = useCallback((): number => {
    return Object.entries(meta).filter(([key, m]) => !key.startsWith('trash/') && m.favorite).length;
  }, [meta]);

  const getTagCount = useCallback((tag: TagColor): number => {
    return Object.entries(meta).filter(([key, m]) => !key.startsWith('trash/') && m.tags.includes(tag)).length;
  }, [meta]);

  return (
    <ImageMetaContext.Provider
      value={{
        meta,
        loading,
        error,
        refreshMeta,
        toggleTag,
        toggleFavorite,
        getTags,
        isFavorite,
        getFavoriteCount,
        getTagCount,
      }}
    >
      {children}
    </ImageMetaContext.Provider>
  );
}

export function useImageMeta() {
  const context = useContext(ImageMetaContext);
  if (!context) {
    throw new Error('useImageMeta must be used within ImageMetaProvider');
  }
  return context;
}
