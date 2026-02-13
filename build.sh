#!/bin/bash

# Ensure Emscripten environment is sourced before running
# Example: source /path/to/emsdk/emsdk_env.sh

echo "Compiling High-Performance Image Processing WASM Module..."

emcc src/filters.c \
    -O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_malloc_buffer", "_free_buffer", "_grayscale", "_gaussian_blur", "_sobel", "_malloc", "_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["cwrap", "getValue", "setValue", "HEAPU8"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -o wasm/filters.js

echo "Build complete. Output generated in wasm/ folder."

# Hint for SIMD optimization (Academic depth)
# To enable SIMD, add: -msimd128
