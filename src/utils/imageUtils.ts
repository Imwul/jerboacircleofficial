const dataUrlBytes = (value: string) => Math.ceil((value.split(',')[1]?.length ?? 0) * 0.75);

export const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const maxUploadBytes = 2_350_000;
          if (file.type === 'image/png') {
            const png = canvas.toDataURL('image/png');
            if (dataUrlBytes(png) <= maxUploadBytes) {
              resolve(png);
              return;
            }
          }

          for (const quality of [0.84, 0.76, 0.68, 0.6]) {
            const webp = canvas.toDataURL('image/webp', quality);
            if (webp.startsWith('data:image/webp') && dataUrlBytes(webp) <= maxUploadBytes) {
              resolve(webp);
              return;
            }
          }

          const jpeg = canvas.toDataURL('image/jpeg', 0.58);
          if (dataUrlBytes(jpeg) <= maxUploadBytes) {
            resolve(jpeg);
            return;
          }
          reject(new Error('image_too_large'));
        } else {
          reject(new Error('image_canvas_unavailable'));
        }
      };
      img.onerror = () => reject(new Error('image_decode_failed'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('image_read_failed'));
    reader.readAsDataURL(file);
  });
};
