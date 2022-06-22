import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import typescript from '@rollup/plugin-typescript';

import type { OutputOptions, RollupOptions } from 'rollup';

function resolvePath(path: string) {
  return fileURLToPath(new URL(path, import.meta.url));
}

const version = process.env.VERSION
  || JSON.parse(readFileSync(resolvePath('../package.json')).toString()).version;

// eslint-disable-next-line operator-linebreak
const banner =
`/**
 * mock-xmlhttprequest v${version}
 * (c) ${new Date().getFullYear()} Bertrand Guay-Paquet
 * @license ISC
 */`;

const commonOutputOptions: Partial<OutputOptions> = {
  banner,
  generatedCode: 'es2015',
  name: 'MockXMLHttpRequest',
  sourcemap: true,
};

const outputOptions: OutputOptions[] = [
  {
    ...commonOutputOptions,
    format: 'cjs',
    preserveModules: true,
    dir: resolvePath('../dist/cjs'),
    entryFileNames: '[name].cjs',
    exports: 'auto', // Gets rid of a warning. All library exports are named so we're fine.
  },
  {
    ...commonOutputOptions,
    format: 'es',
    preserveModules: true,
    dir: resolvePath('../dist/esm'),
    entryFileNames: '[name].mjs',
  },
];

const config: RollupOptions = {
  input: resolvePath('../src/index.ts'),
  output: outputOptions,
  plugins: [
    typescript({
      tsconfig: resolvePath('../tsconfig.json'),
    }),
  ],
};

export default config;
