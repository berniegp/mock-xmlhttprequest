import { openSync, readFileSync, readdirSync, renameSync, writeSync } from 'node:fs';
import { rollup } from 'rollup';
import typescript from '@rollup/plugin-typescript';

import type { ModuleFormat, OutputOptions, RollupBuild } from 'rollup';
import { join } from 'node:path';

const packageRoot = join(import.meta.dirname, '..');

const version = process.env.VERSION ??
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version as string;

const banner = `/**
 * mock-xmlhttprequest v${version}
 * (c) ${new Date().getFullYear()} Bertrand Guay-Paquet
 * @license MIT
 */
`;

const entryPoint = join(packageRoot, 'src', 'index.ts');

const commonOutputOptions: Partial<OutputOptions> = {
  banner,
  generatedCode: 'es2015',
  preserveModules: true,
};

const tsconfigPath = join(packageRoot, 'tsconfig.json');

const outDir = join(packageRoot, 'dist');

const outputs = [
  {
    format: 'esm' as ModuleFormat,
    jsExt: 'mjs',
    dtsExt: 'mts',
  }, {
    format: 'cjs' as ModuleFormat,
    jsExt: 'cjs',
    dtsExt: 'cts',
  },
];

await build();

async function build() {
  let buildFailed = false;
  for (const output of outputs) {
    let codeBundle: RollupBuild | undefined;
    try {
      // rollup() currently produces this warning:
      //   [plugin typescript] @rollup/plugin-typescript TS5096: Option 'allowImportingTsExtensions'
      //   can only be used when either 'noEmit' or 'emitDeclarationOnly' is set.
      // However the actual outputs are fine. We'll ignore this warning for now and re-evaluate when
      // TypeScript 5.7 is released with the new "Path Rewriting for Relative Paths" feature.
      // See also https://github.com/rollup/plugins/discussions/1536
      const dir = join(outDir, output.format);
      const outputOptions: OutputOptions = {
        ...commonOutputOptions,
        format: output.format,
        preserveModules: true,
        dir,
        entryFileNames: `[name].${output.jsExt}`,
      };

      codeBundle = await rollup({
        input: entryPoint,
        plugins: [
          typescript({
            tsconfig: tsconfigPath,
            declarationDir: outputOptions.dir,
            compilerOptions: {
              declaration: true,
            },
          }),
        ],
      });

      await codeBundle.write(outputOptions);

      fixupDeclarationFiles(dir, output.dtsExt);
    } catch (e) {
      buildFailed = true;
      console.error(e);
    } finally {
      if (codeBundle) {
        await codeBundle.close();
      }
    }
  }

  process.exit(buildFailed ? 1 : 0);
}

function fixupDeclarationFiles(dir: string, newFileExtension: string) {
  const files = readdirSync(dir, { recursive: true }) as string[];
  for (const file of files) {
    if (file.endsWith('.d.ts')) {
      const filePath = join(dir, file);

      let fileContent = readFileSync(filePath, 'utf8');

      // Change the '.ts' file extension in imports of the declaration files
      // e.g. import ... from './RequestData.ts'; => import ... from './RequestData.mts';
      fileContent = fileContent.replaceAll(/(['"][^'"]*\.)ts(['"])/g, `$1${newFileExtension}$2`);

      const fd = openSync(filePath, 'w');

      // Add the copyright header
      writeSync(fd, banner);
      writeSync(fd, '\n');
      writeSync(fd, fileContent);

      // Rename the declaration file to the new file extension
      renameSync(filePath, join(dir, `${file.slice(0, -2)}${newFileExtension}`));
    }
  }
}
