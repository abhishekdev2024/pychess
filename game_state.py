from typing import Optional, List, Any
import chess
from datetime import datetime

import chess

def evaluate_board(board: chess.Board) -> dict:
    piece_values = {
        chess.PAWN: 1,
        chess.KNIGHT: 3,
        chess.BISHOP: 3,
        chess.ROOK: 5,
        chess.QUEEN: 9,
        chess.KING: 0,  
    }

    # Initialize scores
    white_score, black_score = 0, 0

    # Piece counters
    white_pieces = {chess.PAWN: 0, chess.KNIGHT: 0, chess.BISHOP: 0, chess.ROOK: 0, chess.QUEEN: 0, chess.KING: 0}
    black_pieces = {chess.PAWN: 0, chess.KNIGHT: 0, chess.BISHOP: 0, chess.ROOK: 0, chess.QUEEN: 0, chess.KING: 0}

    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            piece_value = piece_values.get(piece.piece_type, 0)
            if piece.color == chess.WHITE:
                white_score += piece_value
                white_pieces[piece.piece_type] += 1
            else:
                black_score += piece_value
                black_pieces[piece.piece_type] += 1

    # Calculate total pieces left for each color
    white_piece_count = sum(white_pieces.values())
    black_piece_count = sum(black_pieces.values())

    return {
        "w_score": white_score,
        "b_score": black_score,
        "w_pieces": white_piece_count,
        "b_pieces": black_piece_count,
        "w_piece_details": white_pieces,
        "b_piece_details": black_pieces
    }



def calculate_move_value(move: chess.Move) -> int:
    if move.is_capture():
        return 1
    if move.is_castling():
        return 2
    return 0


class GameState:
    def __init__(
        self,
        game_id: str,
        is_vs_bot: bool = False,
        player1: Optional[str] = None,
        player2: Optional[str] = None,
        board: chess.Board = chess.Board()
    ):
        self.game_id = game_id
        self.is_vs_bot = is_vs_bot
        self.player1 = player1 or "Player 1"
        self.player2 = (player2 or "Player 2") if not is_vs_bot else "Computer"
        self.board = board
        self.game_started = False
        self.has_game_over = False
        self.is_game_draw = False
        self.result = None
        self.move_history: List[Any] = []
        self.suggestion_credit = 10
        self.player1_score = 0
        self.player2_score = 0
        self.current_turn = True
        self.white_pieces_left = 0
        self.black_pieces_left = 0
        self.white_pieces_details = {}
        self.black_pieces_details = {}

    def start_game(self) -> None:
        self.game_started = True

    def end_game(self) -> None:
        self.has_game_over = True
        self.result = self.calculate_game_result()

    def is_game_drawn(self) -> bool:
        return self.board.is_insufficient_material() or self.board.is_seventyfive_moves() or self.board.is_fivefold_repetition()

    def calculate_game_result(self) -> Optional[str]:
        # Checkmate
        if self.board.is_checkmate():
            return "1-0" if self.board.turn == chess.BLACK else "0-1"
        # Draw conditions
        if self.board.is_stalemate() or self.is_game_drawn():
            self.is_game_draw = True
            return "1/2-1/2"
        # No result yet
        return None

    def update_game_state(self) -> None:
        self.has_game_over = self.board.is_game_over() or self.is_game_drawn()
        self.result = self.calculate_game_result()

    def add_move(self, move: chess.Move) -> None:
        move_data = self.create_move_data(move)

        self.update_scores()
        self.move_history.append(move_data)
        self.update_game_state()

    def create_move_data(self, move: chess.Move) -> dict:
        player = self.player1 if self.board.turn == chess.WHITE else self.player2
        color = "White" if self.board.turn == chess.WHITE else "Black"
        return {
            "move": str(move),
            "player": player,
            "color": color,
            "ts": datetime.now().isoformat(),
        }

    def update_scores(self) -> None:
        board_value = evaluate_board(self.board)
        self.player1_score = board_value.get("w_score", 0)
        self.player2_score = board_value.get("b_score", 0)
        self.white_pieces_left = board_value.get("w_pieces", 0)
        self.black_pieces_left = board_value.get("b_pieces", 0)
        self.white_pieces_details = board_value.get("w_piece_details", {})
        self.black_pieces_details = board_value.get("b_piece_details", {})
        self.current_turn = self.board.turn

    def update_credit(self) -> None:
        if self.suggestion_credit > 0:
            self.suggestion_credit -= 1

    def get_game_status_message(self) -> str:
        if self.has_game_over:
            return self.get_game_end_message()

        if not self.game_started:
            return "The game has not started yet."

        return self.get_ongoing_game_message()

    def get_game_end_message(self) -> str:
        if self.result == "1-0":
            return f"{self.player1} wins!"
        elif self.result == "0-1":
            return f"{self.player2} wins!"
        elif self.is_game_draw:
            return "The game is a draw."
        else:
            return "Game over, no result."

    def get_ongoing_game_message(self) -> str:
        current_turn_player = self.player1 if self.board.turn == chess.WHITE else self.player2
        current_turn_color = "White" if self.board.turn == chess.WHITE else "Black"
        return f"The game is ongoing. It's {current_turn_player}'s turn ({current_turn_color})."

    def get_json(self) -> dict:
        return {
            "game_id": self.game_id,
            "is_vs_bot": self.is_vs_bot,
            "player1": self.player1,
            "player2": self.player2,
            "game_started": self.game_started,
            "has_game_over": self.has_game_over,
            "move_history": self.move_history,
            "current_turn": self.current_turn,
            "white_score": self.player1_score,
            "black_score": self.player2_score,
            "result": self.result,
            "message": self.get_game_status_message(),
            "white_pieces_left": self.white_pieces_left,
            "black_pieces_left": self.black_pieces_left,
            "white_pieces_details": self.white_pieces_details,
            "black_pieces_details": self.black_pieces_details,
            "white_piece_moves":sum(1 for move in self.move_history if move.get("color") == "White"),
            "black_piece_moves":sum(1 for move in self.move_history if move.get("color") == "Black"),
        }
