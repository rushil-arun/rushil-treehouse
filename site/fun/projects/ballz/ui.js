// Two modes for Ballz: play it yourself (ballBlocks.py) or watch the AI
// (ballBlocksAI.py). Both are the original pygame programs; the loader puts
// them on the canvas and this file only adds the mode buttons.

const MODES = {
  play: { entry: "ballBlocks", label: "Play", running: "Aim with the mouse and click to shoot." },
  ai: { entry: "ballBlocksAI", label: "Watch the AI", running: "The AI picks every shot." },
};

export default function mount(root, ctx, { showError }) {
  const controls = document.createElement("div");
  controls.className = "ballz-controls";
  const note = document.createElement("span");
  note.className = "meta";
  let runId = 0;

  async function run(mode) {
    const id = ++runId;
    note.textContent = MODES[mode].running;
    try {
      // False when this run was stopped: by the other mode button, or by
      // another pygame game on the page taking the canvas.
      const finished = await ctx.start("game", MODES[mode].entry);
      if (id === runId) {
        note.textContent = finished ? "Game over. Pick a mode to play again." : "Stopped. Pick a mode to play again.";
      }
    } catch (err) {
      if (id === runId) showError(err);
    }
  }

  for (const [mode, { label }] of Object.entries(MODES)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "button";
    b.textContent = label;
    b.addEventListener("click", () => run(mode));
    controls.append(b);
  }
  controls.append(note);
  root.append(controls);
  run("play");
}
