// Vite's `define` doesn't apply to code under test, so provide the build id here.
(globalThis as unknown as { BUILD_ID: string }).BUILD_ID = 'test';
