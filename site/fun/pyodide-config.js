// Where Pyodide is loaded from. Shared by fun.js (which runs it) and
// ../assets/prefetch.js (which warms the browser cache for it on other pages).
export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
