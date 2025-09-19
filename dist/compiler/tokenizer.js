"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tokenizer = void 0;
const punctuationChars = new Set(['(', ')', '{', '}', '[', ']', ',', '.', ':']);
const singleCharOperators = new Set(['+', '-', '*', '/', '%', '!', '=', '<', '>', '?']);
const pairedOperators = new Set(['==', '!=', '>=', '<=', '&&', '||']);
class Tokenizer {
    source;
    index = 0;
    line = 1;
    column = 1;
    constructor(source) {
        this.source = source;
    }
    tokenize() {
        const tokens = [];
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
    readString() {
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
    readNumber() {
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
    readIdentifier() {
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
    isWhitespace(char) {
        return char === ' ' || char === '\t' || char === '\r';
    }
    isDigit(char) {
        return char >= '0' && char <= '9';
    }
    isIdentifierStart(char) {
        return /[A-Za-z_#]/.test(char);
    }
    isIdentifierPart(char) {
        return /[A-Za-z0-9_#.-]/.test(char);
    }
    peek() {
        return this.source[this.index] ?? '';
    }
    peekAhead(offset) {
        return this.source[this.index + offset] ?? '';
    }
    advance() {
        this.index += 1;
    }
    isEOF() {
        return this.index >= this.source.length;
    }
    createToken(type, value) {
        return {
            type,
            value,
            line: this.line,
            column: this.column,
        };
    }
    error(message, line = this.line, column = this.column) {
        return new Error(`${message} (line ${line}, column ${column})`);
    }
}
exports.Tokenizer = Tokenizer;
//# sourceMappingURL=tokenizer.js.map