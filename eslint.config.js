import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'docs/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The simulation must stay pure and deterministic (see CLAUDE.md).
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['phaser', 'phaser/*'], message: 'src/sim must not import Phaser.' },
            { group: ['**/phaser/**', '**/ui/**'], message: 'src/sim must not import presentation code.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in src/sim/rng.ts.' },
        { object: 'Date', property: 'now', message: 'The simulation must not depend on wall-clock time.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/sim must not touch the DOM.' },
        { name: 'document', message: 'src/sim must not touch the DOM.' },
        { name: 'localStorage', message: 'Persistence belongs outside src/sim.' },
      ],
    },
  },
);
