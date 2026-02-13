#include <emscripten.h>
#include <math.h>
#include <stdint.h>
#include <stdlib.h>

/**
 * High-Performance Image Processing Module
 *
 * This module implements core pixel-level convolution operations in C
 * to be compiled to WebAssembly. It operates on a shared linear memory
 * buffer with JavaScript.
 */

// Exported functions for JS to access
EMSCRIPTEN_KEEPALIVE
uint8_t *malloc_buffer(int size) {
  return (uint8_t *)malloc(size * sizeof(uint8_t));
}

EMSCRIPTEN_KEEPALIVE
void free_buffer(uint8_t *p) { free(p); }

/**
 * Grayscale Filter
 * Luminosity method: 0.299R + 0.587G + 0.114B
 */
EMSCRIPTEN_KEEPALIVE
void grayscale(uint8_t *data, int width, int height) {
  int total_pixels = width * height;
  for (int i = 0; i < total_pixels; i++) {
    int idx = i * 4;
    uint8_t r = data[idx];
    uint8_t g = data[idx + 1];
    uint8_t b = data[idx + 2];

    uint8_t gray = (uint8_t)(0.299f * r + 0.587f * g + 0.114f * b);

    data[idx] = gray;
    data[idx + 1] = gray;
    data[idx + 2] = gray;
    // Alpha (idx + 3) remains untouched
  }
}

/**
 * Gaussian Blur (3x3 Kernel)
 * Simple 3x3 approximation for fixed-size convolution analysis
 */
EMSCRIPTEN_KEEPALIVE
void gaussian_blur(uint8_t *src, uint8_t *dst, int width, int height) {
  float kernel[3][3] = {{1 / 16.0f, 2 / 16.0f, 1 / 16.0f},
                        {2 / 16.0f, 4 / 16.0f, 2 / 16.0f},
                        {1 / 16.0f, 2 / 16.0f, 1 / 16.0f}};

  for (int y = 1; y < height - 1; y++) {
    for (int x = 1; x < width - 1; x++) {
      float r = 0, g = 0, b = 0;

      for (int ky = -1; ky <= 1; ky++) {
        for (int kx = -1; kx <= 1; kx++) {
          int pixel_idx = ((y + ky) * width + (x + kx)) * 4;
          float weight = kernel[ky + 1][kx + 1];

          r += src[pixel_idx] * weight;
          g += src[pixel_idx + 1] * weight;
          b += src[pixel_idx + 2] * weight;
        }
      }

      int out_idx = (y * width + x) * 4;
      dst[out_idx] = (uint8_t)r;
      dst[out_idx + 1] = (uint8_t)g;
      dst[out_idx + 2] = (uint8_t)b;
      dst[out_idx + 3] = src[out_idx + 3];
    }
  }
}

/**
 * Sobel Edge Detection
 * Computes gradient magnitude using Gx and Gy kernels
 */
EMSCRIPTEN_KEEPALIVE
void sobel(uint8_t *src, uint8_t *dst, int width, int height) {
  int gx[3][3] = {{-1, 0, 1}, {-2, 0, 2}, {-1, 0, 1}};
  int gy[3][3] = {{-1, -2, -1}, {0, 0, 0}, {1, 2, 1}};

  for (int y = 1; y < height - 1; y++) {
    for (int x = 1; x < width - 1; x++) {
      float rx = 0, gx_val = 0, bx = 0;
      float ry = 0, gy_val = 0, by = 0;

      for (int ky = -1; ky <= 1; ky++) {
        for (int kx = -1; kx <= 1; kx++) {
          int pixel_idx = ((y + ky) * width + (x + kx)) * 4;
          int weight_x = gx[ky + 1][kx + 1];
          int weight_y = gy[ky + 1][kx + 1];

          // Using luminance simplified for speed in edge detection
          uint8_t gray =
              (uint8_t)(0.299f * src[pixel_idx] + 0.587f * src[pixel_idx + 1] +
                        0.114f * src[pixel_idx + 2]);

          gx_val += gray * weight_x;
          gy_val += gray * weight_y;
        }
      }

      int magnitude = (int)sqrt(gx_val * gx_val + gy_val * gy_val);
      if (magnitude > 255)
        magnitude = 255;

      int out_idx = (y * width + x) * 4;
      dst[out_idx] = (uint8_t)magnitude;
      dst[out_idx + 1] = (uint8_t)magnitude;
      dst[out_idx + 2] = (uint8_t)magnitude;
      dst[out_idx + 3] = 255;
    }
  }
}
