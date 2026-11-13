"""Rules of 2048 on a 4x4 board. Boards are lists of lists of ints; 0 is empty."""

import random

SIZE = 4
DIRECTIONS = ("up", "down", "left", "right")


def _slide_row_left(row):
    """Slide one row to the left, merging equal neighbours once. Returns (row, points)."""
    tiles = [v for v in row if v]
    merged, points, i = [], 0, 0
    while i < len(tiles):
        if i + 1 < len(tiles) and tiles[i] == tiles[i + 1]:
            merged.append(tiles[i] * 2)
            points += tiles[i] * 2
            i += 2
        else:
            merged.append(tiles[i])
            i += 1
    return merged + [0] * (SIZE - len(merged)), points


def _transpose(board):
    return [list(col) for col in zip(*board)]


def _reverse(board):
    return [row[::-1] for row in board]


def slide(board, direction):
    """Apply a move without spawning a tile. Returns (new_board, points, moved)."""
    if direction not in DIRECTIONS:
        raise ValueError(f"unknown direction: {direction!r}")
    b = board
    if direction in ("up", "down"):
        b = _transpose(b)
    if direction in ("right", "down"):
        b = _reverse(b)
    rows, points = [], 0
    for row in b:
        new_row, gained = _slide_row_left(row)
        rows.append(new_row)
        points += gained
    if direction in ("right", "down"):
        rows = _reverse(rows)
    if direction in ("up", "down"):
        rows = _transpose(rows)
    return rows, points, rows != board


def empty_cells(board):
    return [(r, c) for r in range(SIZE) for c in range(SIZE) if board[r][c] == 0]


def spawn_tile(board):
    """Put a 2 (90%) or a 4 (10%) in a random empty cell, in place."""
    cells = empty_cells(board)
    if cells:
        r, c = random.choice(cells)
        board[r][c] = 4 if random.random() < 0.1 else 2
    return board


def is_over(board):
    return all(not slide(board, d)[2] for d in DIRECTIONS)


def new_game():
    board = [[0] * SIZE for _ in range(SIZE)]
    spawn_tile(board)
    spawn_tile(board)
    return {"board": board, "score": 0, "over": False}


def step(state, direction):
    """Play one move. Returns the next state; an illegal move returns the state unchanged."""
    board, points, moved = slide(state["board"], direction)
    if not moved:
        return state
    spawn_tile(board)
    return {"board": board, "score": state["score"] + points, "over": is_over(board)}
