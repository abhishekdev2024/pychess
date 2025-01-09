from flask import Flask, request, jsonify
import traceback
import uuid
from game import get_board_state,make_cdrill_move,make_deuterium_move,make_minmax_move,make_stockfish_move,make_human_move,undo_last_move,reset_board
from game_state import GameState
from flask_cors import CORS
import os


current_dir = os.path.dirname(__file__) 

app = Flask(__name__)
CORS(app) 



##############################################
#           GAME MANAGEMENT                  #
##############################################
game_states = {}


def create_game( is_vs_bot=False, player1=None, player2=None) -> GameState:
    game_id  = str(uuid.uuid4())
    game_state = GameState(game_id=game_id, is_vs_bot=is_vs_bot, player1=player1, player2=player2)
    game_states[game_id] = game_state
    return game_state


def get_game(game_id:str) -> GameState:
    return game_states.get(game_id)


def delete_game(game_id):
    if game_id in game_states:
        del game_states[game_id]



##############################################
#           UTILITY FUNCTIONS                #
##############################################
def api_response(text: str, **kwargs) -> dict:
    response = {"message": text}
    response.update(kwargs)
    return response


##############################################
#           API ROUTES                       #
##############################################



@app.route("/")
def main():
    return jsonify(api_response("Welcome to the Chess API."))


##############################################
#           HUMAN MOVE ROUTES                #
##############################################

@app.route("/human-move", methods=["POST"])
def human_move():
    try:
        body = request.json
        game_id = body.get("game_id", "").strip()
        move = body.get("move", "").strip()

        if not game_id or not move:
            return jsonify(api_response("Game ID and move parameters are required.")), 400

        game_state = get_game(game_id)
        if not game_state or not game_state.game_started:
            return jsonify(api_response("Game not found or not started.")), 400
        

        result = make_human_move(game_state.board, move)
        game_state.add_move(move)
        board_state = get_board_state(game_state.board)
        game_json = game_state.get_json()
        
        
        return jsonify(api_response(result, board_state=board_state,game_json=game_json))
    except Exception:
        traceback.print_exc()
        return jsonify(api_response("Invalid move. Please try again.")), 500 


##############################################
#           BOT MOVE ROUTES                  #
##############################################

@app.route("/bot-move",methods=["GET"])
def bot_move():
    try:
        data = request.args
        game_id = data.get("game_id", "").strip()
        bot_type = data.get("bot_type", "minmax").strip().lower()


        if not game_id or bot_type not in ["stockfish", "deuterium", "cdrill", "minmax"]:
            return jsonify(api_response("Invalid game ID or bot type.")), 400

        game_state = get_game(game_id)
        if not game_state or not game_state.game_started:
            return jsonify(api_response("Game not found or not started.")), 400

        if bot_type == "stockfish":
            result = make_stockfish_move(game_state.board)
        elif bot_type == "deuterium":
            result = make_deuterium_move(game_state.board)
        elif bot_type == "cdrill":
            result = make_cdrill_move(game_state.board)
        else:
            result = make_minmax_move(game_state.board)

        game_state.add_move(result) 
        board_state = get_board_state(game_state.board)
        game_json = game_state.get_json()
        return jsonify(api_response(result, board_state=board_state,game_json=game_json))
    except Exception:
        traceback.print_exc()
        return jsonify(api_response("Error while making the bot's move. Please try again.")), 400


##############################################
#           GAME MANAGEMENT ROUTES           #
##############################################

@app.route("/undo-move", methods=["POST"])
def undo_move():
    try:
        game_id = request.json.get("game_id", "").strip()
        game_state = get_game(game_id)

        if not game_state or not game_state.game_started:
            return jsonify(api_response("Game not found or not started.")), 400

        result = undo_last_move(game_state.board)
        game_state.move_history.pop() 
        board_state = get_board_state(game_state.board)
        game_json = game_state.get_json()
        return jsonify(api_response(result, board_state=board_state,game_json=game_json))
    except IndexError:
        return jsonify(api_response("No moves to undo.")), 400
    except Exception:
        traceback.print_exc()
        return jsonify(api_response("Nothing to undo.")), 400


@app.route("/start-game", methods=["POST"])
def start_game():
    try:
        data = request.json or {}
        is_vs_bot = data.get("is_vs_bot", False)
        player1 = data.get("player1", "White")
        player2 = data.get("player2", "Black")


        game_state = create_game(is_vs_bot=is_vs_bot, player1=player1, player2=player2)
        game_state.start_game()
        reset_board(game_state.board)
        board_state = get_board_state(game_state.board)
        game_json = game_state.get_json()

        return jsonify(api_response("Game started. Best of luck!",board_state=board_state,game_json=game_json))
    except ValueError as e:
        return jsonify(api_response(str(e))), 400
    except Exception:
        traceback.print_exc()
        return jsonify(api_response("Failed to start the game. Please try again.")), 500


@app.route("/reset-board", methods=["POST"])
def reset_board_route():
    try:
        game_id = request.json.get("game_id", "").strip()
        game_state = get_game(game_id)

        if not game_state:
            return jsonify(api_response("Game not found.")), 400

        reset_board(game_state.board)
        board_state = get_board_state(game_state.board)
        game_json = game_state.get_json()
        return jsonify(api_response(f"Game {game_id} board reset successfully.", board_state=board_state,game_json=game_json))
    except Exception:
        traceback.print_exc()
        return jsonify(api_response("Failed to reset the board. Please try again.")), 500






# Summary Table of Chess Engine Strength
# Category	Strength (Elo)	Examples	Use Case
# Beginner	1000–1500	PyChess, Chessmaster (Low Levels)	Casual play, learning basics
# Intermediate	1500–2000	Crafty, GNU Chess, Deuterium (Low)	Club-level practice
# Advanced	2000–2800	Houdini, Deep Fritz, Rybka	Training, amateur-level analysis
# Master	2800–3200	Komodo, Fritz 17+, Shredder	Grandmaster preparation
# Superhuman	3200+	Stockfish, Lc0, AlphaZero	Professional analysis, cutting-edge AI

@app.route("/suggest-move")
def suggest_move():
    try:
        data = request.args

        game_id = data.get("game_id", "").strip()
        bot_strength = data.get("bot_strength", "beginner").strip().lower()

        if not game_id:
            return jsonify(api_response("Invalid game ID.")), 400

        valid_strengths = ["beginner", "intermediate", "advanced", "superhuman"]
        if bot_strength not in valid_strengths:
            return jsonify(api_response(f"Invalid bot strength. Must be one of: {[strength for strength in valid_strengths]}")), 400

        game_state = get_game(game_id)
        if not game_state:
            return jsonify(api_response("Game not found.")), 404
        if not game_state.game_started:
            return jsonify(api_response("Game not started yet.")), 400
        
        credit_left = game_state.suggestion_credit
        if credit_left <= 0:
            return jsonify(api_response("No credit left to suggest a move.")), 400

        board = game_state.board
        
        if bot_strength == "beginner":
            move = make_minmax_move(board)
        elif bot_strength == "intermediate":
            move = make_deuterium_move(board)
        elif bot_strength == "advanced":
            move = make_cdrill_move(board)
        elif bot_strength == "superhuman":
            move = make_stockfish_move(board)
        else:
            return jsonify(api_response("Unhandled bot strength error.")), 500

        if not move:
            return jsonify(api_response("No valid move could be generated.")), 500
        
        game_state.update_credit()
        return jsonify(api_response(move))

    except Exception as e:
        return jsonify(api_response(f"An unexpected error occurred: {str(e)}")), 500





@app.route('/<path:invalid_route>', methods=["GET", "POST"])
def handle_invalid_route(invalid_route):
    method = request.method
    return jsonify(api_response(
        f"Invalid route: /{invalid_route}. Please check the URL or refer to the API documentation. "
        f"Method used: {method}."
    )), 404

if __name__ == "__main__":
    app.run(debug=True)



