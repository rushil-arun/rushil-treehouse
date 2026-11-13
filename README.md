# personal-site

A plain static site with three tabs: About, Blog, and Fun. There is no build step; everything that gets published lives in `site/`. The Fun tab runs Python projects in the browser with [Pyodide](https://pyodide.org).

It is published at https://rushil-arun.github.io/personal-site/. Every link is relative, so the same files work under that path and on a local server.

## Preview locally

```sh
python3 -m http.server 8000 --directory site
```

Then open http://localhost:8000/. Opening the HTML files directly (`file://`) does not work, because the Fun page fetches its project files.

## Layout

```
site/
  index.html            redirects to about/
  assets/style.css      all site styles; fonts in assets/fonts/
  about/index.html      About tab
  blog/index.html       Blog tab: the list of posts
  blog/<slug>/index.html  one folder per post
  fun/index.html        Fun tab
  fun/fun.js            loads Pyodide and renders every project
  fun/projects/projects.json   which projects appear, in order
  fun/projects/<id>/    one folder per project
```

## Add a blog post

1. Copy a post folder, such as `site/blog/placeholder-post-one/`, to `site/blog/<your-slug>/`.
2. In the new `index.html`, change the `<title>`, the `<h1>`, the date in `<time>`, and the body inside `<article>`.
3. In `site/blog/index.html`, copy one `<li>` to the top of the list and set its `href` to `<your-slug>/`, its title, and its date.

## Add a project to the Fun tab

Each project is a folder under `site/fun/projects/` with three things: the Python code, a `manifest.json`, and a small JavaScript interface. `site/fun/projects/2048/` is a working example.

1. **Copy the Python in.** Make `site/fun/projects/<id>/` and copy the project's `.py` files into it, keeping any subfolders. The files run unchanged; the folder is put first on `sys.path`, so imports like `from board import Board` work.

2. **Write `manifest.json`:**

   ```json
   {
     "title": "Chess bot",
     "description": "One sentence shown under the title.",
     "entry": "engine",
     "files": ["engine.py", "board.py", "pieces/__init__.py"],
     "packages": [],
     "pypi": [],
     "ui": "ui.js",
     "style": "ui.css"
   }
   ```

   - `entry`: the module the interface talks to (`engine` means `engine.py`).
   - `files`: every Python file to load, relative to the project folder. A static host cannot list a folder, so each file must be named here.
   - `packages` (optional): packages that ship with Pyodide, such as `numpy`. The [list of included packages](https://pyodide.org/en/stable/usage/packages-in-pyodide.html) shows what is available.
   - `pypi` (optional): pure-Python packages to install from PyPI with micropip.
   - `ui` (optional, default `ui.js`): the interface module.
   - `style` (optional): a stylesheet for the interface.
   - `source` (optional): load the `files` from another URL instead of the project folder, for example `"https://raw.githubusercontent.com/<user>/<repo>/main/"` to run the code straight from a public GitHub repo. The manifest and interface still live in the project folder.

3. **Write the interface** (`ui.js`), an ES module whose default export draws the project into the page:

   ```js
   export default function mount(root, ctx) {
     const out = document.createElement("pre");
     out.textContent = ctx.call("best_move", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w");
     root.append(out);
   }
   ```

   `ctx.call(name, ...args)` calls `name` in the entry module and returns its result. Arguments and results pass through JSON, so use lists, dicts, strings, numbers, booleans, and `None`. If the project's functions take other types, add a small wrapper function in Python. For anything else, `ctx.module` is the entry module and `ctx.pyodide` is the Pyodide instance. `ctx.url("file.png")` gives the URL of a file in the project folder.

4. **List it.** Add the folder name to `site/fun/projects/projects.json`. Projects appear in that order.

Each project shows a Start button. The first Start on a page downloads Pyodide (several MB, once); every project on the page then shares it. Python runs on the page's main thread, so keep each call short: a long search freezes the page until it returns.

**What will not run:** Pyodide is CPython compiled to WebAssembly. Packages with native code (C, C++, Rust extensions) run only if Pyodide ships a build of them (see the package list above), and micropip can only install pure-Python wheels. Programs that need threads, subprocesses, sockets, or a desktop GUI toolkit (tkinter, pygame windows) also will not work; the interface has to be rewritten as `ui.js`.

## Deploy

`.github/workflows/pages.yml` publishes `site/` to GitHub Pages on every push to `main`. In the repository's Settings → Pages, set **Source** to **GitHub Actions** once.

## Credits

Fonts: Atkinson Hyperlegible by the Braille Institute, under the SIL Open Font License (`site/assets/fonts/OFL.txt`).
