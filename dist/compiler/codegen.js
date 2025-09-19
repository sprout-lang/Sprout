"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGenerator = void 0;
class CodeGenerator {
    output = [];
    indentLevel = 0;
    generate(program) {
        for (const statement of program.body) {
            this.generateStatement(statement);
        }
        return this.output.join('');
    }
    generateStatement(statement) {
        switch (statement.type) {
            case 'LetStatement':
                this.emitLine(`let ${statement.name} = ${this.generateExpression(statement.value)};`);
                break;
            case 'AssignmentStatement':
                this.emitLine(`${this.generateExpression(statement.target)} = ${this.generateExpression(statement.value)};`);
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
                this.emitLine(`sprout.defineTemplate(${JSON.stringify(statement.name)}, ${JSON.stringify(statement.template)});`);
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
                throw new Error(`Unsupported statement type ${statement.type}`);
        }
    }
    generateListen(statement) {
        const selector = this.generateExpression(statement.selector);
        this.emitLine(`sprout.listen(${selector}, ${JSON.stringify(statement.event)}, (event) => {`);
        this.emitCaptured(this.indentLevel + 1, () => this.generateBlock(statement.body));
        this.emitLine('});');
    }
    generateSet(statement) {
        const target = this.generateExpression(statement.target);
        const value = this.generateExpression(statement.value);
        const args = [target, JSON.stringify(statement.property), value];
        if (statement.extra) {
            args.push(this.generateExpression(statement.extra));
        }
        this.emitLine(`sprout.set(${args.join(', ')});`);
    }
    generateAdd(statement) {
        const target = this.generateExpression(statement.target);
        const value = this.generateExpression(statement.value);
        this.emitLine(`sprout.add(${target}, ${JSON.stringify(statement.property)}, ${value});`);
    }
    generateToggle(statement) {
        const target = this.generateExpression(statement.target);
        const argument = statement.argument ? `, ${this.generateExpression(statement.argument)}` : '';
        this.emitLine(`sprout.toggle(${target}, ${JSON.stringify(statement.mode)}${argument});`);
    }
    generateSend(statement) {
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
    generateBind(statement) {
        const source = this.generateExpression(statement.source);
        const selector = this.generateExpression(statement.selector);
        const property = JSON.stringify(statement.property);
        this.emitLine(`sprout.bind(() => ${source}, ${selector}, ${property});`);
    }
    generateCallJs(statement) {
        const functionName = this.generateExpression(statement.functionName);
        const payload = statement.payload ? `, ${this.generateExpression(statement.payload)}` : '';
        this.emitLine(`sprout.callJs(${functionName}${payload});`);
    }
    generateIf(statement, isElse = false) {
        const test = this.generateExpression(statement.test);
        const prefix = isElse ? 'else ' : '';
        this.emitLine(`${prefix}if (${test}) {`);
        this.emitCaptured(this.indentLevel + 1, () => this.generateBlock(statement.consequent));
        this.emitLine('}');
        if (statement.alternate) {
            if (statement.alternate.type === 'IfStatement') {
                this.generateIf(statement.alternate, true);
            }
            else {
                this.emitLine('else {');
                this.emitCaptured(this.indentLevel + 1, () => this.generateBlock(statement.alternate));
                this.emitLine('}');
            }
        }
    }
    generateFor(statement) {
        const iterable = this.generateExpression(statement.iterable);
        this.emitLine(`for (const ${statement.variable} of sprout.iter(${iterable})) {`);
        this.emitCaptured(this.indentLevel + 1, () => this.generateBlock(statement.body));
        this.emitLine('}');
    }
    generateBlock(block) {
        for (const statement of block.body) {
            this.generateStatement(statement);
        }
    }
    generateExpression(expression, parentPrecedence = 0) {
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
                return `sprout.render(${JSON.stringify(expression.template)}, ${this.generateExpression(expression.value)})`;
            case 'GetExpression':
                return this.generateGet(expression);
            case 'Group':
                return `(${this.generateExpression(expression.expression)})`;
            default:
                throw new Error(`Unsupported expression ${expression.type}`);
        }
    }
    generateLiteral(expression) {
        if (expression.literalType === 'text') {
            return JSON.stringify(expression.value);
        }
        return String(expression.value);
    }
    generateBinary(expression, parentPrecedence) {
        if (expression.operator === '+') {
            return `sprout.ops.add(${this.generateExpression(expression.left)}, ${this.generateExpression(expression.right)})`;
        }
        if (expression.operator === '-') {
            return `sprout.ops.subtract(${this.generateExpression(expression.left)}, ${this.generateExpression(expression.right)})`;
        }
        if (expression.operator === '==') {
            return `sprout.ops.equals(${this.generateExpression(expression.left)}, ${this.generateExpression(expression.right)})`;
        }
        if (expression.operator === '!=') {
            return `sprout.ops.notEquals(${this.generateExpression(expression.left)}, ${this.generateExpression(expression.right)})`;
        }
        const precedence = this.precedenceForOperator(expression.operator);
        const left = this.generateExpression(expression.left, precedence);
        const right = this.generateExpression(expression.right, precedence + 1);
        const result = `${left} ${expression.operator} ${right}`;
        return precedence < parentPrecedence ? `(${result})` : result;
    }
    generateLogical(expression, parentPrecedence) {
        const precedence = expression.operator === '||' ? 1 : 2;
        const left = this.generateExpression(expression.left, precedence);
        const right = this.generateExpression(expression.right, precedence + 1);
        const result = `${left} ${expression.operator} ${right}`;
        return precedence < parentPrecedence ? `(${result})` : result;
    }
    generateUnary(expression) {
        if (expression.operator === '-') {
            return `sprout.ops.negate(${this.generateExpression(expression.argument)})`;
        }
        if (expression.operator === '!') {
            return `!(${this.generateExpression(expression.argument)})`;
        }
        return `${expression.operator}${this.generateExpression(expression.argument)}`;
    }
    generateLambda(expression) {
        const params = expression.params.length > 0 ? expression.params.join(', ') : '';
        if (expression.body.type === 'BlockStatement') {
            const blockBody = expression.body;
            const body = this.capture(this.indentLevel + 1, () => this.generateBlock(blockBody));
            return `(${params}) => {\n${body}${this.indentString(this.indentLevel)}}`;
        }
        return `(${params}) => ${this.generateExpression(expression.body)}`;
    }
    generateGet(expression) {
        const target = this.generateExpression(expression.target);
        const property = JSON.stringify(expression.property);
        if (expression.extra) {
            return `sprout.get(${target}, ${property}, ${this.generateExpression(expression.extra)})`;
        }
        return `sprout.get(${target}, ${property})`;
    }
    precedenceForOperator(operator) {
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
    emitLine(line) {
        this.output.push(`${this.indentString(this.indentLevel)}${line}\n`);
    }
    emitRaw(text) {
        this.output.push(text);
    }
    emitCaptured(indent, fn) {
        this.emitRaw(this.capture(indent, fn));
    }
    capture(indent, fn) {
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
    indentString(level) {
        return '  '.repeat(level);
    }
    formatObjectKey(key) {
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key);
    }
}
exports.CodeGenerator = CodeGenerator;
//# sourceMappingURL=codegen.js.map