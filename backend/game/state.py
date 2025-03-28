from typing import Dict, List, Optional
from pydantic import BaseModel
from enum import Enum

class ResourceType(str, Enum):
    TECH = "tech"
    MANPOWER = "manpower"
    ECONOMY = "economy"
    HAPPINESS = "happiness"
    TRUST = "trust"

class Player(BaseModel):
    id: str
    name: str
    role: str
    secret_incentive: str
    is_active: bool = True

class GameState(BaseModel):
    session_id: str
    players: Dict[str, Player] = {}
    resources: Dict[ResourceType, int] = {
        ResourceType.TECH: 100,
        ResourceType.MANPOWER: 100,
        ResourceType.ECONOMY: 100,
        ResourceType.HAPPINESS: 100,
        ResourceType.TRUST: 100
    }
    current_round: int = 1
    max_rounds: int = 10
    current_scenario: Optional[str] = None
    voting_results: Dict[str, Dict[str, str]] = {}  # round -> player_id -> vote
    is_active: bool = True

class GameManager:
    def __init__(self):
        self.games: Dict[str, GameState] = {}

    def create_game(self, session_id: str) -> GameState:
        game = GameState(session_id=session_id)
        self.games[session_id] = game
        return game

    def get_game(self, session_id: str) -> Optional[GameState]:
        return self.games.get(session_id)

    def add_player(self, session_id: str, player: Player) -> bool:
        game = self.get_game(session_id)
        if not game or len(game.players) >= 4:
            return False
        game.players[player.id] = player
        return True

    def remove_player(self, session_id: str, player_id: str) -> bool:
        game = self.get_game(session_id)
        if not game or player_id not in game.players:
            return False
        del game.players[player_id]
        return True

    def update_resources(self, session_id: str, resource_changes: Dict[ResourceType, int]) -> bool:
        game = self.get_game(session_id)
        if not game:
            return False
        
        for resource_type, change in resource_changes.items():
            current_value = game.resources[resource_type]
            new_value = max(0, min(100, current_value + change))
            game.resources[resource_type] = new_value
            
            if new_value <= 0:
                game.is_active = False
                return True
        return True

    def check_game_end(self, session_id: str) -> bool:
        game = self.get_game(session_id)
        if not game:
            return False

        # Check if only one player remains
        active_players = [p for p in game.players.values() if p.is_active]
        if len(active_players) <= 1:
            game.is_active = False
            return True

        # Check if max rounds reached
        if game.current_round >= game.max_rounds:
            game.is_active = False
            return True

        # Check if any resource depleted
        if any(value <= 0 for value in game.resources.values()):
            game.is_active = False
            return True

        return False

game_manager = GameManager() 