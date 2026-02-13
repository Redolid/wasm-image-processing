/**
 * JavaScript implementation of image processing filters.
 * These are used as the baseline for performance benchmarking against WebAssembly.
 */

const JSFilters = {
    /**
     * Grayscale Filter
     * Luminosity method: 0.299R + 0.587G + 0.114B
     */
    grayscale(imageData) {
        const data = imageData.data;
        const len = data.length;
        for (let i = 0; i < len; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const gray = (0.299 * r + 0.587 * g + 0.114 * b) | 0;

            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
    },

    /**
     * Gaussian Blur (3x3 Kernel)
     */
    gaussianBlur(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const src = imageData.data;
        const dst = new Uint8ClampedArray(src.length);

        const kernel = [
            [1 / 16, 2 / 16, 1 / 16],
            [2 / 16, 4 / 16, 2 / 16],
            [1 / 16, 2 / 16, 1 / 16]
        ];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let r = 0, g = 0, b = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
                        const weight = kernel[ky + 1][kx + 1];

                        r += src[pixelIdx] * weight;
                        g += src[pixelIdx + 1] * weight;
                        b += src[pixelIdx + 2] * weight;
                    }
                }

                const outIdx = (y * width + x) * 4;
                dst[outIdx] = r | 0;
                dst[outIdx + 1] = g | 0;
                dst[outIdx + 2] = b | 0;
                dst[outIdx + 3] = src[outIdx + 3];
            }
        }

        // Copy back to original buffer
        for (let i = 0; i < src.length; i++) {
            src[i] = dst[i];
        }
    },

    /**
     * Sobel Edge Detection
     */
    sobel(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const src = imageData.data;
        const dst = new Uint8ClampedArray(src.length);

        const gx = [
            [-1, 0, 1],
            [-2, 0, 2],
            [-1, 0, 1]
        ];
        const gy = [
            [-1, -2, -1],
            [0, 0, 0],
            [1, 2, 1]
        ];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gxVal = 0, gyVal = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
                        const weightX = gx[ky + 1][kx + 1];
                        const weightY = gy[ky + 1][kx + 1];

                        // Grayscale approximation for edge detection
                        const gray = (0.299 * src[pixelIdx] + 0.587 * src[pixelIdx + 1] + 0.114 * src[pixelIdx + 2]);

                        gxVal += gray * weightX;
                        gyVal += gray * weightY;
                    }
                }

                let magnitude = Math.sqrt(gxVal * gxVal + gyVal * gyVal) | 0;
                if (magnitude > 255) magnitude = 255;

                const outIdx = (y * width + x) * 4;
                dst[outIdx] = magnitude;
                dst[outIdx + 1] = magnitude;
                dst[outIdx + 2] = magnitude;
                dst[outIdx + 3] = 255;
            }
        }

        // Copy back
        for (let i = 0; i < src.length; i++) {
            src[i] = dst[i];
        }
    }
};
