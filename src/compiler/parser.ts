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
  IdentifierExpression,
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
  ThenClause,
  ToggleStatement,
  UnaryExpression,
} from './ast';
import { Token, Tokenizer } from './tokenizer';

type BinaryExpression = import('./ast').BinaryExpression;
type ListExpression = import('./ast').ListExpression;

type TokenType = import('./tokenizer').TokenType;

export class Parser {
  private tokens: Token[];
  private position = 0;

  constructor(private readonly source: string) {
    const tokenizer = new Tokenizer(source);
    this.tokens = tokenizer.tokenize();
  }

  parse(): Program {
    const body: Statement[] = [];
    while (!this.is(TokenTypeEnum.EOF)) {
      this.skipNewlines();
      if (this.is(TokenTypeEnum.EOF)) {
        break;
      }
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    return { type: 'Program', body };
  }

  private parseStatement(): Statement {
    const token = this.peek();
    if (token.type === 'identifier') {
      switch (token.value) {
        case 'let':
          return this.parseLet();
        case 'listen':
          return this.parseListen();
        case 'set':
          return this.parseSet();
        case 'add':
          return this.parseAdd();
        case 'toggle':
          return this.parseToggle();
        case 'send':
          return this.parseSend();
        case 'template':
          return this.parseTemplate();
        case 'bind':
          return this.parseBind();
        case 'call':
          return this.parseCallJs();
        case 'if':
          return this.parseIf();
        case 'for':
          return this.parseFor();
      }
    }

    if (this.looksLikeAssignment()) {
      return this.parseAssignment();
    }

    const expression = this.parseExpression();
    return { type: 'ExpressionStatement', expression };
  }

  private parseLet(): LetStatement {
    this.consumeIdentifier('let');
    const name = this.consumeIdentifierValue();
    this.consumeOperator('=');
    const value = this.parseExpression();
    return { type: 'LetStatement', name, value };
  }

  private parseAssignment(): AssignmentStatement {
    const target = this.parseExpression();
    this.consumeOperator('=');
    const value = this.parseExpression();
    return { type: 'AssignmentStatement', target, value };
  }

  private parseListen(): ListenStatement {
    this.consumeIdentifier('listen');
    const selector = this.parseExpression();
    const eventToken = this.consumeIdentifierToken();
    const body = this.parseBlock();
    return {
      type: 'ListenStatement',
      selector,
      event: eventToken.value,
      body,
    };
  }

  private parseSet(): SetStatement {
    this.consumeIdentifier('set');
    const target = this.parseExpression();
    const property = this.consumeIdentifierToken().value;
    let extra: Expression | undefined;
    if (property === 'attr' || property === 'css' || property === 'data') {
      extra = this.parseExpression();
    }
    this.consumeIdentifier('to');
    const value = this.parseExpression();
    const statement: SetStatement = { type: 'SetStatement', target, property, value };
    if (extra !== undefined) {
      statement.extra = extra;
    }
    return statement;
  }

  private parseAdd(): AddStatement {
    this.consumeIdentifier('add');
    const target = this.parseExpression();
    const property = this.consumeIdentifierToken().value;
    this.consumeIdentifier('with');
    const value = this.parseExpression();
    return { type: 'AddStatement', target, property, value };
  }

  private parseToggle(): ToggleStatement {
    this.consumeIdentifier('toggle');
    const target = this.parseExpression();
    const modeToken = this.consumeIdentifierToken();
    if (modeToken.value === 'class') {
      const argument = this.parseExpression();
      return { type: 'ToggleStatement', target, mode: 'class', argument };
    }
    if (modeToken.value === 'show' || modeToken.value === 'hide') {
      return { type: 'ToggleStatement', target, mode: modeToken.value };
    }
    throw this.error(`Unknown toggle mode '${modeToken.value}'`, modeToken);
  }

  private parseSend(): SendStatement {
    this.consumeIdentifier('send');
    const url = this.parseExpression();
    const method = this.consumeIdentifierToken().value;
    const payload = this.parseExpression();
    const chain: ThenClause[] = [];
    while (true) {
      this.skipNewlines();
      if (!this.peekIdentifier('then')) {
        break;
      }
      chain.push(this.parseThenClause());
    }
    return { type: 'SendStatement', url, method, payload, chain };
  }

  private parseThenClause(): ThenClause {
    this.consumeIdentifier('then');
    const body = this.parseLambdaBlock();
    return { params: body.params, body: body.body };
  }

  private parseLambdaBlock(): { params: string[]; body: BlockStatement } {
    this.consumePunctuation('{');
    this.skipNewlines();
    const params = this.parseLambdaParameters();
    this.consumeOperator('->');
    const body = this.parseBlockBody();
    this.consumePunctuation('}');
    return { params, body };
  }

  private parseLambdaParameters(): string[] {
    if (this.peekOperator('->')) {
      return [];
    }
    if (this.peekPunctuation('(')) {
      this.consumePunctuation('(');
      const params: string[] = [];
      if (!this.peekPunctuation(')')) {
        do {
          params.push(this.consumeIdentifierValue());
        } while (this.consumeIfPunctuation(','));
      }
      this.consumePunctuation(')');
      return params;
    }
    return [this.consumeIdentifierValue()];
  }

  private parseTemplate(): TemplateStatement {
    this.consumeIdentifier('template');
    const name = this.consumeIdentifierValue();
    this.consumeOperator('=');
    const templateToken = this.consumeType('string');
    const template = templateToken.value.slice(1, -1);
    return { type: 'TemplateStatement', name, template };
  }

  private parseBind(): BindStatement {
    this.consumeIdentifier('bind');
    const source = this.parseExpression();
    this.consumeIdentifier('to');
    const selector = this.parseExpression();
    const property = this.consumeIdentifierToken().value;
    return { type: 'BindStatement', source, selector, property };
  }

  private parseCallJs(): CallJsStatement {
    this.consumeIdentifier('call');
    this.consumeIdentifier('js');
    const functionName = this.parseExpression();
    let payload: Expression | undefined;
    if (this.peekIdentifier('with')) {
      this.consumeIdentifier('with');
      payload = this.parseExpression();
    }
    const statement: CallJsStatement = { type: 'CallJsStatement', functionName };
    if (payload !== undefined) {
      statement.payload = payload;
    }
    return statement;
  }

  private parseIf(): IfStatement {
    this.consumeIdentifier('if');
    const test = this.parseExpression();
    const consequent = this.parseBlock();
    let alternate: BlockStatement | IfStatement | undefined;
    if (this.peekIdentifier('else')) {
      this.consumeIdentifier('else');
      if (this.peekIdentifier('if')) {
        alternate = this.parseIf();
      } else {
        alternate = this.parseBlock();
      }
    }
    const statement: IfStatement = { type: 'IfStatement', test, consequent };
    if (alternate) {
      statement.alternate = alternate;
    }
    return statement;
  }

  private parseFor(): ForStatement {
    this.consumeIdentifier('for');
    const variable = this.consumeIdentifierValue();
    this.consumeIdentifier('in');
    const iterable = this.parseExpression();
    const body = this.parseBlock();
    return { type: 'ForStatement', variable, iterable, body };
  }

  private parseBlock(): BlockStatement {
    this.consumePunctuation('{');
    const body: Statement[] = [];
    this.skipNewlines();
    while (!this.peekPunctuation('}')) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    this.consumePunctuation('}');
    return { type: 'BlockStatement', body };
  }

  private parseBlockBody(): BlockStatement {
    const body: Statement[] = [];
    this.skipNewlines();
    while (!this.peekPunctuation('}')) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    return { type: 'BlockStatement', body };
  }

  private parseExpression(): Expression {
    return this.parseLambdaExpression();
  }

  private parseLambdaExpression(): Expression {
    if (this.peekOperator('->')) {
      this.consumeOperator('->');
      const body = this.parseLambdaBody();
      return { type: 'LambdaExpression', params: [], body };
    }
    const expression = this.parseLogicalExpression();
    if (this.peekOperator('->')) {
      if (expression.type === 'Identifier') {
        const paramName = expression.name;
        this.consumeOperator('->');
        const body = this.parseLambdaBody();
        return { type: 'LambdaExpression', params: [paramName], body };
      }
      if (expression.type === 'Group') {
        const params = this.extractParams(expression);
        this.consumeOperator('->');
        const body = this.parseLambdaBody();
        return { type: 'LambdaExpression', params, body };
      }
      throw this.error('Invalid lambda parameters');
    }
    return expression;
  }

  private extractParams(group: import('./ast').GroupExpression): string[] {
    const expr = group.expression;
    if (expr.type === 'Identifier') {
      return [expr.name];
    }
    if (expr.type === 'CallExpression') {
      throw this.error('Unexpected call in lambda parameters');
    }
    if (expr.type === 'BinaryExpression' && expr.operator === ',') {
      throw this.error('Comma operator is not supported');
    }
    if (expr.type === 'ListExpression') {
      return expr.elements.map((el) => {
        if (el.type !== 'Identifier') {
          throw this.error('Lambda parameters must be identifiers');
        }
        return el.name;
      });
    }
    if (expr.type === 'MapExpression') {
      throw this.error('Lambda parameters must be identifiers');
    }
    if (expr.type === 'Group') {
      return this.extractParams(expr);
    }
    throw this.error('Unsupported lambda parameters');
  }

  private parseLambdaBody(): BlockStatement | Expression {
    if (this.peekPunctuation('{')) {
      return this.parseBlock();
    }
    return this.parseExpression();
  }

  private parseLogicalExpression(): Expression {
    let left = this.parseEqualityExpression();
    while (this.peekOperator('&&') || this.peekOperator('||')) {
      const operator = this.consumeType('operator').value as '&&' | '||';
      const right = this.parseEqualityExpression();
      left = { type: 'LogicalExpression', operator, left, right };
    }
    return left;
  }

  private parseEqualityExpression(): Expression {
    let left = this.parseRelationalExpression();
    while (this.peekOperator('==') || this.peekOperator('!=')) {
      const operator = this.consumeType('operator').value;
      const right = this.parseRelationalExpression();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    return left;
  }

  private parseRelationalExpression(): Expression {
    let left = this.parseAdditiveExpression();
    while (
      this.peekOperator('>') ||
      this.peekOperator('>=') ||
      this.peekOperator('<') ||
      this.peekOperator('<=')
    ) {
      const operator = this.consumeType('operator').value;
      const right = this.parseAdditiveExpression();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    return left;
  }

  private parseAdditiveExpression(): Expression {
    let left = this.parseMultiplicativeExpression();
    while (this.peekOperator('+') || this.peekOperator('-')) {
      const operator = this.consumeType('operator').value;
      const right = this.parseMultiplicativeExpression();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    return left;
  }

  private parseMultiplicativeExpression(): Expression {
    let left = this.parseUnaryExpression();
    while (this.peekOperator('*') || this.peekOperator('/') || this.peekOperator('%')) {
      const operator = this.consumeType('operator').value;
      const right = this.parseUnaryExpression();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    return left;
  }

  private parseUnaryExpression(): Expression {
    if (this.peekOperator('!') || this.peekOperator('-')) {
      const operator = this.consumeType('operator').value;
      const argument = this.parseUnaryExpression();
      return { type: 'UnaryExpression', operator, argument };
    }
    return this.parseCallMemberExpression();
  }

  private parseCallMemberExpression(): Expression {
    let expression = this.parsePrimaryExpression();
    while (true) {
      if (this.peekPunctuation('.')) {
        this.consumePunctuation('.');
        const property = this.consumeIdentifierValue();
        expression = { type: 'MemberExpression', object: expression, property };
        continue;
      }
      if (this.peekPunctuation('(')) {
        this.consumePunctuation('(');
        const args: Expression[] = [];
        if (!this.peekPunctuation(')')) {
          do {
            args.push(this.parseExpression());
          } while (this.consumeIfPunctuation(','));
        }
        this.consumePunctuation(')');
        expression = { type: 'CallExpression', callee: expression, arguments: args };
        continue;
      }
      break;
    }
    return expression;
  }

  private parsePrimaryExpression(): Expression {
    const token = this.peek();
    if (token.type === 'identifier') {
      switch (token.value) {
        case 'true':
          this.position += 1;
          return { type: 'Literal', literalType: 'bool', value: true };
        case 'false':
          this.position += 1;
          return { type: 'Literal', literalType: 'bool', value: false };
        case 'render':
          return this.parseRender();
        case 'get':
          return this.parseGet();
      }
      this.position += 1;
      return { type: 'Identifier', name: token.value };
    }
    if (token.type === 'number') {
      this.position += 1;
      return {
        type: 'Literal',
        literalType: 'number',
        value: Number(token.value),
      };
    }
    if (token.type === 'string') {
      this.position += 1;
      return {
        type: 'Literal',
        literalType: 'text',
        value: token.value.slice(1, -1),
      };
    }
    if (this.peekPunctuation('(')) {
      this.consumePunctuation('(');
      const expression = this.parseExpression();
      this.consumePunctuation(')');
      return { type: 'Group', expression };
    }
    if (this.peekPunctuation('[')) {
      return this.parseList();
    }
    if (this.peekPunctuation('{')) {
      return this.parseMap();
    }
    throw this.error('Unexpected token in expression', token);
  }

  private parseList(): ListExpression {
    this.consumePunctuation('[');
    const elements: Expression[] = [];
    if (!this.peekPunctuation(']')) {
      do {
        elements.push(this.parseExpression());
      } while (this.consumeIfPunctuation(','));
    }
    this.consumePunctuation(']');
    return { type: 'ListExpression', elements };
  }

  private parseMap(): MapExpression {
    this.consumePunctuation('{');
    const entries: MapExpression['entries'] = [];
    if (!this.peekPunctuation('}')) {
      do {
        const keyToken = this.peek();
        let key: string;
        if (keyToken.type === 'identifier') {
          key = keyToken.value;
          this.position += 1;
        } else if (keyToken.type === 'string') {
          key = keyToken.value.slice(1, -1);
          this.position += 1;
        } else {
          throw this.error('Expected map key', keyToken);
        }
        this.consumePunctuation(':');
        const value = this.parseExpression();
        entries.push({ key, value });
      } while (this.consumeIfPunctuation(','));
    }
    this.consumePunctuation('}');
    return { type: 'MapExpression', entries };
  }

  private parseRender(): RenderExpression {
    this.consumeIdentifier('render');
    const nameToken = this.peek();
    let name: string;
    if (nameToken.type === 'identifier') {
      name = nameToken.value;
      this.position += 1;
    } else if (nameToken.type === 'string') {
      name = nameToken.value.slice(1, -1);
      this.position += 1;
    } else {
      throw this.error('Expected template name', nameToken);
    }
    this.consumeIdentifier('with');
    const value = this.parseExpression();
    return { type: 'RenderExpression', template: name, value };
  }

  private parseGet(): GetExpression {
    this.consumeIdentifier('get');
    const target = this.parseExpression();
    const property = this.consumeIdentifierToken().value;
    let extra: Expression | undefined;
    if (property === 'attr' || property === 'css' || property === 'data') {
      extra = this.parseExpression();
    }
    const expression: GetExpression = { type: 'GetExpression', target, property };
    if (extra !== undefined) {
      expression.extra = extra;
    }
    return expression;
  }

  private looksLikeAssignment(): boolean {
    let depth = 0;
    let index = this.position;
    while (index < this.tokens.length) {
      const token = this.tokens[index];
      if (!token) {
        break;
      }
      if (token.type === 'newline') {
        break;
      }
      if (token.type === 'punctuation') {
        if (token.value === '(' || token.value === '[' || token.value === '{') {
          depth += 1;
        } else if (token.value === ')' || token.value === ']' || token.value === '}') {
          if (depth === 0) {
            break;
          }
          depth -= 1;
        }
      }
      if (depth === 0 && token.type === 'operator' && token.value === '=') {
        return true;
      }
      if (token.type === 'eof') {
        break;
      }
      index += 1;
    }
    return false;
  }

  private consumeIdentifier(value: string): void {
    const token = this.consumeIdentifierToken();
    if (token.value !== value) {
      throw this.error(`Expected '${value}'`, token);
    }
  }

  private consumeIdentifierToken(): Token {
    const token = this.peek();
    if (token.type !== 'identifier') {
      throw this.error('Expected identifier', token);
    }
    this.position += 1;
    return token;
  }

  private consumeIdentifierValue(): string {
    return this.consumeIdentifierToken().value;
  }

  private consumeOperator(value: string): void {
    const token = this.peek();
    if (token.type !== 'operator' || token.value !== value) {
      throw this.error(`Expected operator '${value}'`, token);
    }
    this.position += 1;
  }

  private consumeType(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw this.error(`Expected ${type}`, token);
    }
    this.position += 1;
    return token;
  }

  private consumePunctuation(value: string): void {
    const token = this.peek();
    if (token.type !== 'punctuation' || token.value !== value) {
      throw this.error(`Expected '${value}'`, token);
    }
    this.position += 1;
  }

  private consumeIfPunctuation(value: string): boolean {
    const token = this.peek();
    if (token.type === 'punctuation' && token.value === value) {
      this.position += 1;
      return true;
    }
    return false;
  }

  private peek(): Token {
    const token = this.tokens[this.position];
    if (!token) {
      throw this.error('Unexpected end of input', this.tokens[this.tokens.length - 1]);
    }
    return token;
  }

  private peekAhead(offset: number): Token {
    const token = this.tokens[this.position + offset];
    if (!token) {
      throw this.error('Unexpected end of input', this.tokens[this.tokens.length - 1]);
    }
    return token;
  }

  private peekIdentifier(value: string): boolean {
    const token = this.peek();
    return token.type === 'identifier' && token.value === value;
  }

  private peekOperator(value: string): boolean {
    const token = this.peek();
    return token.type === 'operator' && token.value === value;
  }

  private peekPunctuation(value: string): boolean {
    const token = this.peek();
    return token.type === 'punctuation' && token.value === value;
  }

  private skipNewlines(): void {
    while (this.peek().type === 'newline') {
      this.position += 1;
    }
  }

  private error(message: string, token: Token = this.peek()): Error {
    return new Error(`${message} (line ${token.line}, column ${token.column})`);
  }

  private is(type: TokenTypeEnum): boolean {
    return this.peek().type === type;
  }
}

const enum TokenTypeEnum {
  Identifier = 'identifier',
  Number = 'number',
  String = 'string',
  Operator = 'operator',
  Punctuation = 'punctuation',
  Newline = 'newline',
  EOF = 'eof',
}
