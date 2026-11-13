// Interface for the 2048 project. The game rules and the bot live in Python
// (game.py, bot.py); this file only draws the board and forwards input.

const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
const ARROWS = [["←", "left"], ["↑", "up"], ["↓", "down"], ["→", "right"]];

function button(label, onClick, title) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "button";
  b.textContent = label;
  if (title) b.setAttribute("aria-label", title);
  b.addEventListener("click", onClick);
  return b;
}

export default function mount(root, ctx) {
  let state = ctx.call("new_game");
  let timer = null;

  const score = document.createElement("div");
  score.className = "g2048-score meta";

  const board = document.createElement("div");
  board.className = "g2048-board";
  board.tabIndex = 0;
  board.setAttribute("role", "grid");
  board.setAttribute("aria-label", "2048 board, use the arrow keys to move");

  const controls = document.createElement("div");
  controls.className = "g2048-controls";
  const auto = button("Auto-play", () => (timer ? stop() : startAuto()));
  controls.append(
    ...ARROWS.map(([label, dir]) => button(label, () => play(dir), `Move ${dir}`)),
    button("Bot move", botMove),
    auto,
    button("New game", () => { stop(); state = ctx.call("new_game"); render(); }),
  );

  root.append(score, board, controls);

  function render() {
    board.replaceChildren(
      ...state.board.flat().map((value) => {
        const cell = document.createElement("div");
        cell.className = "g2048-cell";
        if (value) {
          cell.textContent = value;
          // Darker tiles for bigger numbers, in the page's own colors.
          const level = Math.min(Math.log2(value), 11);
          cell.style.setProperty("--level", `${level * 8}%`);
          cell.dataset.big = level >= 6 ? "1" : "";
        }
        return cell;
      }),
    );
    score.textContent = `Score ${state.score}${state.over ? " · game over" : ""}`;
  }

  function play(dir) {
    if (state.over) return;
    state = ctx.call("step", state, dir);
    render();
  }

  function botMove() {
    const dir = ctx.call("best_move", state.board);
    if (dir) play(dir);
    return dir;
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    auto.textContent = "Auto-play";
  }

  function startAuto() {
    auto.textContent = "Stop";
    const tick = () => {
      if (!botMove() || state.over) return stop();
      timer = setTimeout(tick, 80);
    };
    timer = setTimeout(tick, 0);
  }

  board.addEventListener("keydown", (e) => {
    const dir = KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    play(dir);
  });

  render();
  board.focus({ preventScroll: true });
}
