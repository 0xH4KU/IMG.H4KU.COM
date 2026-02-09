import { useMemo } from 'react';
import { useImageMeta } from '../contexts/ImageMetaContext';
import { ImageItem } from './useImageGridData';

export type GroupBy = 'none' | 'type' | 'date' | 'tag';

interface ImageGroup {
  label: string;
  images: ImageItem[];
}

function getFileExt(key: string): string {
  const name = key.split('/').pop() || '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function getDateGroup(uploaded: string): string {
  const date = new Date(uploaded);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'This Week';
  if (days <= 30) return 'This Month';
  return 'Older';
}

const DATE_ORDER: Record<string, number> = {
  'Today': 0, 'Yesterday': 1, 'This Week': 2, 'This Month': 3, 'Older': 4,
};

const TAG_LABEL: Record<string, string> = {
  red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green',
  blue: 'Blue', purple: 'Purple', gray: 'Gray',
};

interface UseImageGroupsOptions {
  images: ImageItem[];
  groupBy: GroupBy;
}

export function useImageGroups(options: UseImageGroupsOptions): ImageGroup[] {
  const { images, groupBy } = options;
  const { getTags } = useImageMeta();

  return useMemo(() => {
    if (groupBy === 'none') return [{ label: '', images }];

    const map = new Map<string, ImageItem[]>();

    for (const img of images) {
      let groupKey: string;

      if (groupBy === 'type') {
        groupKey = getFileExt(img.key).toUpperCase() || 'OTHER';
      } else if (groupBy === 'date') {
        groupKey = getDateGroup(img.uploaded);
      } else {
        // groupBy === 'tag'
        const tags = getTags(img.key);
        if (tags.length === 0) {
          const list = map.get('Untagged') || [];
          list.push(img);
          map.set('Untagged', list);
          continue;
        }
        for (const tag of tags) {
          const label = TAG_LABEL[tag] || tag;
          const list = map.get(label) || [];
          list.push(img);
          map.set(label, list);
        }
        continue;
      }

      const list = map.get(groupKey) || [];
      list.push(img);
      map.set(groupKey, list);
    }

    const entries = Array.from(map.entries());
    if (groupBy === 'date') {
      entries.sort((a, b) => (DATE_ORDER[a[0]] ?? 99) - (DATE_ORDER[b[0]] ?? 99));
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }

    return entries.map(([label, images]) => ({ label, images }));
  }, [images, groupBy, getTags]);
}

export type { ImageGroup };
