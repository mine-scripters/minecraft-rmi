const ts = require('rollup-plugin-ts');
const nodeResolve = require('@rollup/plugin-node-resolve');

module.exports = [
  {
    input: 'src/index.ts',
    external: ['@minecraft/server'],
    output: [
      {
        file: 'dist/MinecraftRMI.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [
      ts({
        tsconfig: (resolvedOptions) => ({
          ...resolvedOptions,
        }),
      }),
      nodeResolve(),
    ],
  },
];
