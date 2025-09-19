#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { compileSprout } from './compiler';

const args = process.argv.slice(2);

if (args.length === 0) {
  printUsage();
  process.exit(1);
}

const input = args[0];
if (!input) {
  throw new Error('Input path is required');
}
const output = args[1];
const inputPath = path.resolve(process.cwd(), input);
const outputPath = resolveOutputPath(inputPath, output);
const runtimeSource = loadRuntime();

const source = fs.readFileSync(inputPath, 'utf8');
if (inputPath.endsWith('.html')) {
  const result = transformHtml(source, runtimeSource);
  fs.writeFileSync(outputPath, result, 'utf8');
  console.log(`Sprout: wrote ${path.relative(process.cwd(), outputPath)}`);
} else {
  const compiled = compileSprout(source);
  const combined = `${runtimeSource}\n${compiled.code}`;
  fs.writeFileSync(outputPath, combined, 'utf8');
  console.log(`Sprout: wrote ${path.relative(process.cwd(), outputPath)}`);
}

function transformHtml(html: string, runtime: string): string {
  let injected = false;
  return html.replace(
    /<script\s+[^>]*type=["']text\/sprout["'][^>]*>([\s\S]*?)<\/script>/gi,
    (_, scriptBody: string) => {
      const compiled = compileSprout(scriptBody).code;
      const runtimeTag = injected ? '' : `<script>\n${runtime}\n</script>\n`;
      injected = true;
      return `${runtimeTag}<script>\n${compiled}</script>`;
    },
  );
}

function resolveOutputPath(input: string, requested?: string): string {
  if (requested) {
    return path.resolve(process.cwd(), requested);
  }
  if (input.endsWith('.html')) {
    const dir = path.dirname(input);
    const name = path.basename(input, '.html');
    return path.join(dir, `${name}.compiled.html`);
  }
  const dir = path.dirname(input);
  const name = path.basename(input, path.extname(input));
  return path.join(dir, `${name}.js`);
}

function loadRuntime(): string {
  const runtimePath = path.resolve(__dirname, 'runtime.js');
  if (!fs.existsSync(runtimePath)) {
    throw new Error('Runtime bundle not found. Run `npm run build` first.');
  }
  return fs.readFileSync(runtimePath, 'utf8');
}

function printUsage(): void {
  console.log('Usage: sprout <input> [output]');
  console.log('  input: .sprout script or .html file containing <script type="text/sprout"> tags');
  console.log('  output: optional output file path');
}
