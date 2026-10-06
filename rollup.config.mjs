import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import serve from 'rollup-plugin-serve';
import { execSync } from 'node:child_process';

const dev = process.env.ROLLUP_WATCH;

// The release workflow passes the tag; local builds describe the checkout.
function cardVersion() {
  if (process.env.CARD_VERSION) {
    return process.env.CARD_VERSION;
  }
  try {
    return execSync('git describe --tags --always --dirty', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

const serveopts = {
  contentBase: ['./dist'],
  host: '0.0.0.0',
  port: 5005,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

export default {
  input: 'src/nordpool-scheduler-card.ts',
  output: {
    file: 'dist/nordpool-scheduler-card.js',
    format: 'es',
    sourcemap: dev ? true : false,
    inlineDynamicImports: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: { __CARD_VERSION__: JSON.stringify(cardVersion()) },
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      sourceMap: dev ? true : false,
    }),
    json(),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
    }),
    !dev && terser(),
    dev && serve(serveopts),
  ].filter(Boolean),
  watch: {
    exclude: 'node_modules/**',
  },
};
