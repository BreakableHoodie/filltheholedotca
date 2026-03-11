export interface ResizeImageOptions {
	maxPixels?: number;
	quality?: number;
}

export async function resizeImage(
	file: File,
	{ maxPixels = 800, quality = 0.82 }: ResizeImageOptions = {}
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const objectUrl = URL.createObjectURL(file);
		const img = new Image();

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);
			const scale = Math.min(1, maxPixels / Math.max(img.width, img.height));
			const width = Math.round(img.width * scale);
			const height = Math.round(img.height * scale);
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext('2d');

			if (!context) {
				reject(new Error('Could not get canvas context'));
				return;
			}

			context.drawImage(img, 0, 0, width, height);
			canvas.toBlob(
				(blob) => {
					if (!blob) {
						reject(new Error('Image conversion failed'));
						return;
					}

					resolve(blob);
				},
				'image/jpeg',
				quality
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Failed to load image'));
		};

		img.src = objectUrl;
	});
}