#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const compiler_1 = require("./compiler");
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
const inputPath = path_1.default.resolve(process.cwd(), input);
const outputPath = resolveOutputPath(inputPath, output);
const runtimeSource = loadRuntime();
const source = fs_1.default.readFileSync(inputPath, 'utf8');
if (inputPath.endsWith('.html')) {
    const result = transformHtml(source, runtimeSource);
    fs_1.default.writeFileSync(outputPath, result, 'utf8');
    console.log(`Sprout: wrote ${path_1.default.relative(process.cwd(), outputPath)}`);
}
else {
    const compiled = (0, compiler_1.compileSprout)(source);
    const combined = `${runtimeSource}\n${compiled.code}`;
    fs_1.default.writeFileSync(outputPath, combined, 'utf8');
    console.log(`Sprout: wrote ${path_1.default.relative(process.cwd(), outputPath)}`);
}
function transformHtml(html, runtime) {
    let injected = false;
    return html.replace(/<script\s+[^>]*type=["']text\/sprout["'][^>]*>([\s\S]*?)<\/script>/gi, (_, scriptBody) => {
        const compiled = (0, compiler_1.compileSprout)(scriptBody).code;
        const runtimeTag = injected ? '' : `<script>\n${runtime}\n</script>\n`;
        injected = true;
        return `${runtimeTag}<script>\n${compiled}</script>`;
    });
}
function resolveOutputPath(input, requested) {
    if (requested) {
        return path_1.default.resolve(process.cwd(), requested);
    }
    if (input.endsWith('.html')) {
        const dir = path_1.default.dirname(input);
        const name = path_1.default.basename(input, '.html');
        return path_1.default.join(dir, `${name}.compiled.html`);
    }
    const dir = path_1.default.dirname(input);
    const name = path_1.default.basename(input, path_1.default.extname(input));
    return path_1.default.join(dir, `${name}.js`);
}
function loadRuntime() {
    const runtimePath = path_1.default.resolve(__dirname, 'runtime.js');
    if (!fs_1.default.existsSync(runtimePath)) {
        throw new Error('Runtime bundle not found. Run `npm run build` first.');
    }
    return fs_1.default.readFileSync(runtimePath, 'utf8');
}
function printUsage() {
    console.log('Usage: sprout <input> [output]');
    console.log('  input: .sprout script or .html file containing <script type="text/sprout"> tags');
    console.log('  output: optional output file path');
}
//# sourceMappingURL=cli.js.map