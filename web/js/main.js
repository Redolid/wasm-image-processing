/**
 * Main Application Orchestrator
 * Handles UI events, WASM memory management, and benchmarking lifecycle.
 */

let wasmInstance = null;
let originalImageData = null;

// DOM Elements
const elements = {
    imageUpload: document.getElementById('imageUpload'),
    fileName: document.getElementById('fileName'),
    btnGrayscale: document.getElementById('btnGrayscale'),
    btnBlur: document.getElementById('btnBlur'),
    btnSobel: document.getElementById('btnSobel'),
    btnBenchmark: document.getElementById('btnBenchmark'),
    canvasOriginal: document.getElementById('canvasOriginal'),
    canvasJS: document.getElementById('canvasJS'),
    canvasWasm: document.getElementById('canvasWasm'),
    jsTime: document.getElementById('jsTime'),
    wasmTime: document.getElementById('wasmsTime'),
    imgSize: document.getElementById('imgSize'),
    benchmarkTableBody: document.querySelector('#benchmarkTable tbody')
};

const contexts = {
    original: elements.canvasOriginal.getContext('2d', { willReadFrequently: true }),
    js: elements.canvasJS.getContext('2d', { willReadFrequently: true }),
    wasm: elements.canvasWasm.getContext('2d', { willReadFrequently: true })
};

// WASM Module Initialization Hook
window.initWasm = function (wasmModule) {
    console.log("Initializing WASM Instance...");
    wasmInstance = {
        malloc_buffer: wasmModule.cwrap('malloc_buffer', 'number', ['number']),
        free_buffer: wasmModule.cwrap('free_buffer', null, ['number']),
        grayscale: wasmModule.cwrap('grayscale', null, ['number', 'number', 'number']),
        gaussian_blur: wasmModule.cwrap('gaussian_blur', null, ['number', 'number', 'number', 'number']),
        sobel: wasmModule.cwrap('sobel', null, ['number', 'number', 'number', 'number']),
        heap: wasmModule.HEAPU8
    };
    checkState();
};

/**
 * Handle Image Upload
 */
elements.imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    elements.fileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            setupCanvases(img);
            checkState();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function setupCanvases(img) {
    const width = img.width;
    const height = img.height;

    [elements.canvasOriginal, elements.canvasJS, elements.canvasWasm].forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
    });

    contexts.original.drawImage(img, 0, 0);
    originalImageData = contexts.original.getImageData(0, 0, width, height);

    elements.imgSize.textContent = `${width}x${height}`;
    elements.imgSize.parentElement.classList.remove('invisible');
}

function checkState() {
    const isReady = originalImageData !== null && wasmInstance !== null;
    elements.btnGrayscale.disabled = !isReady;
    elements.btnBlur.disabled = !isReady;
    elements.btnSobel.disabled = !isReady;
    elements.btnBenchmark.disabled = !isReady;
}

/**
 * Filter Execution & Benchmarking
 */

async function runFilter(filterName, filterFn) {
    if (!originalImageData) return;

    // Reset canvases
    contexts.js.putImageData(originalImageData, 0, 0);
    contexts.wasm.putImageData(originalImageData, 0, 0);

    const imageDataJS = contexts.js.getImageData(0, 0, elements.canvasJS.width, elements.canvasJS.height);
    const imageDataWasm = contexts.wasm.getImageData(0, 0, elements.canvasWasm.width, elements.canvasWasm.height);

    // 1. JS Execution
    const t0 = performance.now();
    filterFn.js(imageDataJS);
    const t1 = performance.now();
    const jsDuration = (t1 - t0).toFixed(2);
    contexts.js.putImageData(imageDataJS, 0, 0);
    elements.jsTime.textContent = jsDuration;

    // 2. WASM Execution
    const t2 = performance.now();
    executeWasmFilter(filterName, imageDataWasm);
    const t3 = performance.now();
    const wasmDuration = (t3 - t2).toFixed(2);
    contexts.wasm.putImageData(imageDataWasm, 0, 0);
    elements.wasmTime.textContent = wasmDuration;

    return { jsDuration: parseFloat(jsDuration), wasmDuration: parseFloat(wasmDuration) };
}

function executeWasmFilter(name, imageData) {
    const { width, height, data } = imageData;
    const size = data.length;

    // 1. Allocate memory in WASM heap
    const pData = wasmInstance.malloc_buffer(size);
    const pDst = (name === 'grayscale') ? pData : wasmInstance.malloc_buffer(size);

    // 2. Copy data into WASM memory
    Module.HEAPU8.set(data, pData);

    // 3. Call WASM function
    switch (name) {
        case 'grayscale':
            wasmInstance.grayscale(pData, width, height);
            break;
        case 'blur':
            wasmInstance.gaussian_blur(pData, pDst, width, height);
            break;
        case 'sobel':
            wasmInstance.sobel(pData, pDst, width, height);
            break;
    }

    // 4. Copy back and free
    imageData.data.set(new Uint8Array(Module.HEAPU8.buffer, pDst, size));

    wasmInstance.free_buffer(pData);
    if (pDst !== pData) wasmInstance.free_buffer(pDst);
}

// Event Listeners for Filters
elements.btnGrayscale.addEventListener('click', () => runFilter('grayscale', { js: JSFilters.grayscale }));
elements.btnBlur.addEventListener('click', () => runFilter('blur', { js: JSFilters.gaussianBlur }));
elements.btnSobel.addEventListener('click', () => runFilter('sobel', { js: JSFilters.sobel }));

/**
 * Performance Testing
 */
elements.btnBenchmark.addEventListener('click', async () => {
    elements.btnBenchmark.disabled = true;
    elements.btnBenchmark.textContent = 'Running...';

    const filters = [
        { name: 'Grayscale', id: 'grayscale', fn: JSFilters.grayscale },
        { name: 'Gaussian Blur', id: 'blur', fn: JSFilters.gaussianBlur },
        { name: 'Sobel Edge', id: 'sobel', fn: JSFilters.sobel }
    ];

    elements.benchmarkTableBody.innerHTML = '';
    const resolution = `${originalImageData.width}x${originalImageData.height}`;

    for (const filter of filters) {
        // Warm up
        executeWasmFilter(filter.id, contexts.wasm.getImageData(0, 0, 10, 10)); // tiny warm up

        let jsTotal = 0;
        let wasmTotal = 0;
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
            const res = await runFilter(filter.id, { js: filter.fn });
            jsTotal += res.jsDuration;
            wasmTotal += res.wasmDuration;
        }

        const jsAvg = (jsTotal / iterations).toFixed(2);
        const wasmAvg = (wasmTotal / iterations).toFixed(2);
        const speedup = (jsAvg / wasmAvg).toFixed(2);

        const row = `
            <tr>
                <td>${filter.name}</td>
                <td>${resolution}</td>
                <td>${jsAvg}</td>
                <td>${wasmAvg}</td>
                <td class="speedup">${speedup}x</td>
            </tr>
        `;
        elements.benchmarkTableBody.innerHTML += row;
    }

    elements.btnBenchmark.disabled = false;
    elements.btnBenchmark.textContent = 'Run Full Benchmark';
});
