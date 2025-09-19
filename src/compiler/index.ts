import { CodeGenerator } from './codegen';
import { Parser } from './parser';

export interface CompileResult {
  code: string;
}

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
