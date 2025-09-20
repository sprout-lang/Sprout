import {
  AddStatement,
  AssignmentStatement,
  BindStatement,
  BlockStatement,
  CallJsStatement,
  Expression,
  ExpressionStatement,
  ForStatement,
  GetExpression,
  IfStatement,
  LambdaExpression,
  LetStatement,
  ListenStatement,
  LiteralExpression,
  LogicalExpression,
  MapExpression,
  MemberExpression,
  Program,
  RenderExpression,
  SendStatement,
  SetStatement,
  Statement,
  TemplateStatement,
  ToggleStatement,
  UnaryExpression,
} from './ast';

// Escape potentially dangerous chars when embedding in JavaScript code
const charMap: Record<string, string> = {
  '<': '\\u003C',
  '>': '\\u003E',
  '/': '\\u002F',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\0': '\\0',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
};
function escapeUnsafeChars(str: string): string {
  return str.replace(/[<>\b\f\n\r\t\0\u2028\u2029/\\]/g, x => charMap[x] || x);
}

type BinaryExpression = import('./ast').BinaryExpression;
type ExpressionNode = import('./ast').Expression;

type Precedence = number;

export class CodeGenerator {
  private output: string[] = [];
  private indentLevel = 0;

  generate(program: Program): string {
    for (const statement of program.body) {
      this.generateStatement(statement);
    }
    return this.output.join('');
  }

  private generateStatement(statement: Statement): void {
    switch (statement.type) {
      case 'LetStatement':
        this.emitLine(`let ${statement.name} = ${this.generateExpression(statement.value)};`);
        break;
      case 'AssignmentStatement':
        this.emitLine(
          `${this.generateExpression(statement.target)} = ${this.generateExpression(statement.value)};`,
        );
        break;
      case 'ListenStatement':
        this.generateListen(statement);
        break;
      case 'SetStatement':
        this.generateSet(statement);
        break;
      case 'AddStatement':
        this.generateAdd(statement);
        break;
      case 'ToggleStatement':
        this.generateToggle(statement);
        break;
      case 'SendStatement':
        this.generateSend(statement);
        break;
      case 'TemplateStatement':
        this.emitLine(
          `sprout.defineTemplate(${JSON.stringify(statement.name)}, ${JSON.stringify(statement.template)});`,
        );
        break;
      case 'BindStatement':
        this.generateBind(statement);
        break;
      case 'CallJsStatement':
        this.generateCallJs(statement);
        break;
      case 'IfStatement':
        this.generateIf(statement);
        break;
      case 'ForStatement':
        this.generateFor(statement);
        break;
      case 'ExpressionStatement':
        this.emitLine(`${this.generateExpression(statement.expression)};`);
        break;
      default:
        throw new Error(`Unsupported statement type ${(statement as Statement).type}`);
    }
  }

  private generateListen(statement: ListenStatement): void {
    const selector = this.generateExpression(statement.selector);
    this.emitLine(`sprout.listen(${selector}, ${JSON.stringify(statement.event)}, (event) => {`);
    this.emitCaptured(this.indentLevel + 1, () => this.generateBlock(statement.body));
    this.emitLine('});');
  }

  private generateSet(statement: SetStatement): void {
    const target = this.generateExpression(statement.target);
    const value = this.generateExpression(statement.value);
    const args = [target, JSON.stringify(statement.property), value];
    if (statement.extra) {
      args.push(this.generateExpression(statement.extra));
    }
    this.emitLine(`sprout.set(${args.join(', ')});`);
  }

  private generateAdd(statement: AddStatement): void {
    const target = this.generateExpression(statement.target);
    const value = this.generateExpression(statement.value);
    this.emitLine(`sprout.add(${target}, ${JSON.stringify(statement.property)}, ${value});`);
  }

  private generateToggle(statement: ToggleStatement): void {
    const target = this.generateExpression(statement.target);
    const argument = statement.argument ? `, ${this.generateExpression(statement.argument)}` : '';
    this.emitLine(`sprout.toggle(${target}, ${JSON.stringify(statement.mode)}${argument});`);
  }

  private generateSend(statement: SendStatement): void {
    const url = this.generateExpression(statement.url);
    const method = JSON.stringify(statement.method.toUpperCase());
    const payload = this.generateExpression(statement.payload);
    if (statement.chain.length === 0) {
      this.emitLine(`sprout.send(${url}, ${method}, ${payload});`);
      return;
    }
    const baseIndent = this.indentLevel;
    const chainIndent = baseIndent + 1;
    this.emitRaw(`${this.indentString(baseIndent)}sprout.send(${url}, ${method}, ${payload})`);
    statement.chain.forEach((clause, clauseIndex) => {
      const params = clause.params.join(', ');
      const body = this.capture(chainIndent + 1, () => this.generateBlock(clause.body));
      this.emitRaw(`\n${this.indentString(chainIndent)}.then((${params}) => {\n${body}${this.indentString(chainIndent)}})`);
      if (clauseIndex === statement.chain.length - 1) {
        this.emitRaw('');
      }
    });
    this.emitRaw(';\n');
    this.indentLevel = baseIndent;
  }

  private generateBind(statement: BindStatement): void {
    const source = this.generateExpression(statement.source);
    const selector = this.generateExpression(statement.selector);
    const property = escapeUnsafeChars(JSON.stringify(statement.property));
    this.emitLine(`sprout.bind(() => ${source}, ${selector}, ${property});`);
  }

  private generateCallJs(statement: CallJsStatement): void {
    const functionName = this.generateExpression(statement.functionName);
    const payload = statement.payload ? `, ${this.generateExpression(statement.payload)}` : '';
    this.emitLine(`sprout.callJs(${functionName}${payload});`);
  }

  private generateIf(statement: IfStatement, isElse = false): void {
    const test = this.generateExpression(statement.test);
    const prefix = isElse ? 'else ' : '';
    this.emitLine(`${prefix}if (${test}) {`);
    this.emitCaptured(this.indentLevel + 1, () => this.generateBlock(statement.consequent));
    this.emitLine('}');
    if (statement.alternate) {
      if (statement.alternate.type === 'IfStatement') {
        this.generateIf(statement.alternate, true);
      } else {
        this.emitLine('else {');
        this.emitCaptured(this.indentLevel + 1, () => this.generateBlock(statement.alternate as BlockStatement));
        this.emitLine('}');
      }
    }
  }

  private generateFor(statement: ForStatement): void {
    const iterable = this.generateExpression(statement.iterable);
    this.emitLine(`for (const ${statement.variable} of sprout.iter(${iterable})) {`);
    this.emitCaptured(this.indentLevel + 1, () => this.generateBlock(statement.body));
    this.emitLine('}');
  }

  private generateBlock(block: BlockStatement): void {
    for (const statement of block.body) {
      this.generateStatement(statement);
    }
  }

  private generateExpression(expression: Expression, parentPrecedence: Precedence = 0): string {
    switch (expression.type) {
      case 'Literal':
        return this.generateLiteral(expression);
      case 'Identifier':
        return expression.name;
      case 'BinaryExpression':
        return this.generateBinary(expression, parentPrecedence);
      case 'LogicalExpression':
        return this.generateLogical(expression, parentPrecedence);
      case 'UnaryExpression':
        return this.generateUnary(expression);
      case 'CallExpression':
        return `${this.generateExpression(expression.callee, 100)}(${expression.arguments
          .map((arg) => this.generateExpression(arg))
          .join(', ')})`;
      case 'MemberExpression':
        return `${this.generateExpression(expression.object, 100)}.${expression.property}`;
      case 'ListExpression':
        return `[${expression.elements.map((el) => this.generateExpression(el)).join(', ')}]`;
      case 'MapExpression':
        return `{${expression.entries
          .map((entry) => `${this.formatObjectKey(entry.key)}: ${this.generateExpression(entry.value)}`)
          .join(', ')}}`;
      case 'LambdaExpression':
        return this.generateLambda(expression);
      case 'RenderExpression':
        return `sprout.render(${JSON.stringify(expression.template)}, ${this.generateExpression(
          expression.value,
        )})`;
      case 'GetExpression':
        return this.generateGet(expression);
      case 'Group':
        return `(${this.generateExpression(expression.expression)})`;
      default:
        throw new Error(`Unsupported expression ${(expression as ExpressionNode).type}`);
    }
  }

  private generateLiteral(expression: LiteralExpression): string {
    if (expression.literalType === 'text') {
      return JSON.stringify(expression.value);
    }
    return String(expression.value);
  }

  private generateBinary(expression: BinaryExpression, parentPrecedence: Precedence): string {
    if (expression.operator === '+') {
      return `sprout.ops.add(${this.generateExpression(expression.left)}, ${this.generateExpression(
        expression.right,
      )})`;
    }
    if (expression.operator === '-') {
      return `sprout.ops.subtract(${this.generateExpression(expression.left)}, ${this.generateExpression(
        expression.right,
      )})`;
    }
    if (expression.operator === '==') {
      return `sprout.ops.equals(${this.generateExpression(expression.left)}, ${this.generateExpression(
        expression.right,
      )})`;
    }
    if (expression.operator === '!=') {
      return `sprout.ops.notEquals(${this.generateExpression(expression.left)}, ${this.generateExpression(
        expression.right,
      )})`;
    }
    const precedence = this.precedenceForOperator(expression.operator);
    const left = this.generateExpression(expression.left, precedence);
    const right = this.generateExpression(expression.right, precedence + 1);
    const result = `${left} ${expression.operator} ${right}`;
    return precedence < parentPrecedence ? `(${result})` : result;
  }

  private generateLogical(expression: LogicalExpression, parentPrecedence: Precedence): string {
    const precedence = expression.operator === '||' ? 1 : 2;
    const left = this.generateExpression(expression.left, precedence);
    const right = this.generateExpression(expression.right, precedence + 1);
    const result = `${left} ${expression.operator} ${right}`;
    return precedence < parentPrecedence ? `(${result})` : result;
  }

  private generateUnary(expression: UnaryExpression): string {
    if (expression.operator === '-') {
      return `sprout.ops.negate(${this.generateExpression(expression.argument)})`;
    }
    if (expression.operator === '!') {
      return `!(${this.generateExpression(expression.argument)})`;
    }
    return `${expression.operator}${this.generateExpression(expression.argument)}`;
  }

  private generateLambda(expression: LambdaExpression): string {
    const params = expression.params.length > 0 ? expression.params.join(', ') : '';
    if (expression.body.type === 'BlockStatement') {
      const blockBody = expression.body;
      const body = this.capture(this.indentLevel + 1, () => this.generateBlock(blockBody));
      return `(${params}) => {\n${body}${this.indentString(this.indentLevel)}}`;
    }
    return `(${params}) => ${this.generateExpression(expression.body)}`;
  }

  private generateGet(expression: GetExpression): string {
    const target = this.generateExpression(expression.target);
    const property = JSON.stringify(expression.property);
    if (expression.extra) {
      return `sprout.get(${target}, ${property}, ${this.generateExpression(expression.extra)})`;
    }
    return `sprout.get(${target}, ${property})`;
  }

  private precedenceForOperator(operator: string): Precedence {
    switch (operator) {
      case '*':
      case '/':
      case '%':
        return 6;
      case '+':
      case '-':
        return 5;
      case '>':
      case '>=':
      case '<':
      case '<=':
        return 4;
      case '==':
      case '!=':
        return 3;
      default:
        return 0;
    }
  }

  private emitLine(line: string): void {
    this.output.push(`${this.indentString(this.indentLevel)}${line}\n`);
  }

  private emitRaw(text: string): void {
    this.output.push(text);
  }

  private emitCaptured(indent: number, fn: () => void): void {
    this.emitRaw(this.capture(indent, fn));
  }

  private capture(indent: number, fn: () => void): string {
    const previousOutput = this.output;
    const previousIndent = this.indentLevel;
    this.output = [];
    this.indentLevel = indent;
    fn();
    const result = this.output.join('');
    this.output = previousOutput;
    this.indentLevel = previousIndent;
    return result;
  }

  private indentString(level: number): string {
    return '  '.repeat(level);
  }

  private formatObjectKey(key: string): string {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key);
  }
}
