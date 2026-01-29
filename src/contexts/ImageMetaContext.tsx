import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { getAuthToken } from './AuthContext';

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

  const refreshMeta = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const res = await fetch('/api/metadata', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: MetaData = await res.json();
        setMeta(data.images || {});
      }
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta]);

  const updateMeta = useCallback(async (key: string, updates: Partial<ImageMeta>) => {
    const token = getAuthToken();
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
      const res = await fetch('/api/metadata', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, ...updates }),
      });
      if (!res.ok) {
        // Rollback on failure
        setMeta(prev => ({ ...prev, [key]: current }));
      }
    } catch {
      // Rollback on failure
      setMeta(prev => ({ ...prev, [key]: current }));
    }
  }, [meta]);

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
    return Object.values(meta).filter(m => m.favorite).length;
  }, [meta]);

  const getTagCount = useCallback((tag: TagColor): number => {
    return Object.values(meta).filter(m => m.tags.includes(tag)).length;
  }, [meta]);

  return (
    <ImageMetaContext.Provider
      value={{
        meta,
        loading,
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
