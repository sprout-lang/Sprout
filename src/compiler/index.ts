import { CodeGenerator } from './codegen';
import { Parser } from './parser';

export interface CompileResult {
  code: string;
}

/**
 * Compile Sprout source into a runnable JavaScript string.
 *
 * Parses the provided Sprout source, generates JavaScript for the parsed program,
 * and wraps the generated body in a `Sprout.run((sprout) => { ... });` scaffold that
 * exposes `sprout.state` as `state` and selected `sprout.std` utilities
 * (`time`, `random`, `list`, `json`, `url`). The returned `code` is the complete
 * script ready to be executed.
 *
 * @param source - Sprout source code to compile
 * @returns An object containing the compiled code string as `code`
 */
export function compileSprout(source: string): CompileResult {
  const parser = new Parser(source);
  const program = parser.parse();
  const generator = new CodeGenerator();
  const body = generator.generate(program);
  const prelude = [
    'Sprout.run((sprout) => {',
    '  const state = sprout.state;',
    '  const std = sprout.std;',
    '  const { time, random, list, json, url } = std;',
    '',
  ].join('\n');
  const indentedBody = indentLines(body, 1);
  const code = `${prelude}${indentedBody}});\n`;
  return { code };
}

/**
 * Indents each non-empty line of `text` by `level` indentation levels (two spaces per level).
 *
 * Empty lines are preserved except for a trailing empty line at the very end of `text`, which is removed before indentation.
 * The returned string always ends with a single newline.
 *
 * @param text - The multi-line string to indent.
 * @param level - Number of indentation levels to apply; each level equals two spaces.
 * @returns The indented string with a trailing newline.
 */
function indentLines(text: string, level: number): string {
  if (!text) {
    return '';
  }
  const prefix = '  '.repeat(level);
  return text
    .split('\n')
    .filter((line, index, array) => !(line === '' && index === array.length - 1))
    .map((line) => (line ? `${prefix}${line}` : line))
    .join('\n')
    .concat('\n');
}
