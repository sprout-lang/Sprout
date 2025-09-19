import { Program } from './ast';
export declare class CodeGenerator {
    private output;
    private indentLevel;
    generate(program: Program): string;
    private generateStatement;
    private generateListen;
    private generateSet;
    private generateAdd;
    private generateToggle;
    private generateSend;
    private generateBind;
    private generateCallJs;
    private generateIf;
    private generateFor;
    private generateBlock;
    private generateExpression;
    private generateLiteral;
    private generateBinary;
    private generateLogical;
    private generateUnary;
    private generateLambda;
    private generateGet;
    private precedenceForOperator;
    private emitLine;
    private emitRaw;
    private emitCaptured;
    private capture;
    private indentString;
    private formatObjectKey;
}
//# sourceMappingURL=codegen.d.ts.map