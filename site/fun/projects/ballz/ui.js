// Two modes for Ballz: play it yourself (ballBlocks.py) or watch the AI
// (ballBlocksAI.py). Both are the original pygame programs; the loader puts
// them on the canvas and this file only adds the mode buttons.

const MODES = {
  play: { entry: "ballBlocks", label: "Play", running: "Aim with the mouse and click to shoot." },
  ai: { entry: "ballBlocksAI", label: "Watch the AI", running: "The AI picks every shot." },
};

// Speed control for the AI, in game frames per second. The top step removes
// the limit, which is the pace the AI always ran at before.
const SPEEDS = [15, 30, 60, 120, 240, null];
const DEFAULT_SPEED = 1;
const speedLabel = (fps) => (fps === null ? "Full speed" : `${fps} fps`);

export default function mount(root, ctx, { showError }) {
  const controls = document.createElement("div");
  controls.className = "ballz-controls";
  const note = document.createElement("span");
  note.className = "meta";
  let runId = 0;
  let speedIndex = DEFAULT_SPEED;

  const speedBox = document.createElement("label");
  speedBox.className = "ballz-speed";
  const speedText = document.createElement("span");
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = SPEEDS.length - 1;
  slider.step = 1;
  slider.value = speedIndex;
  slider.setAttribute("aria-label", "AI speed");
  speedBox.append("AI speed ", slider, " ", speedText);
  speedBox.hidden = true;

  function applySpeed() {
    const fps = SPEEDS[speedIndex];
    speedText.textContent = speedLabel(fps);
    slider.setAttribute("aria-valuetext", speedLabel(fps));
    // Only the AI program has a speed; while Play runs there is nothing to set.
    if (!speedBox.hidden) ctx.call("set_speed", fps);
  }
  slider.addEventListener("input", () => {
    speedIndex = Number(slider.value);
    applySpeed();
  });

  async function run(mode) {
    const id = ++runId;
    note.textContent = MODES[mode].running;
    try {
      // False when this run was stopped by the other mode button.
      const running = ctx.start("game", MODES[mode].entry);
      // start() has imported the program by now but not yet begun its first frame.
      speedBox.hidden = mode !== "ai";
      applySpeed();
      const finished = await running;
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
  controls.append(speedBox, note);
  root.append(controls);
  run("play");
}
