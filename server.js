const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const games = {};

class chess {
  constructor() {
    this.board = this.initBoard();
    this.turn = "white";
  }
  initBoard() {
    const emptyRow = Array(8).fill(null);
    const board = Array(8)
      .fill(null)
      .map(() => [...emptyRow]);
    const backRank = ["r", "n", "b", "q", "k", "b", "n", "r"];
    const setup = (color, row) => {
      for (let i = 0; i < 8; i++) {
        board[row][i] = { type: backRank[i], color };
        board[color === "w" ? row + 1 : row - 1][i] = { type: "p", color };
      }
    };

    setup("w", 0);
    setup("b", 7);

    return board;
  }
  getBoard() {
    return this.board;
  }
  getTurn() {
    return this.turn;
  }
  cloneBoard(board) {
    return board.map((row) =>
      row.map((piece) => (piece ? { ...piece } : null))
    );
  }
  isInBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  findKing(color, board = this.board) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === "k" && p.color === color[0]) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }
  isSquareAttacked(row, col, byColor, board = this.board) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== byColor[0]) continue;

        const from = { row: r, col: c };
        const to = { row, col };

        if (this.isValidPieceMove(p.type, from, to, board, true)) {
          return true;
        }
      }
    }
    return false;
  }
  isInCheck(color, board = this.board) {
    const kingPos = this.findKing(color, board);
    if (!kingPos) return false;
    return this.isSquareAttacked(
      kingPos.row,
      kingPos.col,
      color === "white" ? "black" : "white",
      board
    );
  }
  isCheckmate(color) {
    const board = this.board;
    for (let r1 = 0; r1 < 8; r1++) {
      for (let c1 = 0; c1 < 8; c1++) {
        const p = board[r1][c1];
        if (!p || p.color !== color[0]) continue;

        for (let r2 = 0; r2 < 8; r2++) {
          for (let c2 = 0; c2 < 8; c2++) {
            const from = { row: r1, col: c1 };
            const to = { row: r2, col: c2 };

            if (!this.isValidPieceMove(p.type, from, to, board)) continue;

            const testBoard = this.cloneBoard(board);
            testBoard[to.row][to.col] = { ...p };
            testBoard[from.row][from.col] = null;

            if (!this.isInCheck(color, testBoard)) {
              return false;
            }
          }
        }
      }
    }
    return true;
  }
  isValidPieceMove(type, from, to, board, ignoreTurn = false) {
    const piece = board[from.row][from.col];
    const target = board[to.row][to.col];

    if (!piece || (!ignoreTurn && piece.color !== this.turn[0])) return false;
    if (!this.isInBounds(to.row, to.col)) return false;
    if (target && target.color === piece.color) return false;

    const dr = to.row - from.row;
    const dc = to.col - from.col;

    switch (type) {
      case "p": {
        const direction = piece.color === "w" ? 1 : -1;
        const startRow = piece.color === "w" ? 1 : 6;
        const oneStep =
          from.row + direction === to.row && from.col === to.col && !target;
        const twoStep =
          from.row === startRow &&
          from.col === to.col &&
          to.row === from.row + 2 * direction &&
          !target &&
          !board[from.row + direction][from.col];
        const capture =
          Math.abs(dc) === 1 && to.row === from.row + direction && target;
        return oneStep || twoStep || capture;
      }
      case "r":
        return (dr === 0 || dc === 0) && this.clearPath(from, to, board);
      case "b":
        return Math.abs(dr) === Math.abs(dc) && this.clearPath(from, to, board);
      case "q":
        return (
          (Math.abs(dr) === Math.abs(dc) || dr === 0 || dc === 0) &&
          this.clearPath(from, to, board)
        );
      case "n":
        return (
          (Math.abs(dr) === 2 && Math.abs(dc) === 1) ||
          (Math.abs(dr) === 1 && Math.abs(dc) === 2)
        );
      case "k":
        return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
      default:
        return false;
    }
  }
  clearPath(from, to, board) {
    const dr = Math.sign(to.row - from.row);
    const dc = Math.sign(to.col - from.col);
    let r = from.row + dr;
    let c = from.col + dc;
    while (r !== to.row || c !== to.col) {
      if (board[r][c]) return false;
      r += dr;
      c += dc;
    }
    return true;
  }
  move(from, to) {
    const piece = this.board[from.row][from.col];
    if (!piece) return { error: "No piece at source" };

    if (!this.isValidPieceMove(piece.type, from, to, this.board)) {
      return { error: "Invalid move" };
    }

    const cloned = this.cloneBoard(this.board);
    cloned[to.row][to.col] = { ...piece };
    cloned[from.row][from.col] = null;

    if (this.isInCheck(this.turn, cloned)) {
      return { error: "You cannot move into check" };
    }

    this.board = cloned;
    const prevTurn = this.turn;
    this.turn = this.turn === "white" ? "black" : "white";

    const gameOver = this.isCheckmate(this.turn);
    const winner = gameOver ? prevTurn : null;

    return {
      board: this.board,
      turn: this.turn,
      gameOver,
      winner,
    };
  }
}
app.post("/game/start", (req, res) => {
  const gameId = uuidv4();
  games[gameId] = new chess();
  res.json({
    gameId,
    board: games[gameId].getBoard(),
    turn: games[gameId].getTurn(),
  });
});

app.get("/game/:gameId/state", (req, res) => {
  const { gameId } = req.params;
  const game = games[gameId];
  if (!game) return res.status(404).json({ error: "Game not found" });

  res.json({
    board: game.getBoard(),
    turn: game.getTurn(),
  });
});
app.post("/game/:gameId/move", (req, res) => {
  const { gameId } = req.params;
  const { from, to, color } = req.body;
  const game = games[gameId];
  if (!game) return res.status(404).json({ error: "Game not found" });

  const serverColor = game.getTurn();
  if (color !== serverColor) {
    return res.status(400).json({ error: `It's ${serverColor}'s turn` });
  }

  const result = game.move(from, to);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
});
app.listen(PORT, () => {
  console.log(`Chess server running at http://localhost:${PORT}`);
});
