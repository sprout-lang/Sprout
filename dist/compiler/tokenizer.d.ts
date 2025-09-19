export type TokenType = 'identifier' | 'number' | 'string' | 'operator' | 'punctuation' | 'newline' | 'eof';
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}
export declare class Tokenizer {
    private readonly source;
    private index;
    private line;
    private column;
    constructor(source: string);
    tokenize(): Token[];
    private readString;
    private readNumber;
    private readIdentifier;
    private isWhitespace;
    private isDigit;
    private isIdentifierStart;
    private isIdentifierPart;
    private peek;
    private peekAhead;
    private advance;
    private isEOF;
    private createToken;
    private error;
}
//# sourceMappingURL=tokenizer.d.ts.map