// Comprime la imagen usando un Canvas HTML5 y devuelve un Base64
export const compressImage = (file: File, maxWidth = 400, maxHeight = 400, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
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

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Devolver como base64
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const uploadImage = async (file: File, path: string): Promise<string> => {
  try {
    // En lugar de usar Firebase Storage (que requiere configuración adicional),
    // guardamos la imagen comprimida en Base64 directamente en Firestore.
    // Como la limitamos a 400x400px, el tamaño será de unos ~20KB, muy por debajo del límite de 1MB.
    const base64Image = await compressImage(file);
    return base64Image;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};
