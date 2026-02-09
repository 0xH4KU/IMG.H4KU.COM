import { zipSync } from 'fflate';

interface DownloadZipOptions {
  name: string;
  keys: string[];
  getUrl: (key: string) => string;
  onProgress?: (finished: number, total: number) => void;
}

function uniqueName(name: string, used: Map<string, number>) {
  if (!used.has(name)) {
    used.set(name, 1);
    return name;
  }
  const count = used.get(name) || 1;
  used.set(name, count + 1);
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    return `${name.slice(0, dot)}-${count}${name.slice(dot)}`;
  }
  return `${name}-${count}`;
}

export async function downloadZip({ name, keys, getUrl, onProgress }: DownloadZipOptions) {
  const entries: Record<string, Uint8Array> = {};
  const usedNames = new Map<string, number>();

  let finished = 0;
  const total = keys.length;

  for (const key of keys) {
    const res = await fetch(getUrl(key));
    if (res.ok) {
      const buffer = new Uint8Array(await res.arrayBuffer());
      const baseName = key.split('/').pop() || key;
      const fileName = uniqueName(baseName, usedNames);
      entries[fileName] = buffer;
    }
    finished += 1;
    onProgress?.(finished, total);
  }

  const zipped = zipSync(entries, { level: 6 });
  const buffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
