const MAX_SIDE = 1280;

/** Read an image file, downscale it and return a JPEG data URL small enough to send. */
export async function fileToDataUrl(file) {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be attached.');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That image format is not supported by this browser. Try a JPG or PNG.');
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // flatten transparency
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.85);
}
