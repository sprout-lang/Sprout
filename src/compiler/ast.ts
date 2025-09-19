export type Program = {
  type: 'Program';
  body: Statement[];
};

export type Statement =
  | LetStatement
  | AssignmentStatement
  | ListenStatement
  | SetStatement
  | AddStatement
  | ToggleStatement
  | SendStatement
  | TemplateStatement
  | BindStatement
  | CallJsStatement
  | IfStatement
  | ForStatement
  | ExpressionStatement;

export interface LetStatement {
  type: 'LetStatement';
  name: string;
  value: Expression;
}

export interface AssignmentStatement {
  type: 'AssignmentStatement';
  target: Expression;
  value: Expression;
}

export interface ListenStatement {
  type: 'ListenStatement';
  selector: Expression;
  event: string;
  body: BlockStatement;
}

export interface SetStatement {
  type: 'SetStatement';
  target: Expression;
  property: string;
  value: Expression;
  extra?: Expression;
}

export interface AddStatement {
  type: 'AddStatement';
  target: Expression;
  property: string;
  value: Expression;
}

export interface ToggleStatement {
  type: 'ToggleStatement';
  target: Expression;
  mode: 'class' | 'show' | 'hide';
  argument?: Expression;
}

export interface SendStatement {
  type: 'SendStatement';
  url: Expression;
  method: string;
  payload: Expression;
  chain: ThenClause[];
}

export interface ThenClause {
  params: string[];
  body: BlockStatement;
}

export interface TemplateStatement {
  type: 'TemplateStatement';
  name: string;
  template: string;
}

export interface BindStatement {
  type: 'BindStatement';
  source: Expression;
  selector: Expression;
  property: string;
}

export interface CallJsStatement {
  type: 'CallJsStatement';
  functionName: Expression;
  payload?: Expression;
}

export interface IfStatement {
  type: 'IfStatement';
  test: Expression;
  consequent: BlockStatement;
  alternate?: BlockStatement | IfStatement;
}

export interface ForStatement {
  type: 'ForStatement';
  variable: string;
  iterable: Expression;
  body: BlockStatement;
}

export interface ExpressionStatement {
  type: 'ExpressionStatement';
  expression: Expression;
}

export interface BlockStatement {
  type: 'BlockStatement';
  body: Statement[];
}

export type Expression =
  | IdentifierExpression
  | LiteralExpression
  | BinaryExpression
  | LogicalExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | ListExpression
  | MapExpression
  | LambdaExpression
  | RenderExpression
  | GetExpression
  | GroupExpression;

export interface IdentifierExpression {
  type: 'Identifier';
  name: string;
}

export type LiteralKind = 'number' | 'text' | 'bool';

export interface LiteralExpression {
  type: 'Literal';
  literalType: LiteralKind;
  value: string | number | boolean;
}

export interface GroupExpression {
  type: 'Group';
  expression: Expression;
}

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface LogicalExpression {
  type: 'LogicalExpression';
  operator: '&&' | '||';
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: 'UnaryExpression';
  operator: string;
  argument: Expression;
}

export interface CallExpression {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

export interface MemberExpression {
  type: 'MemberExpression';
  object: Expression;
  property: string;
}

export interface ListExpression {
  type: 'ListExpression';
  elements: Expression[];
}

export interface MapExpression {
  type: 'MapExpression';
  entries: { key: string; value: Expression }[];
}

export interface LambdaExpression {
  type: 'LambdaExpression';
  params: string[];
  body: BlockStatement | Expression;
}

export interface RenderExpression {
  type: 'RenderExpression';
  template: string;
  value: Expression;
}

export interface GetExpression {
  type: 'GetExpression';
  target: Expression;
  property: string;
  extra?: Expression;
}
