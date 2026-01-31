const THUMB_MAX_SIZE = 300;
const THUMB_QUALITY = 0.8;

export async function generateThumbnail(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { width, height } = img;
      if (width <= THUMB_MAX_SIZE && height <= THUMB_MAX_SIZE) {
        resolve(null); // Already small enough
        return;
      }

      const scale = Math.min(THUMB_MAX_SIZE / width, THUMB_MAX_SIZE / height);
      const thumbWidth = Math.round(width * scale);
      const thumbHeight = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = thumbWidth;
      canvas.height = thumbHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }

      ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);

      canvas.toBlob(
        (blob) => resolve(blob),
        'image/webp',
        THUMB_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}
