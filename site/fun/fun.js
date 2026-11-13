// Renders every project listed in projects/projects.json onto the Fun page.
//
// Each project folder holds its Python files and a manifest.json (see the
// README for every field). Two kinds of project are supported:
//
// - pygame games: set "canvas" and "main" in the manifest. The loader gives
//   pygame a <canvas> on the page and runs the async main function. No
//   JavaScript is needed.
// - anything else: write an ES module interface (ui.js by default) that
//   exports `default function mount(root, ctx)` and draws into `root`.
//
// A ui.js module may also be used with a canvas project, for extra buttons.
// `ctx` gives it:
//   ctx.call(name, ...args)  call a function in the entry module; arguments and
//                            the return value pass through JSON
//   ctx.module               the imported entry module (a Pyodide PyProxy)
//   ctx.start(fn, module)    re-import `module` (default: the entry) from
//                            scratch and run its function `fn` (default: the
//                            manifest's "main"), stopping whatever ran before;
//                            returns a Promise that settles when it finishes
//   ctx.stop()               cancel the running main function
//   ctx.canvas               the pygame canvas, when the manifest asks for one
//   ctx.pyodide              the shared Pyodide instance
//   ctx.manifest             the parsed manifest.json
//   ctx.url(path)            absolute URL of a file in the project folder
//
// Pyodide is downloaded once, only when a visitor first starts a project, and
// every project shares that one instance.

const PYODIDE_VERSION = "314.0.7";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PROJECTS_URL = new URL("projects/", import.meta.url);
// Where project files live inside Pyodide's in-memory filesystem.
const FS_ROOT = "/home/pyodide/projects";

// Helpers installed into Pyodide once. `_site_import` puts a project's folder
// first on sys.path and drops modules that another project loaded under the
// same name, so two projects can each have their own `game.py`. With
// fresh=True it also drops this project's own modules, so module-level state
// (and module-level pygame setup) starts over.
const BRIDGE = `
import asyncio, importlib, inspect, json, sys

_SITE_ROOT = ${JSON.stringify(FS_ROOT)}

def _site_import(path, entry, fresh=False):
    for name, mod in list(sys.modules.items()):
        f = getattr(mod, "__file__", None) or ""
        if f.startswith(_SITE_ROOT + "/") and (fresh or not f.startswith(path + "/")):
            del sys.modules[name]
    if path in sys.path:
        sys.path.remove(path)
    sys.path.insert(0, path)
    importlib.invalidate_caches()
    return importlib.import_module(entry)

def _site_call(module, name, args_json):
    return json.dumps(getattr(module, name)(*json.loads(args_json)))

_site_tasks = {}

def _site_stop(key):
    task = _site_tasks.pop(key, None)
    if task is not None:
        task.cancel()

def _site_start(key, module, name):
    """Run module.name(); if it is async, return a future that is True when it
    finished on its own and False when it was stopped."""
    _site_stop(key)
    result = getattr(module, name)()
    if not inspect.isawaitable(result):
        return None
    task = asyncio.ensure_future(result)
    _site_tasks[key] = task

    async def wait():
        try:
            await task
            return True
        except asyncio.CancelledError:
            return False
        finally:
            if _site_tasks.get(key) is task:
                del _site_tasks[key]

    return asyncio.ensure_future(wait())
`;

let pyodidePromise = null;

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import(`${PYODIDE_URL}pyodide.mjs`);
      const pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
      pyodide.runPython(BRIDGE);
      return pyodide;
    })();
    // Let a later click retry after a failed download.
    pyodidePromise.catch(() => { pyodidePromise = null; });
  }
  return pyodidePromise;
}

// pygame draws to one canvas per page. The project started last owns it, so
// starting a second game stops the first.
let stopCanvasOwner = null;

// pygame's set_caption writes the tab title; it is put back when a game ends.
const PAGE_TITLE = document.title;

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

// Downloads the project's packages and Python files into Pyodide and returns
// the ctx object handed to its interface.
async function loadProject(id, manifest, baseUrl) {
  const pyodide = await getPyodide();

  if (manifest.packages?.length) {
    await pyodide.loadPackage(manifest.packages);
  }
  if (manifest.pypi?.length) {
    await pyodide.loadPackage("micropip");
    await pyodide.pyimport("micropip").install(manifest.pypi);
  }

  // Files come from the project folder, or from `source` when the manifest
  // points at another location such as a raw.githubusercontent.com folder.
  const sourceUrl = manifest.source ? new URL(manifest.source, baseUrl) : baseUrl;
  const dir = `${FS_ROOT}/${id}`;
  const files = await Promise.all(
    (manifest.files ?? []).map(async (file) => {
      const res = await fetchOk(new URL(file, sourceUrl));
      return [file, await res.text()];
    }),
  );
  for (const [file, text] of files) {
    const path = `${dir}/${file}`;
    pyodide.FS.mkdirTree(path.slice(0, path.lastIndexOf("/")));
    pyodide.FS.writeFile(path, text);
  }

  const siteImport = pyodide.globals.get("_site_import");
  const siteCall = pyodide.globals.get("_site_call");
  const siteStart = pyodide.globals.get("_site_start");
  const siteStop = pyodide.globals.get("_site_stop");
  let module = null;

  const ctx = {
    pyodide,
    manifest,
    canvas: null,
    url: (path) => new URL(path, baseUrl).href,
    get module() {
      module ??= siteImport(dir, manifest.entry);
      return module;
    },
    call: (name, ...args) => JSON.parse(siteCall(ctx.module, name, JSON.stringify(args))),
    stop: () => siteStop(id),
    // Resolves true when the run finished on its own, false when stopped.
    async start(fn = manifest.main, entry = manifest.entry) {
      if (stopCanvasOwner && stopCanvasOwner !== ctx.stop) stopCanvasOwner();
      ctx.stop();
      if (ctx.canvas) {
        // SDL finds its input events through the element with id "canvas".
        document.getElementById("canvas")?.removeAttribute("id");
        ctx.canvas.id = "canvas";
        pyodide.canvas.setCanvas2D(ctx.canvas);
        stopCanvasOwner = ctx.stop;
      }
      module = siteImport(dir, entry, true);
      const done = siteStart(id, module, fn);
      try {
        return done ? await done : true;
      } finally {
        if (ctx.canvas && stopCanvasOwner === ctx.stop) document.title = PAGE_TITLE;
      }
    },
  };

  if (manifest.canvas) {
    const canvas = document.createElement("canvas");
    canvas.className = "project-canvas";
    canvas.width = manifest.canvas.width;
    canvas.height = manifest.canvas.height;
    ctx.canvas = canvas;
  }
  return ctx;
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderProject(container, id, manifest) {
  const baseUrl = new URL(`${id}/`, PROJECTS_URL);
  const section = el("section", { class: "project", id: `project-${id}` });
  section.append(el("h2", {}, manifest.title ?? id));
  if (manifest.description) section.append(el("p", {}, manifest.description));

  const ui = el("div", { class: "project-ui" });
  const start = el("button", { class: "button", type: "button" }, "Start");
  const status = el("div", { class: "project-status meta", role: "status" });
  ui.append(start);
  section.append(ui, status);
  container.append(section);

  if (manifest.style) {
    document.head.append(el("link", { rel: "stylesheet", href: new URL(manifest.style, baseUrl).href }));
  }

  const showError = (err) => {
    console.error(`[fun] ${id}:`, err);
    status.classList.add("project-error");
    status.textContent = `Error: ${err.message ?? err}`;
  };

  start.addEventListener("click", async () => {
    start.disabled = true;
    status.classList.remove("project-error");
    status.textContent = pyodidePromise ? "Loading…" : "Loading Python (first time only, a few seconds)…";
    let ctx;
    try {
      // A pygame project ("main" set) needs no interface module unless it names one.
      const uiPath = manifest.ui ?? (manifest.main ? null : "ui.js");
      const [loaded, uiModule] = await Promise.all([
        loadProject(id, manifest, baseUrl),
        uiPath ? import(new URL(uiPath, baseUrl).href) : null,
      ]);
      ctx = loaded;
      ui.replaceChildren();
      if (ctx.canvas) ui.append(ctx.canvas);
      status.textContent = "";
      if (uiModule) {
        await uiModule.default(ui, ctx, { showError });
      } else if (manifest.main) {
        // With no interface, Start is the only control: put it back under
        // the canvas once the game ends or another game takes the canvas.
        await ctx.start();
        start.textContent = "Play again";
        start.disabled = false;
        ui.append(start);
      }
    } catch (err) {
      showError(err);
      if (!ctx) start.disabled = false;
    }
  });
}

async function main() {
  const container = document.getElementById("projects");
  let ids;
  try {
    ids = await (await fetchOk(new URL("projects.json", PROJECTS_URL))).json();
  } catch (err) {
    console.error("[fun]", err);
    container.append(el("p", { class: "project-error" }, `Could not load projects: ${err.message ?? err}`));
    return;
  }
  // One broken manifest shows an error in its own spot instead of hiding the rest.
  const manifests = await Promise.allSettled(
    ids.map(async (id) => (await fetchOk(new URL(`${id}/manifest.json`, PROJECTS_URL))).json()),
  );
  ids.forEach((id, i) => {
    const result = manifests[i];
    if (result.status === "fulfilled") {
      renderProject(container, id, result.value);
    } else {
      console.error(`[fun] ${id}:`, result.reason);
      container.append(el("p", { class: "project-error" }, `Could not load project "${id}": ${result.reason.message ?? result.reason}`));
    }
  });
}

main();
