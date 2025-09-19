type Binding = {
    getter: () => unknown;
    selector: unknown;
    property: string;
};
type TemplateFunction = (input: unknown) => string;
type SproutStd = {
    time: {
        now: () => number;
    };
    random: {
        int: (max: number, min?: number) => number;
    };
    list: {
        map<T, R>(items: Iterable<T> | null | undefined, fn: (item: T, index: number) => R): R[];
        filter<T>(items: Iterable<T> | null | undefined, fn: (item: T, index: number) => boolean): T[];
        find<T>(items: Iterable<T> | null | undefined, fn: (item: T, index: number) => boolean): T | undefined;
    };
    json: {
        parse: (value: string) => unknown;
        stringify: (value: unknown) => string;
    };
    url: {
        params: () => Record<string, string>;
        goto: (target: string) => void;
    };
};
type SproutOps = {
    add: (left: unknown, right: unknown) => unknown;
    subtract: (left: unknown, right: unknown) => unknown;
    equals: (left: unknown, right: unknown) => boolean;
    notEquals: (left: unknown, right: unknown) => boolean;
    negate: (value: unknown) => unknown;
};
type SproutApi = {
    state: Record<string, unknown>;
    std: SproutStd;
    listen: (selector: unknown, event: string, handler: (event: Event) => void) => void;
    set: (target: unknown, property: string, value: unknown, extra?: unknown) => void;
    add: (target: unknown, property: string, value: unknown) => void;
    toggle: (target: unknown, mode: string, argument?: unknown) => void;
    send: (url: unknown, method: string, payload: unknown) => Promise<unknown>;
    render: (template: string, value: unknown) => string;
    defineTemplate: (name: string, template: string) => void;
    bind: (getter: () => unknown, selector: unknown, property: string) => void;
    callJs: (fn: unknown, payload?: unknown) => void;
    get: (target: unknown, property: string, extra?: unknown) => unknown;
    ops: SproutOps;
    iter: (value: unknown) => unknown[];
};
declare class SproutRuntime {
    private readonly bindings;
    private readonly templates;
    private scheduled;
    readonly state: Record<string, unknown>;
    readonly std: SproutStd;
    readonly ops: SproutOps;
    private readonly api;
    constructor();
    run(app: (api: SproutApi) => void): void;
    private createState;
    private createStd;
    private createOps;
    private listen;
    private set;
    private add;
    private toggle;
    private resolveToggleState;
    private getComputedDisplay;
    private send;
    private render;
    private defineTemplate;
    private bind;
    private callJs;
    private get;
    private getComputedStyleValue;
    private iter;
    private updateAllBindings;
    private updateBinding;
    private resolveBindingValue;
    private scheduleAllBindings;
    private resolveElements;
    private resolveElement;
    private applySet;
    private compileTemplate;
    private resolvePath;
    private toDataKey;
    private toList;
    private addValues;
    private subtractValues;
    private equals;
    private equalsArray;
    private equalsObject;
    private isPlainObject;
    private negateValue;
    private toText;
    private toHtml;
    private toBoolean;
    private toUrl;
    private clonePayload;
    private extractRequestParts;
}
declare const Sprout: {
    run(app: (api: SproutApi) => void): SproutRuntime;
};
declare const globalTarget: Record<string, unknown>;
//# sourceMappingURL=runtime.d.ts.map