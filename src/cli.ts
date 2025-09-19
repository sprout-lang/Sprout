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

/**
 * Replaces all `<script type="text/sprout">...</script>` blocks in an HTML string with compiled JavaScript script blocks,
 * injecting a single runtime script tag once before the first compiled block.
 *
 * The function performs a case-insensitive global search for `<script>` tags whose `type` is `text/sprout`. For each match
 * it compiles the script body using `compileSprout(...).code` and replaces the original block with:
 *   - a single `<script>` containing the provided `runtime` (inserted only before the first compiled block), and
 *   - a `<script>` containing the compiled code.
 *
 * @param html - The input HTML text to transform.
 * @param runtime - The runtime bundle source to inject (inserted as a `<script>` before the first compiled block).
 * @returns The transformed HTML with all Sprout script blocks replaced by executable JavaScript.
 */
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

/**
 * Compute the absolute output path for a given input file and optional requested output.
 *
 * If `requested` is provided it is resolved against the current working directory and returned.
 * Otherwise:
 * - For inputs ending with `.html` returns the same directory with a `<basename>.compiled.html` filename.
 * - For other inputs returns the same directory with a `<basename>.js` filename (basename excludes the input extension).
 *
 * @param input - Path to the input file (can be relative or absolute); used to derive the default output filename when `requested` is not provided.
 * @param requested - Optional output path; when present it is resolved to an absolute path relative to the current working directory.
 * @returns An absolute or filesystem path for the output file.
 */
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

/**
 * Loads the compiled runtime bundle and returns its contents as a string.
 *
 * Reads the `runtime.js` file located next to the CLI script and returns its UTF-8 contents.
 *
 * @returns The runtime bundle file contents.
 * @throws Error if the runtime bundle cannot be found (suggests running `npm run build`).
 */
function loadRuntime(): string {
  const runtimePath = path.resolve(__dirname, 'runtime.js');
  if (!fs.existsSync(runtimePath)) {
    throw new Error('Runtime bundle not found. Run `npm run build` first.');
  }
  return fs.readFileSync(runtimePath, 'utf8');
}

/**
 * Print CLI usage instructions to stdout.
 *
 * Displays the expected command format and brief descriptions of the required
 * input (a `.sprout` script or an `.html` file with `<script type="text/sprout">`
 * blocks) and the optional output path.
 */
function printUsage(): void {
  console.log('Usage: sprout <input> [output]');
  console.log('  input: .sprout script or .html file containing <script type="text/sprout"> tags');
  console.log('  output: optional output file path');
}
