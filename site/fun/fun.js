// Renders every project listed in projects/projects.json onto the Fun page.
//
// Each project folder holds its Python files, a manifest.json, and a small
// ES module interface (ui.js by default) that exports:
//
//   export default function mount(root, ctx) { ... }
//
// `root` is the element to draw into. `ctx` gives the interface:
//   ctx.call(name, ...args)  call a function in the entry module; arguments and
//                            the return value pass through JSON, so use plain
//                            lists, dicts, strings, numbers, and booleans
//   ctx.module               the imported entry module (a Pyodide PyProxy)
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
// same name, so two projects can each have their own `game.py`.
const BRIDGE = `
import importlib, json, sys

_SITE_ROOT = ${JSON.stringify(FS_ROOT)}

def _site_import(path, entry):
    for name, mod in list(sys.modules.items()):
        f = getattr(mod, "__file__", None) or ""
        if f.startswith(_SITE_ROOT + "/") and not f.startswith(path + "/"):
            del sys.modules[name]
    if path in sys.path:
        sys.path.remove(path)
    sys.path.insert(0, path)
    importlib.invalidate_caches()
    return importlib.import_module(entry)

def _site_call(module, name, args_json):
    return json.dumps(getattr(module, name)(*json.loads(args_json)))
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

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

// Downloads the project's packages and Python files into Pyodide and imports
// its entry module.
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

  const module = pyodide.globals.get("_site_import")(dir, manifest.entry);
  const siteCall = pyodide.globals.get("_site_call");
  return {
    pyodide,
    module,
    manifest,
    url: (path) => new URL(path, baseUrl).href,
    call: (name, ...args) => JSON.parse(siteCall(module, name, JSON.stringify(args))),
  };
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

  start.addEventListener("click", async () => {
    start.disabled = true;
    status.classList.remove("project-error");
    status.textContent = pyodidePromise ? "Loading…" : "Loading Python (first time only, a few seconds)…";
    try {
      const [ctx, uiModule] = await Promise.all([
        loadProject(id, manifest, baseUrl),
        import(new URL(manifest.ui ?? "ui.js", baseUrl).href),
      ]);
      ui.replaceChildren();
      status.textContent = "";
      await uiModule.default(ui, ctx);
    } catch (err) {
      console.error(`[fun] ${id}:`, err);
      status.classList.add("project-error");
      status.textContent = `Could not start: ${err.message ?? err}`;
      start.disabled = false;
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
