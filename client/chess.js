const chessPieceSymbols = {
  white: {
    K: "♔", // Unicode: \u2654
    Q: "♕", // Unicode: \u2655
    R: "♖", // Unicode: \u2656
    B: "♗", // Unicode: \u2657
    N: "♘", // Unicode: \u2658
    P: "♙", // Unicode: \u2659
  },
  black: {
    K: "♚", // Unicode: \u265A
    Q: "♛", // Unicode: \u265B
    R: "♜", // Unicode: \u265C
    B: "♝", // Unicode: \u265D
    N: "♞", // Unicode: \u265E
    P: "♟", // Unicode: \u265F
  },
};

const players = ["white", "black"];
const statTypes = [
  { id: "score", label: "Score", badgeClass: "bg-primary", defaultValue: 0 },
  {
    id: "king-count",
    label: "K",
    badgeClass: "bg-secondary",
    defaultValue: 1,
  },
  {
    id: "queen-count",
    label: "Q",
    badgeClass: "bg-secondary",
    defaultValue: 1,
  },
  {
    id: "rook-count",
    label: "R",
    badgeClass: "bg-secondary",
    defaultValue: 2,
  },
  {
    id: "bishop-count",
    label: "B",
    badgeClass: "bg-secondary",
    defaultValue: 2,
  },
  {
    id: "knight-count",
    label: "N",
    badgeClass: "bg-secondary",
    defaultValue: 2,
  },
  {
    id: "pawn-count",
    label: "P",
    badgeClass: "bg-secondary",
    defaultValue: 8,
  },
];

class ChessGame {
  constructor() {
    this.boardSize = 8;
    this.apiBaseUrl = "http://127.0.0.1:5000"; // Base URL for server API

    // Initialize essential components
    this.initializeElements();

    this.modeValue = null;
    this.board = [];
    this.draggedPiece = null;
    this.game_json = null;
    this.playerStatsElements = {
      white: {},
      black: {},
    };
    this.chessSquareElements = {};
    this.initializePlayerStatsContainer("white-stats", "white");
    this.initializePlayerStatsContainer("black-stats", "black");
    this.init();
  }

  init() {
    this.addEventListeners();
    // this.toast("Welcome to Chess Game!");
  }

  // Method to initialize DOM elements
  initializeElements() {
    this.boardContainer = document.querySelector("#board");
    this.timerElement = document.querySelector("#game-timer");
    this.notificationContainer = document.querySelector(
      "#notification-container"
    );
    this.modeSelect = document.querySelector("#game-mode");
    this.playerInfoModal = document.getElementById("playerNameModal");
    this.cancelInfoModal = document.querySelector("#playerNameModal-cancel");
    this.saveInfoModal = document.querySelector("#playerNameModal-start");
    this.player1Input = document.querySelector("#player1-name");
    this.player2Input = document.querySelector("#player2-name");
    this.infoFormGroups = document.querySelectorAll(".form-group");
    this.startBtn = document.getElementById("btn-start");
    this.player1Name = document.getElementById("player1-name-view");
    this.player2Name = document.getElementById("player2-name-view");
    this.currentIndicator = document.getElementById("current-turn");
    this.resetBtn = document.getElementById("btn-reset");
    this.playerContainer = document.getElementById("player-name-container");
    if (this.playerContainer) this.playerContainer.style.opacity = "0";
    if (this.resetBtn) this.resetBtn.disabled = true;
  }

  async apiCall(endpoint, method = "GET", body = null) {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };

    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${errorText}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse;
  }

  resetGame() {
    this.boardContainer.innerHTML = "";
    this.board = [];
    this.draggedPiece = null;
    this.game_json = null;
    this.modeValue = null;
    this.startBtn.disabled = false;
    this.resetBtn.disabled = true;
    for (const formGroup of this.infoFormGroups) {
      formGroup.classList.remove("d-none");
    }
    this.toast("Game reset!");
  }
  handleInfoModal(action = "open") {
    const is_vs_bot = this.modeValue === "pvb";
    for (const formGroup of this.infoFormGroups) {
      if (formGroup.classList.contains("player2") && is_vs_bot) {
        formGroup.classList.toggle("d-none");
      }
    }
    this.playerInfoModal.classList.toggle("modal-show");
  }

  async updateGameState(response) {
    this.game_json = response?.game_json || {};
    this.board = response?.board_state || [];
    this.player1Name.textContent = this.game_json?.player1;
    this.player2Name.textContent = this.game_json?.player2;
    this.updatePlayerStats("white", this.game_json);
    this.updatePlayerStats("black", this.game_json);
    if (this.board.length > 0) {
      this.renderBoard(this.board);
      await this.afterSuccessMove(this.game_json);
    }
  }

  async startGame() {
    try {
      this.handleInfoModal();
      const player1 = this.player1Input?.value;
      const player2 = this.player2Input?.value;
      const payload = {
        is_vs_bot: this.modeValue === "pvb",
        player1,
        player2,
      };
      const response = await this.apiCall("/start-game", "POST", payload);
      await this.updateGameState(response);
      this.startBtn.disabled = true;
      // enable the reset button
      this.resetBtn.disabled = false;
      this.playerContainer.style.opacity = "1";
    } catch (error) {
      console.error("Failed to start game:", error);
      this.toast(error.message, "error");
    }
  }

  async afterSuccessMove(game_json) {
    const {
      is_vs_bot,
      game_started,
      has_game_over,
      message,
      current_turn,
      move_history,
    } = game_json;

    if (has_game_over) {
      this.toast(message, "success", true);
      this.resetGame();
      this.replayGameMoves(move_history);
      return;
    }

    if (!game_started) {
      this.toast("Game has not started yet!", "error");
      return;
    }
    this.currentIndicator.textContent = message;
    if (!current_turn && is_vs_bot) {
      return await this.makeBotMove();
    }

    // Update the scores
    // this.updateScores(player1_score, player2_score);
  }

  // chess.PAWN: 0, chess.KNIGHT: 0, chess.BISHOP: 0, chess.ROOK: 0, chess.QUEEN: 0, chess.KING

  updatePlayerStats(playerColor, game_json) {
    // "white_pieces_left": self.white_pieces_left,
    // "black_pieces_left": self.black_pieces_left,
    // "white_pieces_details": self.white_pieces_details,
    // "black_pieces_details": self.black_pieces_details,
    // "white_piece_moves":sum(1 for move in self.move_history if move.color == "White"),
    // "black_piece_moves":sum(1 for move in self.move_history if move.color == "Black"),
    const mapData = {
      1: "P",
      2: "N",
      3: "B",
      4: "R",
      5: "Q",
      6: "K",
    };
    const statData = {
      [`${playerColor}_pieces_left`]: game_json[`${playerColor}_pieces_left`],
      [`${playerColor}_piece_moves`]: game_json[`${playerColor}_piece_moves`],
      [`${playerColor}_pieces_details`]:
        game_json[`${playerColor}_pieces_details`],
    };
    console.log(statData);
    // statTypes.forEach((stat) => {
    //   console.log(stat);
    // })
    // statTypes.forEach((stat) => {
    //   const badge = this.playerStatsElements[player][stat.id];
    //   badge.textContent = stats[stat.id];
    // });
  }

  initializePlayerStatsContainer(containerId, player) {
    const container = document.getElementById(containerId);

    if (!container) {
      console.error(`Container with ID '${containerId}' not found.`);
      return;
    }

    statTypes.forEach((stat) => {
      // Create list item
      const listItem = document.createElement("li");
      listItem.className =
        "list-group-item d-flex justify-content-between align-items-center";

      // Add label
      if (stat.id === "score") {
        listItem.textContent = stat.label;
      } else {
        listItem.textContent = chessPieceSymbols[player][stat.label];
      }

      // Create badge span
      const badge = document.createElement("span");
      badge.id = `${player}-${stat.id}`;
      badge.className = `badge ${stat.badgeClass} rounded-pill`;
      badge.textContent = stat.defaultValue;

      listItem.appendChild(badge);

      container.appendChild(listItem);

      this.playerStatsElements[player][stat.id] = badge;
    });
  }

  async makeBotMove() {
    try {
      const game_id = this.game_json?.game_id;
      const endpoint = `/bot-move?game_id=${game_id}&bot_type=minmax`;
      const response = await this.apiCall(endpoint);
      await this.updateGameState(response);
    } catch (error) {
      console.error("Failed to get bot move:", error);
      this.toast(error.message, "error");
    }
  }

  async makeHumanMove(move) {
    try {
      const game_id = this.game_json?.game_id;
      const payload = {
        move,
        game_id,
      };
      const response = await this.apiCall("/human-move", "POST", payload);
      await this.updateGameState(response);
    } catch (error) {
      console.error("Failed to make human move:", error);
      this.toast(error.message, "error");
    }
  }

  createCellElelement(i, j, squareData) {
    const cellElement = document.createElement("div");
    cellElement.classList.add("cell");
    cellElement.dataset.move = this.generateSquareNotation(i, j);
    cellElement.title = this.generateSquareNotation(i, j);
    cellElement.classList.add(this.getSquareColor(i, j));

    const pieceElement = document.createElement("div");
    pieceElement.classList.add("piece");

    if (Array.isArray(squareData) && squareData.length === 2) {
      const [piece, color] = squareData;

      pieceElement.textContent = chessPieceSymbols[color][piece] || "";
    }

    pieceElement.draggable = true;
    cellElement.addEventListener("dragover", (e) => e.preventDefault());
    cellElement.addEventListener("drop", (e) => this.handleDrop(e));

    pieceElement.addEventListener("dragstart", (e) => this.handleDragStart(e));
    cellElement.appendChild(pieceElement);
    return cellElement;
  }

  generateSquareNotation(i, j) {
    const columns = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const rows = ["8", "7", "6", "5", "4", "3", "2", "1"];

    const row = rows[i];
    const col = columns[j];
    return `${col}${row}`;
  }

  getSquareColor(i, j) {
    return (i + j) % 2 === 0 ? "white" : "black";
  }

  replayGameMoves(board) {
    console.log("GAMES MOVE MADE TH PLAYER IN TH ENTIRE GAMES");
    console.table(board);
  }

  renderBoard(boardState) {
    this.boardContainer.innerHTML = "";

    for (let i = 0; i < boardState.length; i++) {
      const row = boardState[i];

      for (let j = 0; j < row.length; j++) {
        const cellElement = this.createCellElelement(i, j, row[j]);
        this.boardContainer.appendChild(cellElement);
        this.chessSquareElements[`${i}-${j}`] = cellElement;
      }
    }
  }

  async handleBotVsBot(initialCall = true) {
    try {
      const payload = {
        is_vs_bot: false,
        player1: "Minmax",
        player2: "Computer",
      };
      if (initialCall) {
        this.playerContainer.style.opacity = "1";
        const response = await this.apiCall("/start-game", "POST", payload);
        await this.updateGameState(response);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (this.game_json.has_game_over) {
        return this.toast("Game Over!", "error");
      }
      await this.makeBotMove();
      await this.handleBotVsBot(false);
    } catch (error) {
      this.toast(error.message, "error");
    }
  }

  handleGameMode(event) {
    const { value } = event.target;
    if (!value) return this.toast("Please select a game mode", "error");
    this.modeValue = value;
    if (this.modeValue === "bvb") {
      this.toast("Bot vs Bot Game running!", "error");
      this.startBtn.disabled = true;
      this.resetBtn.disabled = true;
      this.modeSelect.disabled = true;
      this.handleBotVsBot();
    }
  }

  handleDragStart(event) {
    this.draggedPiece = {
      element: event?.target,
      from: event?.target?.parentElement?.dataset?.move,
    };
  }

  handleDrop(event) {
    const targetCell = event.target.closest(".cell");

    if (targetCell && this.draggedPiece) {
      const from = this.draggedPiece.from;
      const to = targetCell.dataset.move;
      if (!from || !to) return this.toast("Invalid move. Try again!", "error");
      if (from === to) return this.toast(`Select a different square`, "error");
      this.makeHumanMove(`${from}${to}`);
      this.draggedPiece = null;
    }
  }

  addEventListeners() {
    this.saveInfoModal.addEventListener("click", () => this.startGame());
    this.cancelInfoModal.addEventListener("click", () =>
      this.handleInfoModal("close")
    );

    this.startBtn?.addEventListener("click", () =>
      this.handleInfoModal("open")
    );
    this.resetBtn?.addEventListener("click", () => this.resetGame());
    this.modeSelect?.addEventListener("change", this.handleGameMode.bind(this));
  }

  toast(message, type, perisist = false) {
    const alertType =
      type === "success" ? "success" : type === "error" ? "danger" : "primary";
    const toast = document.createElement("div");
    toast.className = `alert text-center alert alert-${alertType} show`;
    toast.textContent = message;

    // Add the toast to the notification container
    this.notificationContainer.appendChild(toast);

    // Remove the toast after 3 seconds
    if (!perisist)
      setTimeout(() => {
        toast.classList.remove("show");
        toast.classList.add("fade");
        toast.addEventListener("transitionend", () => toast.remove());
      }, 3000);
  }
}

// Instantiate the game
const chessGame = new ChessGame();

// 1
// :
// 8
// 2
// :
// 2
// 3
// :
// 2
// 4
// :
// 2
// 5
// :
// 1
// 6
// :
// 1
