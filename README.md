# Sprout

Sprout is a tiny browser-focused language that compiles to regular JavaScript.
It keeps the DOM front and center and exposes a small set of verbs—`listen`,
`set`, `get`, `toggle`, and `send`—so you can wire behaviour onto existing
markup without pulling in a heavy framework.

## Features

* **Selector-first syntax** – every verb works with CSS selectors or existing
  elements.
* **Built-in templates and bindings** – create HTML snippets with a tiny
  templating language and connect DOM nodes to reactive state.
* **Small standard library** – helpers for time, random numbers, list
  operations, JSON, and URLs.
* **Fetch made friendly** – `send` wraps the Fetch API and returns parsed JSON
  by default.

## Getting started

1. Install dependencies and build the project:

   ```bash
   npm install
   npm run build
   ```

2. Use the CLI to compile a Sprout script or HTML file. Inline Sprout scripts
   should use `<script type="text/sprout">`.

   ```bash
   # Compile a standalone Sprout file to JavaScript
   node dist/cli.js examples/counter.sprout

   # Compile an HTML file that contains Sprout scripts
   node dist/cli.js examples/counter.html
   ```

   The compiler emits JavaScript that includes the Sprout runtime. When you
   target an HTML file the CLI replaces each Sprout script tag with the compiled
   JavaScript and injects the runtime once.

## Language sketch

```html
<div id="count">0</div>
<button id="add">Add one</button>

<script type="text/sprout">
let n = 0
listen "#add" click {
  n = n + 1
  set "#count" text to n
}
</script>
```

Sprout programs compile to an isolated runtime that exposes the verbs as
methods. You interact with state through `state.<key>`, register event handlers
with `listen`, update the DOM with `set`/`add`/`toggle`, and make network
requests with `send`.

## Runtime helpers

* `state` – reactive global store backed by a proxy.
* `std.time.now()` – current timestamp.
* `std.random.int(max, min = 0)` – inclusive random integer.
* `std.list.map/filter/find` – convenience wrappers around array operations.
* `std.json.parse/stringify` – JSON helpers.
* `std.url.params/goto` – access query parameters and navigate.

## Development

The TypeScript sources live in `src/`. `npm run build` emits the JavaScript
artifacts into `dist/`. The generated CLI binary (`dist/cli.js`) can be symlinked
or invoked directly with Node.
