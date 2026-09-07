import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,

  {
    rules: {
      /*
       * Next 16 / React Hooks introduced these checks after this codebase
       * was established. Existing behavior is covered by type/tests/build.
       * Migrate legacy components incrementally outside the P66 release.
       */
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },

  globalIgnores([
    '.next/**',
    'node_modules/**',
    'coverage/**',
    'dist/**',
  ]),
]);