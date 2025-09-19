type Binding = {
  getter: () => unknown;
  selector: unknown;
  property: string;
};

type TemplateFunction = (input: unknown) => string;

type SproutStd = {
  time: { now: () => number };
  random: { int: (max: number, min?: number) => number };
  list: {
    map<T, R>(items: Iterable<T> | null | undefined, fn: (item: T, index: number) => R): R[];
    filter<T>(items: Iterable<T> | null | undefined, fn: (item: T, index: number) => boolean): T[];
    find<T>(items: Iterable<T> | null | undefined, fn: (item: T, index: number) => boolean): T | undefined;
  };
  json: { parse: (value: string) => unknown; stringify: (value: unknown) => string };
  url: { params: () => Record<string, string>; goto: (target: string) => void };
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

class SproutRuntime {
  private readonly bindings: Binding[] = [];
  private readonly templates = new Map<string, TemplateFunction>();
  private scheduled = false;

  readonly state: Record<string, unknown>;
  readonly std: SproutStd;
  readonly ops: SproutOps;

  private readonly api: SproutApi;

  constructor() {
    this.state = this.createState();
    this.std = this.createStd();
    this.ops = this.createOps();
    this.api = {
      state: this.state,
      std: this.std,
      listen: (selector, event, handler) => this.listen(selector, event, handler),
      set: (target, property, value, extra) => this.set(target, property, value, extra),
      add: (target, property, value) => this.add(target, property, value),
      toggle: (target, mode, argument) => this.toggle(target, mode, argument),
      send: (url, method, payload) => this.send(url, method, payload),
      render: (template, value) => this.render(template, value),
      defineTemplate: (name, template) => this.defineTemplate(name, template),
      bind: (getter, selector, property) => this.bind(getter, selector, property),
      callJs: (fn, payload) => this.callJs(fn, payload),
      get: (target, property, extra) => this.get(target, property, extra),
      ops: this.ops,
      iter: (value) => this.iter(value),
    };
  }

  run(app: (api: SproutApi) => void): void {
    app(this.api);
    this.updateAllBindings();
  }

  private createState(): Record<string, unknown> {
    const runtime = this;
    const target: Record<string, unknown> = {};
    return new Proxy(target, {
      set(obj, key, value) {
        obj[key as string] = value;
        runtime.scheduleAllBindings();
        return true;
      },
      deleteProperty(obj, key) {
        delete obj[key as string];
        runtime.scheduleAllBindings();
        return true;
      },
    });
  }

  private createStd(): SproutStd {
    return {
      time: {
        now: () => Date.now(),
      },
      random: {
        int: (max: number, min = 0) => {
          if (!Number.isFinite(max)) {
            throw new Error('random.int requires a maximum value');
          }
          const [low, high] = min <= max ? [min, max] : [max, min];
          const span = high - low + 1;
          return Math.floor(Math.random() * span) + low;
        },
      },
      list: {
        map: <T, R>(items: Iterable<T> | null | undefined, fn: (item: T, index: number) => R): R[] => {
          return this.toList(items).map((item, index) => fn(item, index));
        },
        filter: <T>(items: Iterable<T> | null | undefined, fn: (item: T, index: number) => boolean): T[] => {
          return this.toList(items).filter((item, index) => fn(item, index));
        },
        find: <T>(items: Iterable<T> | null | undefined, fn: (item: T, index: number) => boolean): T | undefined => {
          return this.toList(items).find((item, index) => fn(item, index));
        },
      },
      json: {
        parse: (value: string) => JSON.parse(value),
        stringify: (value: unknown) => JSON.stringify(value),
      },
      url: {
        params: () => {
          if (typeof window === 'undefined') {
            return {};
          }
          const search = window.location.search.startsWith('?')
            ? window.location.search.slice(1)
            : window.location.search;
          const entries = new URLSearchParams(search);
          const result: Record<string, string> = {};
          entries.forEach((val, key) => {
            result[key] = val;
          });
          return result;
        },
        goto: (target: string) => {
          if (typeof window !== 'undefined') {
            window.location.assign(target);
          }
        },
      },
    };
  }
  private createOps(): SproutOps {
    return {
      add: (left, right) => this.addValues(left, right),
      subtract: (left, right) => this.subtractValues(left, right),
      equals: (left, right) => this.equals(left, right),
      notEquals: (left, right) => !this.equals(left, right),
      negate: (value) => this.negateValue(value),
    };
  }

  private listen(selector: unknown, event: string, handler: (event: Event) => void): void {
    const elements = this.resolveElements(selector);
    for (const element of elements) {
      element.addEventListener(event, handler as EventListener);
    }
  }

  private set(target: unknown, property: string, value: unknown, extra?: unknown): void {
    const elements = this.resolveElements(target);
    for (const element of elements) {
      this.applySet(element, property, value, extra);
    }
  }

  private add(target: unknown, property: string, value: unknown): void {
    const elements = this.resolveElements(target);
    for (const element of elements) {
      if (property === 'html') {
        element.insertAdjacentHTML('beforeend', this.toHtml(value));
      } else if (property === 'text') {
        element.append(this.toText(value));
      } else if (property === 'value' && 'value' in element) {
        (element as HTMLInputElement).value += this.toText(value);
      }
    }
  }

  private toggle(target: unknown, mode: string, argument?: unknown): void {
    const elements = this.resolveElements(target);
    for (const element of elements) {
      if (mode === 'class') {
        const className = this.toText(argument);
        if (!className) {
          continue;
        }
        if (typeof argument === 'boolean') {
          element.classList.toggle(className, argument);
        } else {
          element.classList.toggle(className);
        }
      } else if (mode === 'show' || mode === 'hide') {
        const shouldShow = this.resolveToggleState(element, mode, argument);
        if (shouldShow) {
          element.removeAttribute('hidden');
          if (element instanceof HTMLElement) {
            element.style.display = '';
          }
        } else {
          element.setAttribute('hidden', 'true');
          if (element instanceof HTMLElement) {
            element.style.display = 'none';
          }
        }
      }
    }
  }

  private resolveToggleState(element: Element, mode: string, argument?: unknown): boolean {
    const isHidden = element.hasAttribute('hidden') || this.getComputedDisplay(element) === 'none';
    if (typeof argument === 'boolean') {
      return mode === 'show' ? argument : !argument;
    }
    if (argument !== undefined) {
      const truthy = this.toBoolean(argument);
      return mode === 'show' ? truthy : !truthy;
    }
    return mode === 'show' ? isHidden : !isHidden;
  }

  private getComputedDisplay(element: Element): string {
    if (typeof window === 'undefined' || !(element instanceof HTMLElement)) {
      return '';
    }
    return window.getComputedStyle(element).display;
  }

  private async send(urlValue: unknown, methodValue: string, payloadValue: unknown): Promise<unknown> {
    if (typeof fetch === 'undefined') {
      throw new Error('send requires fetch to be available');
    }
    let url = this.toUrl(urlValue);
    const method = methodValue.toUpperCase();
    const options: RequestInit = { method };
    const payload = this.clonePayload(payloadValue);
    if (method === 'GET') {
      if (payload && Object.keys(payload).length > 0) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(payload)) {
          params.append(key, this.toText(value));
        }
        const query = params.toString();
        if (query) {
          url += (url.includes('?') ? '&' : '?') + query;
        }
      }
    } else {
      const { headers, body } = this.extractRequestParts(payload);
      options.headers = { 'Content-Type': 'application/json', ...headers };
      if (body !== undefined) {
        options.body = JSON.stringify(body);
      }
    }
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }
  private render(name: string, value: unknown): string {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template '${name}' is not defined`);
    }
    if (Array.isArray(value)) {
      return value.map((item) => template(item)).join('');
    }
    return template(value);
  }

  private defineTemplate(name: string, template: string): void {
    this.templates.set(name, this.compileTemplate(template));
  }

  private bind(getter: () => unknown, selector: unknown, property: string): void {
    const binding: Binding = { getter, selector, property };
    this.bindings.push(binding);
    this.updateBinding(binding);
  }

  private callJs(fn: unknown, payload?: unknown): void {
    if (typeof fn === 'function') {
      (fn as (value?: unknown) => void)(payload);
      return;
    }
    const name = this.toText(fn);
    if (name && typeof window !== 'undefined') {
      const globalWindow = window as unknown as Record<string, unknown>;
      const callable = globalWindow[name];
      if (typeof callable === 'function') {
        (callable as (value?: unknown) => void)(payload);
      }
    }
  }

  private get(target: unknown, property: string, extra?: unknown): unknown {
    const element = this.resolveElement(target);
    if (!element) {
      return undefined;
    }
    switch (property) {
      case 'text':
        return element.textContent ?? '';
      case 'html':
        return element.innerHTML;
      case 'value':
        return 'value' in element ? (element as HTMLInputElement).value : undefined;
      case 'attr':
        return element.getAttribute(this.toText(extra));
      case 'css':
        return this.getComputedStyleValue(element, this.toText(extra));
      case 'data':
        return element instanceof HTMLElement
          ? element.dataset[this.toDataKey(this.toText(extra))] ?? undefined
          : undefined;
      default:
        return undefined;
    }
  }

  private getComputedStyleValue(element: Element, property: string): string {
    if (typeof window === 'undefined' || !(element instanceof HTMLElement)) {
      return '';
    }
    return window.getComputedStyle(element).getPropertyValue(property);
  }

  private iter(value: unknown): unknown[] {
    return this.toList(value as Iterable<unknown> | null | undefined);
  }

  private updateAllBindings(): void {
    for (const binding of this.bindings) {
      this.updateBinding(binding);
    }
  }

  private updateBinding(binding: Binding): void {
    const value = this.resolveBindingValue(binding.getter);
    this.set(binding.selector, binding.property, value);
  }

  private resolveBindingValue(getter: () => unknown): unknown {
    let value = getter();
    const seen = new Set<unknown>();
    while (typeof value === 'function' && !seen.has(value)) {
      seen.add(value);
      value = (value as () => unknown)();
    }
    return value;
  }

  private scheduleAllBindings(): void {
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    Promise.resolve().then(() => {
      this.scheduled = false;
      this.updateAllBindings();
    });
  }
  private resolveElements(target: unknown): Element[] {
    if (typeof document === 'undefined') {
      return [];
    }
    if (typeof target === 'string') {
      return Array.from(document.querySelectorAll(target));
    }
    if (target instanceof Element) {
      return [target];
    }
    if (target instanceof NodeList || target instanceof HTMLCollection) {
      return Array.from(target as NodeListOf<Element>);
    }
    if (Array.isArray(target)) {
      return target.flatMap((item) => this.resolveElements(item));
    }
    return [];
  }

  private resolveElement(target: unknown): Element | null {
    const elements = this.resolveElements(target);
    return elements[0] ?? null;
  }

  private applySet(element: Element, property: string, value: unknown, extra?: unknown): void {
    switch (property) {
      case 'text':
        element.textContent = this.toText(value);
        break;
      case 'html':
        element.innerHTML = this.toHtml(value);
        break;
      case 'value':
        if ('value' in element) {
          (element as HTMLInputElement).value = this.toText(value);
        }
        break;
      case 'attr':
        element.setAttribute(this.toText(extra), this.toText(value));
        break;
      case 'css':
        if (element instanceof HTMLElement) {
          element.style.setProperty(this.toText(extra), this.toText(value));
        }
        break;
      case 'data':
        if (element instanceof HTMLElement) {
          element.dataset[this.toDataKey(this.toText(extra))] = this.toText(value);
        }
        break;
      default:
        break;
    }
  }

  private compileTemplate(template: string): TemplateFunction {
    const pattern = /{{\s*([\w.]+)\s*}}/g;
    return (input: unknown) => {
      return template.replace(pattern, (_, path: string) => {
        const value = this.resolvePath(input, path);
        return this.toText(value);
      });
    };
  }

  private resolvePath(input: unknown, path: string): unknown {
    if (input == null) {
      return '';
    }
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, input);
  }

  private toDataKey(key: string): string {
    return key
      .trim()
      .split('-')
      .map((segment, index) => (index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)))
      .join('');
  }

  private toList<T>(value: Iterable<T> | null | undefined): T[] {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return [...value];
    }
    if (value && typeof (value as Iterable<T>)[Symbol.iterator] === 'function') {
      return Array.from(value as Iterable<T>);
    }
    if (this.isPlainObject(value)) {
      return Object.values(value as Record<string, T>);
    }
    return [];
  }

  private addValues(left: unknown, right: unknown): unknown {
    if (Array.isArray(left) || Array.isArray(right)) {
      const leftList = Array.isArray(left) ? left : [left];
      const rightList = Array.isArray(right) ? right : [right];
      return [...leftList, ...rightList];
    }
    if (typeof left === 'number' && typeof right === 'number') {
      return left + right;
    }
    if (typeof left === 'string' || typeof right === 'string') {
      return this.toText(left) + this.toText(right);
    }
    if (typeof left === 'boolean' && typeof right === 'boolean') {
      return Number(left) + Number(right);
    }
    return Number(left ?? 0) + Number(right ?? 0);
  }

  private subtractValues(left: unknown, right: unknown): unknown {
    return Number(left ?? 0) - Number(right ?? 0);
  }

  private equals(left: unknown, right: unknown): boolean {
    if (Array.isArray(left) && Array.isArray(right)) {
      return this.equalsArray(left, right);
    }
    if (this.isPlainObject(left) && this.isPlainObject(right)) {
      return this.equalsObject(left as Record<string, unknown>, right as Record<string, unknown>);
    }
    return Object.is(left, right);
  }

  private equalsArray(left: unknown[], right: unknown[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!this.equals(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }

  private equalsObject(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!this.equals(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && value.constructor === Object;
  }
  private negateValue(value: unknown): unknown {
    if (typeof value === 'number') {
      return -value;
    }
    if (typeof value === 'boolean') {
      return !value;
    }
    return -Number(value ?? 0);
  }

  private toText(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.toText(item)).join(',');
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
    return String(value);
  }

  private toHtml(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    return this.toText(value);
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return !(normalized === '' || normalized === 'false' || normalized === '0');
    }
    return Boolean(value);
  }

  private toUrl(value: unknown): string {
    const text = this.toText(value);
    if (!text) {
      throw new Error('send requires a URL');
    }
    return text;
  }

  private clonePayload(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return { ...(value as Record<string, unknown>) };
  }

  private extractRequestParts(payload: Record<string, unknown>): {
    headers: Record<string, string>;
    body: unknown;
  } {
    if (!payload) {
      return { headers: {}, body: undefined };
    }
    const { headers: headersValue, body, ...rest } = payload;
    const headers = (typeof headersValue === 'object' && headersValue)
      ? { ...(headersValue as Record<string, string>) }
      : {};
    const bodyValue = body !== undefined ? body : Object.keys(rest).length > 0 ? rest : undefined;
    return { headers, body: bodyValue };
  }
}

const Sprout = {
  run(app: (api: SproutApi) => void): SproutRuntime {
    const runtime = new SproutRuntime();
    runtime.run(app);
    return runtime;
  },
};

const globalTarget = (globalThis as unknown) as Record<string, unknown>;
if (!('Sprout' in globalTarget)) {
  globalTarget.Sprout = Sprout;
}
