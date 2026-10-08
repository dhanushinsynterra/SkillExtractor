import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { DATA_DIR: path.join(os.tmpdir(), `synterra-test-${process.pid}`), GEMINI_API_KEY: '' },
  },
});
