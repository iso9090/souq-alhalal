// Livestock only: bounded JPEG bytes travel with the authenticated listing write.
// Commercial advertisements continue to use their separate upload architecture.
import {compressImage, prepareImageSelection, safeImage, validateImageCount} from './image-provider.js';

export const MAX_LIVESTOCK_IMAGE_BYTES = 150 * 1024;
export const MAX_LIVESTOCK_IMAGES_LENGTH = 650000;

async function boundedJPEG(file) {
  const compressed = await compressImage(file);
  if (compressed.size <= MAX_LIVESTOCK_IMAGE_BYTES) return compressed;
  const bitmap = await createImageBitmap(compressed);
  try {
    const canvas = document.createElement('canvas');
    for (const scale of [1, .8, .6, .4]) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw Error('CANVAS_ERROR');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [.8, .65, .5]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= MAX_LIVESTOCK_IMAGE_BYTES) return blob;
      }
    }
    throw Error('IMAGES_TOO_LARGE');
  } finally { bitmap.close(); }
}

export async function listingImageData(files, user) {
  if (!user) throw Error('AUTH_REQUIRED');
  validateImageCount(files);
  const prepared = await prepareImageSelection(files);
  const images = [];
  for (const file of prepared) {
    const blob = await boundedJPEG(file);
    const value = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(Error('IMAGE_READ_ERROR'));
      reader.onabort = () => reject(Error('IMAGE_READ_ERROR'));
      reader.readAsDataURL(blob);
    });
    if (!safeImage(value) || !value.startsWith('data:image/jpeg;base64,')) throw Error('INVALID_IMAGE');
    images.push(value);
  }
  // Leave room for listing metadata below Firestore's 1 MiB document limit.
  if (images.reduce((sum, value) => sum + value.length, 0) > MAX_LIVESTOCK_IMAGES_LENGTH) throw Error('IMAGES_TOO_LARGE');
  if (new Set(images).size !== images.length) throw Error('DUPLICATE_IMAGE');
  return images;
}
