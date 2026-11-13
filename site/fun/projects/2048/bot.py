"""A small 2048 bot: a two-ply expectimax search over a simple board heuristic.

This module is the project's entry point, so it also re-exports the game
functions the interface calls.
"""

from game import DIRECTIONS, SIZE, empty_cells, new_game, slide, step  # noqa: F401


def _score(board):
    """Prefer empty cells, big tiles in a corner, and rows/columns that are monotonic."""
    empties = len(empty_cells(board))
    corner = max(board[0][0], board[0][-1], board[-1][0], board[-1][-1])
    biggest = max(max(row) for row in board)
    mono = 0
    for line in board + [list(col) for col in zip(*board)]:
        inc = sum(max(0, b - a) for a, b in zip(line, line[1:]))
        dec = sum(max(0, a - b) for a, b in zip(line, line[1:]))
        mono -= min(inc, dec)
    return empties * 270 + (biggest if corner == biggest else 0) * 2 + mono


def _best_after_spawn(board):
    """Value of a board where a tile is about to spawn, then we move greedily."""
    cells = empty_cells(board)
    if not cells:
        return _score(board)
    total = 0.0
    for r, c in cells:
        for value, prob in ((2, 0.9), (4, 0.1)):
            board[r][c] = value
            best = None
            for d in DIRECTIONS:
                nxt, points, moved = slide(board, d)
                if moved:
                    v = _score(nxt) + points
                    best = v if best is None else max(best, v)
            total += prob * (best if best is not None else -10_000)
            board[r][c] = 0
    return total / len(cells)


def best_move(board):
    """Return the direction the bot would play, or None when no move is possible."""
    best_dir, best_val = None, None
    for d in DIRECTIONS:
        nxt, points, moved = slide(board, d)
        if not moved:
            continue
        val = points + _best_after_spawn(nxt)
        if best_val is None or val > best_val:
            best_dir, best_val = d, val
    return best_dir
