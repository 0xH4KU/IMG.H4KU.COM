import { useCallback, useState } from 'react';
import { TagColor } from '../contexts/ImageMetaContext';
import { apiRequest } from '../utils/api';
import { useApiAction } from './useApiAction';
import { getErrorMessage } from '../utils/errors';
import { downloadZip } from '../utils/zip';
import { DELIVERY_HOSTS, shouldUseFileProxy } from '../utils/url';

const useFileProxy = shouldUseFileProxy(typeof window !== 'undefined' ? window.location.hostname : '');

interface UseImageActionsOptions {
  domain: 'h4ku' | 'lum';
  isTrashView: boolean;
  onRefresh: () => void;
  refreshMeta: () => void;
  confirm: (message: string, options?: { title?: string; danger?: boolean }) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
  showError: (message: string) => void;
}

interface UseImageActionsResult {
  downloading: boolean;
  getImageUrl: (key: string) => string;
  getThumbnailUrl: (key: string) => string;
  getCopyUrl: (key: string) => string;
  getAltText: (key: string) => string;
  copyLink: (key: string) => Promise<void>;
  copyMarkdown: (key: string, promptAlt?: boolean) => Promise<void>;
  copyHtml: (key: string, promptAlt?: boolean) => Promise<void>;
  deleteImage: (key: string) => Promise<void>;
  restoreImage: (key: string) => Promise<void>;
  deleteSelected: (keys: string[]) => Promise<void>;
  restoreSelected: (keys: string[]) => Promise<void>;
  applyBulkTag: (keys: string[], tag: TagColor, mode: 'add' | 'remove') => Promise<void>;
  downloadSelected: (keys: string[]) => Promise<void>;
  copyMarkdownSelected: (keys: string[]) => Promise<void>;
  copyHtmlSelected: (keys: string[]) => Promise<void>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function useImageActions(options: UseImageActionsOptions): UseImageActionsResult {
  const { domain, isTrashView, onRefresh, refreshMeta, confirm, prompt, showError } = options;
  const [downloading, setDownloading] = useState(false);
  const { run } = useApiAction();

  const getImageUrl = useCallback((key: string) => {
    return useFileProxy ? `/api/file?key=${encodeURIComponent(key)}` : `${DELIVERY_HOSTS[domain]}/${key}`;
  }, [domain]);

  const getThumbnailUrl = useCallback((key: string) => {
    const thumbKey = `.thumbs/${key}`;
    return useFileProxy ? `/api/file?key=${encodeURIComponent(thumbKey)}` : `${DELIVERY_HOSTS[domain]}/${thumbKey}`;
  }, [domain]);

  const getCopyUrl = useCallback((key: string) => {
    return `${DELIVERY_HOSTS[domain]}/${key}`;
  }, [domain]);

  const getAltText = useCallback((key: string) => {
    const name = key.split('/').pop() || key;
    return name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'image';
  }, []);

  const copyLink = useCallback(async (key: string) => {
    const url = getCopyUrl(key);
    await navigator.clipboard.writeText(url);
  }, [getCopyUrl]);

  const copyMarkdown = useCallback(async (key: string, promptAlt = true) => {
    const url = getCopyUrl(key);
    const defaultAlt = getAltText(key);
    const alt = promptAlt ? (await prompt('Alt text:', defaultAlt)) : defaultAlt;
    if (promptAlt && alt === null) return;
    await navigator.clipboard.writeText(`![${alt || defaultAlt}](${url})`);
  }, [getCopyUrl, getAltText, prompt]);

  const copyHtml = useCallback(async (key: string, promptAlt = true) => {
    const url = getCopyUrl(key);
    const defaultAlt = getAltText(key);
    const alt = promptAlt ? (await prompt('Alt text:', defaultAlt)) : defaultAlt;
    if (promptAlt && alt === null) return;
    const safeAlt = escapeHtml(alt || defaultAlt);
    await navigator.clipboard.writeText(`<img src="${url}" alt="${safeAlt}" loading="lazy" />`);
  }, [getCopyUrl, getAltText, prompt]);

  const deleteImage = useCallback(async (key: string) => {
    const message = isTrashView ? 'Delete this image permanently?' : 'Move this image to trash?';
    const confirmed = await confirm(message, { title: isTrashView ? 'Delete Permanently' : 'Delete', danger: isTrashView });
    if (!confirmed) return;
    try {
      await run(() => apiRequest(`/api/images?key=${encodeURIComponent(key)}`, { method: 'DELETE' }));
      onRefresh();
      refreshMeta();
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to delete image'));
    }
  }, [isTrashView, confirm, run, onRefresh, refreshMeta, showError]);

  const restoreImage = useCallback(async (key: string) => {
    const confirmed = await confirm('Restore this image to its original folder?', { title: 'Restore' });
    if (!confirmed) return;
    try {
      await run(() => apiRequest('/api/images', { method: 'POST', body: { key } }));
      onRefresh();
      refreshMeta();
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to restore image'));
    }
  }, [confirm, run, onRefresh, refreshMeta, showError]);

  const deleteSelected = useCallback(async (keys: string[]) => {
    if (keys.length === 0) return;
    const message = isTrashView
      ? `Delete ${keys.length} selected image(s) permanently?`
      : `Move ${keys.length} selected image(s) to trash?`;
    const confirmed = await confirm(message, { title: isTrashView ? 'Delete Permanently' : 'Delete', danger: isTrashView });
    if (!confirmed) return;
    try {
      await run(() => apiRequest('/api/images/batch', { method: 'POST', body: { keys } }));
      onRefresh();
      refreshMeta();
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to delete selected images'));
    }
  }, [isTrashView, confirm, run, onRefresh, refreshMeta, showError]);

  const restoreSelected = useCallback(async (keys: string[]) => {
    if (keys.length === 0) return;
    const confirmed = await confirm(`Restore ${keys.length} selected image(s) to their original folders?`, { title: 'Restore' });
    if (!confirmed) return;
    try {
      await run(() => apiRequest('/api/images/batch', { method: 'POST', body: { keys, action: 'restore' } }));
      onRefresh();
      refreshMeta();
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to restore selected images'));
    }
  }, [confirm, run, onRefresh, refreshMeta, showError]);

  const applyBulkTag = useCallback(async (keys: string[], tag: TagColor, mode: 'add' | 'remove') => {
    try {
      await run(() => apiRequest('/api/metadata/batch', {
        method: 'POST',
        body: {
          keys,
          addTags: mode === 'add' ? [tag] : [],
          removeTags: mode === 'remove' ? [tag] : [],
        },
      }));
      refreshMeta();
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to update tags'));
    }
  }, [run, refreshMeta, showError]);

  const downloadSelected = useCallback(async (keys: string[]) => {
    if (keys.length === 0) return;
    setDownloading(true);
    try {
      await downloadZip({
        name: 'images',
        keys,
        getUrl: getImageUrl,
        onProgress: () => {},
      });
    } finally {
      setDownloading(false);
    }
  }, [getImageUrl]);

  const copyMarkdownSelected = useCallback(async (keys: string[]) => {
    if (keys.length === 0) return;
    const lines = keys.map(key => {
      const alt = getAltText(key);
      return `![${alt}](${getCopyUrl(key)})`;
    });
    await navigator.clipboard.writeText(lines.join('\n'));
  }, [getAltText, getCopyUrl]);

  const copyHtmlSelected = useCallback(async (keys: string[]) => {
    if (keys.length === 0) return;
    const lines = keys.map(key => {
      const alt = escapeHtml(getAltText(key));
      return `<img src="${getCopyUrl(key)}" alt="${alt}" loading="lazy" />`;
    });
    await navigator.clipboard.writeText(lines.join('\n'));
  }, [getAltText, getCopyUrl]);

  return {
    downloading,
    getImageUrl,
    getThumbnailUrl,
    getCopyUrl,
    getAltText,
    copyLink,
    copyMarkdown,
    copyHtml,
    deleteImage,
    restoreImage,
    deleteSelected,
    restoreSelected,
    applyBulkTag,
    downloadSelected,
    copyMarkdownSelected,
    copyHtmlSelected,
  };
}
