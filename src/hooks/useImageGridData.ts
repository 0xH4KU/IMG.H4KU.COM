import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useImageMeta, TagColor } from '../contexts/ImageMetaContext';
import { apiRequest } from '../utils/api';
import { useApiAction } from './useApiAction';
import { getErrorMessage } from '../utils/errors';
import { ImageFilters } from '../types';

export interface ImageItem {
  key: string;
  size: number;
  uploaded: string;
}

interface UseImageGridDataOptions {
  folder: string;
  refreshKey: number;
  activeTag: TagColor | null;
  showFavorites: boolean;
  filters: ImageFilters;
  pageSize?: number;
}

interface UseImageGridDataResult {
  images: ImageItem[];
  processedImages: ImageItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  fetchMore: () => void;
  refresh: () => void;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}

const PAGE_SIZE = 50;

function getFileExt(key: string): string {
  const name = key.split('/').pop() || '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function useImageGridData(options: UseImageGridDataOptions): UseImageGridDataResult {
  const { folder, refreshKey, activeTag, showFavorites, filters, pageSize = PAGE_SIZE } = options;

  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { run } = useApiAction();
  const { getTags, isFavorite } = useImageMeta();

  const fetchImages = useCallback(async (append = false) => {
    if (append && (!hasMore || loadingMore)) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setImages([]);
      setCursor(null);
      setHasMore(true);
      setError(null);
    }

    const params = new URLSearchParams();
    if (folder) params.set('folder', folder);
    params.set('limit', String(pageSize));
    if (append && cursor) params.set('cursor', cursor);

    try {
      const data = await run(() => apiRequest<{ images?: ImageItem[]; cursor?: string | null; hasMore?: boolean }>(`/api/images?${params}`));
      if (append) {
        setImages(prev => [...prev, ...(data.images || [])]);
      } else {
        setImages(data.images || []);
      }
      setCursor(data.cursor || null);
      setHasMore(data.hasMore ?? false);
    } catch (err) {
      if (!append) {
        setError(getErrorMessage(err, 'Failed to load images'));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [folder, cursor, hasMore, loadingMore, pageSize, run]);

  // Initial fetch and refresh
  useEffect(() => {
    fetchImages(false);
  }, [folder, refreshKey]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchImages(true);
        }
      },
      { rootMargin: '400px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchImages]);

  // Filter and sort images
  const processedImages = useMemo(() => {
    let filtered = images;

    if (activeTag) {
      filtered = filtered.filter(img => getTags(img.key).includes(activeTag));
    }

    if (showFavorites) {
      filtered = filtered.filter(img => isFavorite(img.key));
    }

    if (filters.query.trim()) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(img => (img.key.split('/').pop() || '').toLowerCase().includes(query));
    }

    if (filters.type) {
      const type = filters.type;
      filtered = filtered.filter(img => {
        const ext = getFileExt(img.key);
        if (type === 'other') {
          return !['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(ext);
        }
        if (type === 'jpg') return ext === 'jpg' || ext === 'jpeg';
        return ext === type;
      });
    }

    const minMb = filters.sizeMin ? Number(filters.sizeMin) : null;
    const maxMb = filters.sizeMax ? Number(filters.sizeMax) : null;
    if (Number.isFinite(minMb) && minMb !== null) {
      filtered = filtered.filter(img => img.size >= minMb * 1024 * 1024);
    }
    if (Number.isFinite(maxMb) && maxMb !== null) {
      filtered = filtered.filter(img => img.size <= maxMb * 1024 * 1024);
    }

    const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
    const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
    if (from) {
      filtered = filtered.filter(img => new Date(img.uploaded).getTime() >= from);
    }
    if (to) {
      filtered = filtered.filter(img => new Date(img.uploaded).getTime() <= to);
    }

    return [...filtered].sort((a, b) => {
      const aFav = isFavorite(a.key) ? 0 : 1;
      const bFav = isFavorite(b.key) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime();
    });
  }, [images, activeTag, showFavorites, getTags, isFavorite, filters]);

  const fetchMore = useCallback(() => {
    fetchImages(true);
  }, [fetchImages]);

  const refresh = useCallback(() => {
    fetchImages(false);
  }, [fetchImages]);

  return {
    images,
    processedImages,
    loading,
    loadingMore,
    hasMore,
    error,
    fetchMore,
    refresh,
    loadMoreRef,
  };
}
