export type TokenType =
  | 'identifier'
  | 'number'
  | 'string'
  | 'operator'
  | 'punctuation'
  | 'newline'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const punctuationChars = new Set(['(', ')', '{', '}', '[', ']', ',', '.', ':']);
const singleCharOperators = new Set(['+', '-', '*', '/', '%', '!', '=', '<', '>', '?']);
const pairedOperators = new Set(['==', '!=', '>=', '<=', '&&', '||']);

export class Tokenizer {
  private index = 0;
  private line = 1;
  private column = 1;

  constructor(private readonly source: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (!this.isEOF()) {
      const char = this.peek();
      if (char === '\n') {
        tokens.push(this.createToken('newline', '\n'));
        this.advance();
        this.line += 1;
        this.column = 1;
        continue;
      }

      if (this.isWhitespace(char)) {
        this.advance();
        continue;
      }

      if (char === '"' || char === "'") {
        tokens.push(this.readString());
        continue;
      }

      if (this.isDigit(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      if (this.isIdentifierStart(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      if (char === '-' && this.peekAhead(1) === '>') {
        tokens.push(this.createToken('operator', '->'));
        this.advance();
        this.advance();
        this.column += 2;
        continue;
      }

      const twoChar = char + this.peekAhead(1);
      if (pairedOperators.has(twoChar)) {
        tokens.push(this.createToken('operator', twoChar));
        this.advance();
        this.advance();
        this.column += 2;
        continue;
      }

      if (punctuationChars.has(char)) {
        tokens.push(this.createToken('punctuation', char));
        this.advance();
        this.column += 1;
        continue;
      }

      if (singleCharOperators.has(char)) {
        tokens.push(this.createToken('operator', char));
        this.advance();
        this.column += 1;
        continue;
      }

      throw this.error(`Unexpected character '${char}'`);
    }

    tokens.push(this.createToken('eof', ''));
    return tokens;
  }

  private readString(): Token {
    const quote = this.peek();
    let value = '';
    const startLine = this.line;
    const startColumn = this.column;
    this.advance();
    while (!this.isEOF()) {
      const char = this.peek();
      if (char === '\\') {
        const next = this.peekAhead(1);
        value += char + next;
        this.advance();
        this.advance();
        this.column += 2;
        continue;
      }
      if (char === quote) {
        this.advance();
        this.column += 1;
        return {
          type: 'string',
          value: `${quote}${value}${quote}`,
          line: startLine,
          column: startColumn,
        };
      }
      value += char;
      this.advance();
      this.column += 1;
    }
    throw this.error('Unterminated string literal', startLine, startColumn);
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    while (!this.isEOF() && this.isDigit(this.peek())) {
      value += this.peek();
      this.advance();
      this.column += 1;
    }
    if (!this.isEOF() && this.peek() === '.') {
      value += '.';
      this.advance();
      this.column += 1;
      while (!this.isEOF() && this.isDigit(this.peek())) {
        value += this.peek();
        this.advance();
        this.column += 1;
      }
    }
    return {
      type: 'number',
      value,
      line: startLine,
      column: startColumn,
    };
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    while (!this.isEOF() && this.isIdentifierPart(this.peek())) {
      value += this.peek();
      this.advance();
      this.column += 1;
    }
    return {
      type: 'identifier',
      value,
      line: startLine,
      column: startColumn,
    };
  }

  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\r';
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isIdentifierStart(char: string): boolean {
    return /[A-Za-z_#]/.test(char);
  }

  private isIdentifierPart(char: string): boolean {
    return /[A-Za-z0-9_#.-]/.test(char);
  }

  private peek(): string {
    return this.source[this.index] ?? '';
  }

  private peekAhead(offset: number): string {
    return this.source[this.index + offset] ?? '';
  }

  private advance(): void {
    this.index += 1;
  }

  private isEOF(): boolean {
    return this.index >= this.source.length;
  }

  private createToken(type: TokenType, value: string): Token {
    return {
      type,
      value,
      line: this.line,
      column: this.column,
    };
  }

  private error(message: string, line = this.line, column = this.column): Error {
    return new Error(`${message} (line ${line}, column ${column})`);
  }
}
