from typing import Dict, List, Optional
from pydantic import BaseModel
from enum import Enum
from .supabase_client import (
    create_game,
    get_game,
    get_players,
    get_resources,
    get_secret_incentives,
    update_game,
    update_resources,
    update_player,
    add_player,
    add_secret_incentive,
    record_vote
)

class ResourceType(str, Enum):
    TECH = "tech"
    MANPOWER = "manpower"
    ECONOMY = "economy"
    HAPPINESS = "happiness"
    TRUST = "trust"

class GamePhase(str, Enum):
    LOBBY = "lobby"
    SCENARIO = "scenario"
    VOTING = "voting"
    ELIMINATION = "elimination"
    RESULTS = "results"

class Player(BaseModel):
    id: str
    name: str
    role: str
    secret_incentive: str
    is_active: bool = True
    vote_weight: float = 1.0
    has_voted: bool = False

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
    current_options: List[str] = []
    voting_results: Dict[str, Dict[str, str]] = {}  # round -> player_id -> vote
    is_active: bool = True
    phase: GamePhase = GamePhase.LOBBY
    elimination_target: Optional[str] = None
    round_start_time: Optional[float] = None
    round_end_time: Optional[float] = None
    secret_incentives: Dict[str, str] = {}  # player_id -> incentive

    @classmethod
    async def create(cls, session_id: str, host_id: str) -> 'GameState':
        try:
            # Create game in Supabase
            game_data = create_game(session_id, host_id)
            if not game_data:
                raise ValueError("Failed to create game in Supabase")
            
            # Initialize resources
            resources = {
                "tech": 100,
                "manpower": 100,
                "economy": 100,
                "happiness": 100,
                "trust": 100
            }
            update_resources(session_id, resources)
            
            # Create and return game state
            game_state = cls(session_id=session_id)
            await game_state.save()  # Ensure the game state is saved
            return game_state
        except Exception as e:
            print(f"Error in GameState.create: {str(e)}")
            raise

    @classmethod
    async def load(cls, session_id: str) -> Optional['GameState']:
        # Load game data from Supabase
        game_data = get_game(session_id)
        if not game_data:
            return None
            
        players_data = get_players(session_id)
        resources_data = get_resources(session_id)
        incentives_data = get_secret_incentives(session_id)
        
        # Convert to GameState object
        return cls(
            session_id=session_id,
            players={p["id"]: Player(**p) for p in players_data},
            resources=resources_data,
            current_round=game_data["current_round"],
            current_scenario=game_data["current_scenario"],
            is_active=game_data["is_active"],
            phase=game_data["phase"],
            secret_incentives={i["player_id"]: i["incentive"] for i in incentives_data}
        )

    async def save(self):
        # Update game state in Supabase
        update_game(self.session_id, {
            "current_round": self.current_round,
            "current_scenario": self.current_scenario,
            "is_active": self.is_active,
            "phase": self.phase
        })
        
        # Update resources
        update_resources(self.session_id, self.resources)
        
        # Update players
        for player_id, player in self.players.items():
            update_player(self.session_id, player_id, player.dict())

    async def add_player(self, player: Player) -> bool:
        if len(self.players) >= 4:
            return False
            
        self.players[player.id] = player
        add_player(self.session_id, player.dict())
        return True

    async def remove_player(self, player_id: str) -> bool:
        if player_id not in self.players:
            return False
            
        del self.players[player_id]
        update_player(self.session_id, player_id, {"is_active": False})
        return True

    async def record_vote(self, player_id: str, vote: str) -> bool:
        if player_id not in self.players or self.players[player_id].has_voted:
            return False
            
        self.players[player_id].has_voted = True
        if self.current_round not in self.voting_results:
            self.voting_results[self.current_round] = {}
        self.voting_results[self.current_round][player_id] = vote
        
        record_vote(self.session_id, player_id, self.current_round, vote)
        return True

    async def update_resources(self, resource_changes: Dict[ResourceType, int]) -> bool:
        for resource_type, change in resource_changes.items():
            current_value = self.resources[resource_type]
            new_value = max(0, min(100, current_value + change))
            self.resources[resource_type] = new_value
            
            if new_value <= 0:
                self.is_active = False
                await self.save()
                return True
                
        await self.save()
        return True

    async def check_game_end(self) -> bool:
        # Check if only one player remains
        active_players = [p for p in self.players.values() if p.is_active]
        if len(active_players) <= 1:
            self.is_active = False
            await self.save()
            return True

        # Check if max rounds reached
        if self.current_round >= self.max_rounds:
            self.is_active = False
            await self.save()
            return True

        # Check if any resource depleted
        if any(value <= 0 for value in self.resources.values()):
            self.is_active = False
            await self.save()
            return True

        return False

    async def add_secret_incentive(self, player_id: str, incentive: str):
        self.secret_incentives[player_id] = incentive
        add_secret_incentive(self.session_id, player_id, incentive)

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