"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileSprout = compileSprout;
const codegen_1 = require("./codegen");
const parser_1 = require("./parser");
function compileSprout(source) {
    const parser = new parser_1.Parser(source);
    const program = parser.parse();
    const generator = new codegen_1.CodeGenerator();
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
function indentLines(text, level) {
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
//# sourceMappingURL=index.js.map