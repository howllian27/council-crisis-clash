from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
from backend.game.state import GameManager, GameState
from backend.ai.scenario_generator import scenario_generator

class GameWebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.game_manager = GameManager()

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast_to_session(self, message: dict, session_id: str):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                await connection.send_json(message)

    async def handle_message(self, websocket: WebSocket, session_id: str):
        try:
            while True:
                data = await websocket.receive_json()
                message_type = data.get("type")
                payload = data.get("payload", {})

                if message_type == "join_game":
                    # Handle player joining the game
                    player_id = payload.get("player_id")
                    player_name = payload.get("player_name")
                    if player_id and player_name:
                        game = self.game_manager.get_game(session_id)
                        if not game:
                            game = self.game_manager.create_game(session_id)
                        
                        # Add player to game
                        success = self.game_manager.add_player(session_id, {
                            "id": player_id,
                            "name": player_name,
                            "role": "Council Member",
                            "secret_incentive": "Survive and thrive"
                        })
                        
                        if success:
                            await self.broadcast_to_session({
                                "type": "player_joined",
                                "payload": {
                                    "player_id": player_id,
                                    "player_name": player_name
                                }
                            }, session_id)

                elif message_type == "start_game":
                    # Generate initial scenario
                    game = self.game_manager.get_game(session_id)
                    if game and len(game.players) >= 2:
                        scenario = await scenario_generator.generate_scenario(game.dict())
                        game.current_scenario = scenario
                        await self.broadcast_to_session({
                            "type": "game_started",
                            "payload": {
                                "scenario": scenario,
                                "players": list(game.players.values())
                            }
                        }, session_id)

                elif message_type == "vote":
                    # Handle player voting
                    player_id = payload.get("player_id")
                    vote = payload.get("vote")
                    if player_id and vote:
                        game = self.game_manager.get_game(session_id)
                        if game:
                            round_key = str(game.current_round)
                            if round_key not in game.voting_results:
                                game.voting_results[round_key] = {}
                            game.voting_results[round_key][player_id] = vote

                            # Check if all players have voted
                            if len(game.voting_results[round_key]) == len(game.players):
                                # Process voting results and update game state
                                # This is where you'd implement the voting logic
                                await self.broadcast_to_session({
                                    "type": "voting_complete",
                                    "payload": {
                                        "results": game.voting_results[round_key]
                                    }
                                }, session_id)

        except WebSocketDisconnect:
            self.disconnect(websocket, session_id)

websocket_manager = GameWebSocketManager() 