"use strict";
class SproutRuntime {
    bindings = [];
    templates = new Map();
    scheduled = false;
    state;
    std;
    ops;
    api;
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
    run(app) {
        app(this.api);
        this.updateAllBindings();
    }
    createState() {
        const runtime = this;
        const target = {};
        return new Proxy(target, {
            set(obj, key, value) {
                obj[key] = value;
                runtime.scheduleAllBindings();
                return true;
            },
            deleteProperty(obj, key) {
                delete obj[key];
                runtime.scheduleAllBindings();
                return true;
            },
        });
    }
    createStd() {
        return {
            time: {
                now: () => Date.now(),
            },
            random: {
                int: (max, min = 0) => {
                    if (!Number.isFinite(max)) {
                        throw new Error('random.int requires a maximum value');
                    }
                    const [low, high] = min <= max ? [min, max] : [max, min];
                    const span = high - low + 1;
                    return Math.floor(Math.random() * span) + low;
                },
            },
            list: {
                map: (items, fn) => {
                    return this.toList(items).map((item, index) => fn(item, index));
                },
                filter: (items, fn) => {
                    return this.toList(items).filter((item, index) => fn(item, index));
                },
                find: (items, fn) => {
                    return this.toList(items).find((item, index) => fn(item, index));
                },
            },
            json: {
                parse: (value) => JSON.parse(value),
                stringify: (value) => JSON.stringify(value),
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
                    const result = {};
                    entries.forEach((val, key) => {
                        result[key] = val;
                    });
                    return result;
                },
                goto: (target) => {
                    if (typeof window !== 'undefined') {
                        window.location.assign(target);
                    }
                },
            },
        };
    }
    createOps() {
        return {
            add: (left, right) => this.addValues(left, right),
            subtract: (left, right) => this.subtractValues(left, right),
            equals: (left, right) => this.equals(left, right),
            notEquals: (left, right) => !this.equals(left, right),
            negate: (value) => this.negateValue(value),
        };
    }
    listen(selector, event, handler) {
        const elements = this.resolveElements(selector);
        for (const element of elements) {
            element.addEventListener(event, handler);
        }
    }
    set(target, property, value, extra) {
        const elements = this.resolveElements(target);
        for (const element of elements) {
            this.applySet(element, property, value, extra);
        }
    }
    add(target, property, value) {
        const elements = this.resolveElements(target);
        for (const element of elements) {
            if (property === 'html') {
                element.insertAdjacentHTML('beforeend', this.toHtml(value));
            }
            else if (property === 'text') {
                element.append(this.toText(value));
            }
            else if (property === 'value' && 'value' in element) {
                element.value += this.toText(value);
            }
        }
    }
    toggle(target, mode, argument) {
        const elements = this.resolveElements(target);
        for (const element of elements) {
            if (mode === 'class') {
                const className = this.toText(argument);
                if (!className) {
                    continue;
                }
                if (typeof argument === 'boolean') {
                    element.classList.toggle(className, argument);
                }
                else {
                    element.classList.toggle(className);
                }
            }
            else if (mode === 'show' || mode === 'hide') {
                const shouldShow = this.resolveToggleState(element, mode, argument);
                if (shouldShow) {
                    element.removeAttribute('hidden');
                    if (element instanceof HTMLElement) {
                        element.style.display = '';
                    }
                }
                else {
                    element.setAttribute('hidden', 'true');
                    if (element instanceof HTMLElement) {
                        element.style.display = 'none';
                    }
                }
            }
        }
    }
    resolveToggleState(element, mode, argument) {
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
    getComputedDisplay(element) {
        if (typeof window === 'undefined' || !(element instanceof HTMLElement)) {
            return '';
        }
        return window.getComputedStyle(element).display;
    }
    async send(urlValue, methodValue, payloadValue) {
        if (typeof fetch === 'undefined') {
            throw new Error('send requires fetch to be available');
        }
        let url = this.toUrl(urlValue);
        const method = methodValue.toUpperCase();
        const options = { method };
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
        }
        else {
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
    render(name, value) {
        const template = this.templates.get(name);
        if (!template) {
            throw new Error(`Template '${name}' is not defined`);
        }
        if (Array.isArray(value)) {
            return value.map((item) => template(item)).join('');
        }
        return template(value);
    }
    defineTemplate(name, template) {
        this.templates.set(name, this.compileTemplate(template));
    }
    bind(getter, selector, property) {
        const binding = { getter, selector, property };
        this.bindings.push(binding);
        this.updateBinding(binding);
    }
    callJs(fn, payload) {
        if (typeof fn === 'function') {
            fn(payload);
            return;
        }
        const name = this.toText(fn);
        if (name && typeof window !== 'undefined') {
            const globalWindow = window;
            const callable = globalWindow[name];
            if (typeof callable === 'function') {
                callable(payload);
            }
        }
    }
    get(target, property, extra) {
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
                return 'value' in element ? element.value : undefined;
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
    getComputedStyleValue(element, property) {
        if (typeof window === 'undefined' || !(element instanceof HTMLElement)) {
            return '';
        }
        return window.getComputedStyle(element).getPropertyValue(property);
    }
    iter(value) {
        return this.toList(value);
    }
    updateAllBindings() {
        for (const binding of this.bindings) {
            this.updateBinding(binding);
        }
    }
    updateBinding(binding) {
        const value = this.resolveBindingValue(binding.getter);
        this.set(binding.selector, binding.property, value);
    }
    resolveBindingValue(getter) {
        let value = getter();
        const seen = new Set();
        while (typeof value === 'function' && !seen.has(value)) {
            seen.add(value);
            value = value();
        }
        return value;
    }
    scheduleAllBindings() {
        if (this.scheduled) {
            return;
        }
        this.scheduled = true;
        Promise.resolve().then(() => {
            this.scheduled = false;
            this.updateAllBindings();
        });
    }
    resolveElements(target) {
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
            return Array.from(target);
        }
        if (Array.isArray(target)) {
            return target.flatMap((item) => this.resolveElements(item));
        }
        return [];
    }
    resolveElement(target) {
        const elements = this.resolveElements(target);
        return elements[0] ?? null;
    }
    applySet(element, property, value, extra) {
        switch (property) {
            case 'text':
                element.textContent = this.toText(value);
                break;
            case 'html':
                element.innerHTML = this.toHtml(value);
                break;
            case 'value':
                if ('value' in element) {
                    element.value = this.toText(value);
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
    compileTemplate(template) {
        const pattern = /{{\s*([\w.]+)\s*}}/g;
        return (input) => {
            return template.replace(pattern, (_, path) => {
                const value = this.resolvePath(input, path);
                return this.toText(value);
            });
        };
    }
    resolvePath(input, path) {
        if (input == null) {
            return '';
        }
        return path.split('.').reduce((acc, key) => {
            if (acc && typeof acc === 'object') {
                return acc[key];
            }
            return undefined;
        }, input);
    }
    toDataKey(key) {
        return key
            .trim()
            .split('-')
            .map((segment, index) => (index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)))
            .join('');
    }
    toList(value) {
        if (!value) {
            return [];
        }
        if (Array.isArray(value)) {
            return [...value];
        }
        if (value && typeof value[Symbol.iterator] === 'function') {
            return Array.from(value);
        }
        if (this.isPlainObject(value)) {
            return Object.values(value);
        }
        return [];
    }
    addValues(left, right) {
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
    subtractValues(left, right) {
        return Number(left ?? 0) - Number(right ?? 0);
    }
    equals(left, right) {
        if (Array.isArray(left) && Array.isArray(right)) {
            return this.equalsArray(left, right);
        }
        if (this.isPlainObject(left) && this.isPlainObject(right)) {
            return this.equalsObject(left, right);
        }
        return Object.is(left, right);
    }
    equalsArray(left, right) {
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
    equalsObject(left, right) {
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
    isPlainObject(value) {
        return typeof value === 'object' && value !== null && value.constructor === Object;
    }
    negateValue(value) {
        if (typeof value === 'number') {
            return -value;
        }
        if (typeof value === 'boolean') {
            return !value;
        }
        return -Number(value ?? 0);
    }
    toText(value) {
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
            }
            catch {
                return '';
            }
        }
        return String(value);
    }
    toHtml(value) {
        if (typeof value === 'string') {
            return value;
        }
        return this.toText(value);
    }
    toBoolean(value) {
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
    toUrl(value) {
        const text = this.toText(value);
        if (!text) {
            throw new Error('send requires a URL');
        }
        return text;
    }
    clonePayload(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return value;
        }
        return { ...value };
    }
    extractRequestParts(payload) {
        if (!payload) {
            return { headers: {}, body: undefined };
        }
        const { headers: headersValue, body, ...rest } = payload;
        const headers = (typeof headersValue === 'object' && headersValue)
            ? { ...headersValue }
            : {};
        const bodyValue = body !== undefined ? body : Object.keys(rest).length > 0 ? rest : undefined;
        return { headers, body: bodyValue };
    }
}
const Sprout = {
    run(app) {
        const runtime = new SproutRuntime();
        runtime.run(app);
        return runtime;
    },
};
const globalTarget = globalThis;
if (!('Sprout' in globalTarget)) {
    globalTarget.Sprout = Sprout;
}
//# sourceMappingURL=runtime.js.map