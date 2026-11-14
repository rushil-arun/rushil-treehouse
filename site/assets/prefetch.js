// Runs on every page except Fun. Once the page has loaded and the browser is
// idle, it downloads what the Fun page needs (Pyodide, the packages the
// projects ask for, the project files) so those requests are already in the
// browser's HTTP cache when the visitor opens Fun. It starts nothing and
// stores nothing itself; a full page navigation just finds the files cached.
// Skipped on Save-Data and slow (2g) connections. All failures are ignored.

const FUN = new URL("../fun/", import.meta.url);
const PROJECTS = new URL("projects/", FUN);

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// Fetch only to fill the HTTP cache; the body is dropped. Low priority keeps it
// from competing with anything the current page is doing.
function warm(url) {
  return fetch(url, { priority: "low" }).then((res) => res.arrayBuffer()).catch(() => {});
}

async function prefetch() {
  const { PYODIDE_URL } = await import(new URL("pyodide-config.js", FUN).href);
  const ids = await json(new URL("projects.json", PROJECTS));
  const manifests = await Promise.all(
    ids.map((id) => json(new URL(`${id}/manifest.json`, PROJECTS)).then((m) => [id, m], () => null)),
  );

  const urls = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide-lock.json", "pyodide.asm.wasm", "python_stdlib.zip"].map(
    (f) => PYODIDE_URL + f,
  );

  // Packages (with their dependencies) come from Pyodide's own package index.
  const wanted = new Set();
  for (const entry of manifests) for (const p of entry?.[1].packages ?? []) wanted.add(p);
  if (wanted.size) {
    const { packages } = await json(PYODIDE_URL + "pyodide-lock.json");
    const queue = [...wanted];
    const seen = new Set();
    while (queue.length) {
      const name = queue.pop().toLowerCase().replace(/_/g, "-");
      if (seen.has(name) || !packages[name]) continue;
      seen.add(name);
      urls.push(PYODIDE_URL + packages[name].file_name);
      queue.push(...(packages[name].depends ?? []));
    }
  }

  for (const entry of manifests) {
    if (!entry) continue;
    const [id, m] = entry;
    const base = new URL(`${id}/`, PROJECTS);
    const files = [...(m.files ?? []).map((f) => new URL(f, m.source ? new URL(m.source, base) : base))];
    files.push(new URL(m.ui ?? "ui.js", base));
    if (m.style) files.push(new URL(m.style, base));
    urls.push(...files.map((u) => u.href));
  }

  // Two at a time: gentle on the connection, and the big files start first.
  const queue = [...new Set(urls)];
  await Promise.all([0, 1].map(async () => { while (queue.length) await warm(queue.shift()); }));
}

function start() {
  const conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType ?? ""))) return;
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1000));
  idle(() => prefetch().catch(() => {}), { timeout: 5000 });
}

if (document.readyState === "complete") start();
else window.addEventListener("load", start, { once: true });
