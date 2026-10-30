// Runs the sample app (taskly-sample) inside a sandboxed iframe, in the visitor's own browser.
//
// The page sends the app's files (the repository with the agents' changes) and sql.js's WebAssembly. This script:
//   1. loads the app's real server code (src/*.js) as modules, with small stand-ins for the Node parts the
//      browser lacks: Express (routing), node:sqlite (backed by sql.js, real SQLite compiled to WebAssembly),
//      node:url and node:path;
//   2. starts it the way src/server.js does, then sends the page's /api requests to it instead of a network;
//   3. shows the app's real public/ page.
// The iframe is sandboxed (an opaque origin), so the app's code cannot reach the site's cookies or storage, and its
// Content-Security-Policy (next.config.ts) lets it make no network requests at all.
"use strict";

(() => {
  const ORIGIN = "http://taskly.local";
  const say = (type, message) => parent.postMessage({ type, message }, "*");

  class PreviewError extends Error {}

  // ---------- node:sqlite on sql.js ----------
  function makeSqlite(SQL) {
    const toValue = (v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : typeof v === "bigint" ? Number(v) : v);
    const bindArgs = (args) => {
      if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0]) && !(args[0] instanceof Uint8Array)) {
        const named = {};
        for (const [k, v] of Object.entries(args[0])) {
          if (/^[$:@]/.test(k)) named[k] = toValue(v);
          else for (const p of ["$", ":", "@"]) named[p + k] = toValue(v);
        }
        return named;
      }
      return args.map(toValue);
    };
    class StatementSync {
      constructor(db, sql) {
        this.db = db;
        this.sql = sql;
        db.prepare(sql).free(); // throws now for bad SQL, as node:sqlite does
      }
      #rows(args, limit) {
        const s = this.db.prepare(this.sql);
        try {
          s.bind(bindArgs(args));
          const rows = [];
          while (rows.length < limit && s.step()) rows.push(s.getAsObject());
          return rows;
        } finally {
          s.free();
        }
      }
      all(...args) {
        return this.#rows(args, Infinity);
      }
      get(...args) {
        return this.#rows(args, 1)[0];
      }
      *iterate(...args) {
        yield* this.#rows(args, Infinity);
      }
      run(...args) {
        const s = this.db.prepare(this.sql);
        try {
          s.bind(bindArgs(args));
          while (s.step());
        } finally {
          s.free();
        }
        const changes = this.db.getRowsModified();
        const id = this.db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] ?? 0;
        return { changes, lastInsertRowid: id };
      }
    }
    class DatabaseSync {
      constructor() {
        this.db = new SQL.Database(); // always in memory: the preview keeps nothing
      }
      exec(sql) {
        this.db.exec(sql);
      }
      prepare(sql) {
        return new StatementSync(this.db, sql);
      }
      close() {}
    }
    return { DatabaseSync, StatementSync };
  }

  // ---------- Express ----------
  function compile(path, prefix) {
    if (path == null || path === "/" && prefix) return { re: /^/, keys: [] };
    if (path instanceof RegExp) return { re: path, keys: [] };
    const keys = [];
    const src = String(path)
      .replace(/\/+$/, "")
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\/:(\w+)(\?)?/g, (_, k, opt) => {
        keys.push(k);
        return opt ? "(?:/([^/]+))?" : "/([^/]+)";
      })
      .replace(/\*/g, ".*");
    return { re: new RegExp(`^${src}${prefix ? "(?=/|$)" : "/?$"}`, "i"), keys };
  }

  function createExpress(onListen) {
    function express() {
      const stack = [];
      const app = (req, res, next) => app.handle(req, res, next);
      app.locals = {};
      const settings = {};

      const add = (method, path, handlers, prefix) => {
        for (const h of handlers.flat()) stack.push({ method, prefix, ...compile(path, prefix), handle: h });
      };
      app.use = (...args) => {
        const path = typeof args[0] === "string" || args[0] instanceof RegExp ? args.shift() : null;
        add(null, path, args, true);
        return app;
      };
      for (const m of ["get", "post", "put", "patch", "delete", "all", "options", "head"]) {
        app[m] = (path, ...handlers) => {
          if (m === "get" && handlers.length === 0 && typeof path === "string") return settings[path];
          add(m === "all" ? null : m.toUpperCase(), path, handlers, false);
          return app;
        };
      }
      app.route = (path) => {
        const r = {};
        for (const m of ["get", "post", "put", "patch", "delete", "all"]) {
          r[m] = (...handlers) => {
            app[m](path, ...handlers);
            return r;
          };
        }
        return r;
      };
      app.set = (k, v) => ((settings[k] = v), app);
      app.enable = (k) => app.set(k, true);
      app.disable = (k) => app.set(k, false);
      app.engine = () => app;
      app.param = () => app;
      app.listen = (...args) => {
        onListen(app);
        const cb = args.find((a) => typeof a === "function");
        if (cb) setTimeout(cb);
        return { close: (fn) => fn && fn(), address: () => ({ port: 3000 }), on: () => {} };
      };

      app.handle = (req, res, done) => {
        let i = 0;
        const fullPath = req.path;
        const next = (err) => {
          if (err === "route") err = undefined;
          if (err === "router") return done(); // leave this router
          while (i < stack.length) {
            const layer = stack[i++];
            if (layer.method && layer.method !== req.method && !(layer.method === "GET" && req.method === "HEAD")) continue;
            const m = layer.re.exec(fullPath);
            if (!m) continue;
            const isErrorHandler = layer.handle.length === 4;
            if (Boolean(err) !== isErrorHandler) continue;
            const params = {};
            layer.keys.forEach((k, j) => {
              if (m[j + 1] !== undefined) params[k] = decodeURIComponent(m[j + 1]);
            });
            req.params = { ...req.params, ...params };
            const savedPath = req.path;
            const savedBase = req.baseUrl;
            if (layer.prefix && m[0]) {
              req.baseUrl = savedBase + m[0];
              req.path = fullPath.slice(m[0].length) || "/";
            }
            const restore = (e) => {
              req.path = savedPath;
              req.baseUrl = savedBase;
              next(e);
            };
            try {
              const out = isErrorHandler ? layer.handle(err, req, res, restore) : layer.handle(req, res, restore);
              if (out && typeof out.then === "function") out.then(undefined, restore);
            } catch (e) {
              restore(e);
            }
            return;
          }
          done(err);
        };
        next();
      };
      return app;
    }

    express.Router = () => express();
    express.json = () => (req, _res, next) => {
      if (req.body !== undefined) return next();
      const type = (req.headers["content-type"] || "").toLowerCase();
      if (!req._raw || !type.includes("json")) {
        req.body = {};
        return next();
      }
      try {
        req.body = JSON.parse(req._raw);
        next();
      } catch {
        const e = new Error("Invalid JSON");
        e.status = 400;
        next(e);
      }
    };
    express.urlencoded = () => (req, _res, next) => {
      if (req.body === undefined && (req.headers["content-type"] || "").includes("urlencoded")) {
        req.body = Object.fromEntries(new URLSearchParams(req._raw || ""));
      }
      next();
    };
    express.text = () => (req, _res, next) => {
      if (req.body === undefined) req.body = req._raw || "";
      next();
    };
    // The page itself is served by the preview, so static files just pass through.
    express.static = () => (_req, _res, next) => next();
    return express;
  }

  /** Send one request through the app; resolves to a fetch Response. */
  function dispatch(app, request, raw) {
    return new Promise((resolve) => {
      const url = new URL(request.url);
      const headers = {};
      request.headers.forEach((v, k) => (headers[k] = v));
      const req = {
        method: request.method.toUpperCase(),
        url: url.pathname + url.search,
        originalUrl: url.pathname + url.search,
        path: decodeURIComponent(url.pathname),
        baseUrl: "",
        query: Object.fromEntries(url.searchParams),
        params: {},
        headers,
        body: undefined,
        _raw: raw,
        get: (k) => headers[String(k).toLowerCase()],
        header: (k) => headers[String(k).toLowerCase()],
        is: (t) => (headers["content-type"] || "").includes(t),
        ip: "127.0.0.1",
        protocol: "http",
        hostname: "localhost",
      };
      const out = new Headers();
      let sent = false;
      const res = {
        statusCode: 200,
        locals: {},
        get headersSent() {
          return sent;
        },
        status(c) {
          this.statusCode = c;
          return this;
        },
        set(k, v) {
          if (typeof k === "object") for (const [a, b] of Object.entries(k)) out.set(a, String(b));
          else out.set(k, String(v));
          return this;
        },
        header(k, v) {
          return this.set(k, v);
        },
        setHeader(k, v) {
          return this.set(k, v);
        },
        get(k) {
          return out.get(k);
        },
        type(t) {
          return this.set("content-type", t.includes("/") ? t : t === "json" ? "application/json" : `text/${t}`);
        },
        json(obj) {
          if (!out.has("content-type")) out.set("content-type", "application/json; charset=utf-8");
          return this.end(JSON.stringify(obj ?? null));
        },
        send(body) {
          if (body !== null && typeof body === "object" && !(body instanceof Uint8Array)) return this.json(body);
          if (typeof body === "number") return this.status(body).end(String(body));
          if (!out.has("content-type")) out.set("content-type", "text/html; charset=utf-8");
          return this.end(body ?? "");
        },
        sendStatus(c) {
          return this.status(c).send(String(c));
        },
        redirect(a, b) {
          const [code, to] = typeof a === "number" ? [a, b] : [302, a];
          return this.status(code).set("location", to).end("");
        },
        end(body) {
          if (sent) return this;
          sent = true;
          const empty = this.statusCode === 204 || this.statusCode === 304 || req.method === "HEAD";
          resolve(new Response(empty ? null : (body ?? ""), { status: this.statusCode, headers: out }));
          return this;
        },
      };
      app.handle(req, res, (err) => {
        if (sent) return;
        if (err) {
          console.error(err);
          res.status(err.status || err.statusCode || 500).type("text").send(err.status ? err.message : "Internal Server Error");
        } else {
          res.status(404).type("text").send(`Cannot ${req.method} ${req.path}`);
        }
      });
    });
  }

  // ---------- module loader ----------
  const NODE_SHIMS = {
    express: `const e = globalThis.__preview.express; export default e; export const Router = e.Router, json = e.json, urlencoded = e.urlencoded, text = e.text;`,
    "node:sqlite": `const s = globalThis.__preview.sqlite; export const DatabaseSync = s.DatabaseSync, StatementSync = s.StatementSync; export default s;`,
    "node:url": `export const fileURLToPath = (u) => decodeURIComponent(new URL(String(u)).pathname); export const pathToFileURL = (p) => new URL("file://" + p); const U = globalThis.URL, P = globalThis.URLSearchParams; export { U as URL, P as URLSearchParams }; export default { fileURLToPath, pathToFileURL, URL: U, URLSearchParams: P };`,
    "node:path": `const norm = (p) => { const out = []; for (const s of p.split("/")) { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); } return (p.startsWith("/") ? "/" : "") + out.join("/"); };
export const join = (...a) => norm(a.join("/")); export const resolve = (...a) => norm(a.reduce((acc, s) => (s.startsWith("/") ? s : acc + "/" + s), "/app"));
export const dirname = (p) => p.replace(/\\/[^/]*$/, "") || "/"; export const basename = (p, ext) => { const b = p.split("/").pop(); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; };
export const extname = (p) => (/\\.[^./]*$/.exec(p) || [""])[0]; export const sep = "/"; export default { join, resolve, dirname, basename, extname, sep };`,
    "node:crypto": `export const randomUUID = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16))); export default { randomUUID };`,
    "node:process": `export default globalThis.process; export const env = globalThis.process.env;`,
  };
  for (const k of ["url", "path", "crypto", "process"]) NODE_SHIMS[k] = NODE_SHIMS[`node:${k}`];

  const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"'\n]+)\2/g;

  function resolvePath(from, spec) {
    const parts = from.split("/").slice(0, -1);
    for (const s of spec.split("/")) {
      if (s === "..") parts.pop();
      else if (s !== ".") parts.push(s);
    }
    return parts.join("/");
  }

  function makeLoader(files) {
    const urls = new Map();
    const shimUrls = new Map();
    const blob = (code) => URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    const load = (path, seen = []) => {
      if (urls.has(path)) return urls.get(path);
      if (seen.includes(path)) throw new PreviewError(`The app's files import each other in a loop (${path}).`);
      const source = files[path];
      if (source === undefined) throw new PreviewError(`The app imports ${path}, which isn't in it.`);
      const code = source
        .replace(/\bimport\.meta\.url\b/g, JSON.stringify(`file:///app/${path}`))
        .replace(IMPORT, (all, lead, q, spec) => {
          let url;
          if (spec.startsWith(".")) url = load(resolvePath(path, spec), [...seen, path]);
          else if (NODE_SHIMS[spec]) {
            if (!shimUrls.has(spec)) shimUrls.set(spec, blob(NODE_SHIMS[spec]));
            url = shimUrls.get(spec);
          } else throw new PreviewError(`The app uses "${spec}", which this in-browser preview can't run. Download the code to run it with Node instead.`);
          return `${lead}${q}${url}${q}`;
        });
      const url = blob(`${code}\n//# sourceURL=taskly/${path}`);
      urls.set(path, url);
      return url;
    };
    return load;
  }

  // ---------- boot ----------
  async function boot({ files, wasm }) {
    // initSqlJs comes from sql-wasm.js, loaded by frame.html. The page sends the WebAssembly bytes: this frame may not fetch.
    const SQL = await initSqlJs({ wasmBinary: wasm });
    let app = null;
    globalThis.process = { env: { NODE_ENV: "development" }, argv: ["node", "src/server.js"], cwd: () => "/app", on: () => {}, exit: () => {} };
    globalThis.__preview = { express: createExpress((a) => (app = a)), sqlite: makeSqlite(SQL) };

    const serverLog = [];
    const realLog = console.log;
    console.log = (...a) => {
      serverLog.push(a.join(" "));
      realLog(...a);
    };
    const load = makeLoader(files);
    const entry = files["src/server.js"] !== undefined ? "src/server.js" : null;
    if (!entry) throw new PreviewError("The app has no src/server.js to start.");
    await import(load(entry));
    console.log = realLog;
    if (!app) throw new PreviewError("The app's server didn't start (src/server.js never called listen).");

    // The page's own requests go to the app. Anything else (another site) is refused: the preview is offline.
    const realFetch = fetch.bind(globalThis);
    globalThis.fetch = async (input, init) => {
      const request = new Request(new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url, `${ORIGIN}/`), init ?? (input instanceof Request ? input : undefined));
      if (new URL(request.url).origin !== ORIGIN) return realFetch(request);
      const raw = ["GET", "HEAD"].includes(request.method) ? "" : await request.text();
      return dispatch(app, request, raw);
    };
    globalThis.XMLHttpRequest = undefined;

    // Show the app's own page.
    const html = files["public/index.html"];
    if (html === undefined) throw new PreviewError("The app has no public/index.html.");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const asset = (ref) => {
      if (!ref || /^[a-z]+:|^\/\//i.test(ref)) return null;
      const path = ref.startsWith("/") ? `public${ref}` : resolvePath("public/index.html", ref);
      return files[path] === undefined ? null : path;
    };
    for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
      const path = asset(link.getAttribute("href"));
      if (!path) continue;
      const style = doc.createElement("style");
      style.textContent = files[path];
      link.replaceWith(style);
    }
    const scripts = [...doc.querySelectorAll("script")].map((s) => {
      s.remove();
      return s;
    });
    document.documentElement.lang = doc.documentElement.lang || "en";
    document.title = doc.title;
    document.head.replaceChildren(...[...doc.head.childNodes].map((n) => document.importNode(n, true)));
    document.body.replaceChildren(...[...doc.body.childNodes].map((n) => document.importNode(n, true)));
    for (const a of doc.body.attributes) document.body.setAttribute(a.name, a.value);

    for (const s of scripts) {
      const el = document.createElement("script");
      const path = asset(s.getAttribute("src"));
      if (s.type === "module") {
        el.type = "module";
        el.src = path ? load(path) : URL.createObjectURL(new Blob([s.textContent], { type: "text/javascript" }));
      } else if (path) {
        el.textContent = files[path];
      } else if (!s.src) {
        el.textContent = s.textContent;
      } else continue;
      const done = new Promise((r) => {
        el.onload = r;
        el.onerror = r;
      });
      document.body.append(el);
      if (el.src) await done;
    }
    // The page's scripts were added after the document finished loading; let any that wait for it run.
    document.dispatchEvent(new Event("DOMContentLoaded"));
    window.dispatchEvent(new Event("load"));
    say("preview-ready");
  }

  addEventListener("error", (e) => say("preview-error", `The app hit an error: ${e.message}`));
  addEventListener("unhandledrejection", (e) => say("preview-error", `The app hit an error: ${e.reason?.message ?? e.reason}`));
  let started = false;
  addEventListener("message", (e) => {
      if (started || e.source !== parent || !e.data || e.data.type !== "preview-start") return;
      started = true;
      boot(e.data).catch((err) => {
        console.error(err);
        say("preview-error", err instanceof PreviewError ? err.message : `The app couldn't start: ${err.message}`);
      });
  });
  say("preview-loaded");
})();
