from typing import Dict, List, Optional, Any
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
from datetime import datetime

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
    current_scenario: Optional[Dict[str, Any]] = None
    current_options: List[str] = []
    voting_results: Dict[str, Dict[str, str]] = {}  # round -> player_id -> vote
    is_active: bool = True
    phase: GamePhase = GamePhase.LOBBY
    elimination_target: Optional[str] = None
    round_start_time: Optional[datetime] = None
    round_end_time: Optional[datetime] = None
    timer_end_time: Optional[datetime] = None
    timer_running: bool = False
    secret_incentives: Dict[str, str] = {}  # player_id -> incentive

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ResourceType: lambda v: v.value,
            datetime: lambda v: v.isoformat() if v else None
        }
        extra = "ignore"

    @classmethod
    async def create(cls, session_id: str, host_id: str) -> 'GameState':
        try:
            # Create game in Supabase
            game_data = create_game(session_id, host_id)
            if not game_data:
                raise ValueError("Failed to create game in Supabase")
            
            # Create and return game state
            game_state = cls(session_id=session_id)
            await game_state.save()  # This will handle resource creation
            return game_state
        except Exception as e:
            print(f"Error in GameState.create: {str(e)}")
            raise

    @classmethod
    async def load(cls, session_id: str) -> Optional['GameState']:
        try:
            # 1) Load the top-level "games" row
            game_data = get_game(session_id)
            if not game_data:
                return None

            game_data_copy = game_data.copy()
            # If the "games" table has a JSON column "resources" that we don't want:
            if "resources" in game_data_copy:
                del game_data_copy["resources"]

            # Convert datetime strings to datetime objects if they exist
            if "timer_end_time" in game_data_copy and game_data_copy["timer_end_time"]:
                try:
                    game_data_copy["timer_end_time"] = datetime.fromisoformat(game_data_copy["timer_end_time"].replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    game_data_copy["timer_end_time"] = None

            if "round_start_time" in game_data_copy and game_data_copy["round_start_time"]:
                try:
                    game_data_copy["round_start_time"] = datetime.fromisoformat(game_data_copy["round_start_time"].replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    game_data_copy["round_start_time"] = None

            if "round_end_time" in game_data_copy and game_data_copy["round_end_time"]:
                try:
                    game_data_copy["round_end_time"] = datetime.fromisoformat(game_data_copy["round_end_time"].replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    game_data_copy["round_end_time"] = None

            # Ensure timer_running is properly set
            if "timer_running" not in game_data_copy:
                game_data_copy["timer_running"] = False
            else:
                # Convert to boolean if it's a string
                if isinstance(game_data_copy["timer_running"], str):
                    game_data_copy["timer_running"] = game_data_copy["timer_running"].lower() == "true"
                # Ensure it's a boolean
                game_data_copy["timer_running"] = bool(game_data_copy["timer_running"])
                
            print(f"Timer running from database: {game_data_copy.get('timer_running')}")  # Debug print

            # 2) Load players from the "players" table
            players_data = get_players(session_id)
            players_dict = {}
            for p in players_data:
                db_id = p["player_id"] if "player_id" in p else p["id"]
                players_dict[db_id] = Player(
                    id=db_id,
                    name=p["name"],
                    role=p["role"],
                    secret_incentive=p.get("secret_incentive", "N/A"),
                    is_active=p.get("is_active", True),
                    vote_weight=p.get("vote_weight", 1.0),
                    has_voted=p.get("has_voted", False),
                )

            # 3) Load resources from the "resources" table,
            #    which might contain "id", "session_id", "created_at", etc.
            raw_resources = get_resources(session_id)
            valid_keys = ["tech", "manpower", "economy", "happiness", "trust"]
            filtered_resources = {}
            if raw_resources:
                for key in valid_keys:
                    # Gracefully handle None or missing
                    val = raw_resources.get(key, 100)
                    try:
                        filtered_resources[ResourceType(key)] = int(val)
                    except:
                        filtered_resources[ResourceType(key)] = 100
            else:
                # No resources row found => all 100
                for key in valid_keys:
                    filtered_resources[ResourceType(key)] = 100

            # 4) Load secret incentives
            incentives_data = get_secret_incentives(session_id)
            incentives_dict = {row["player_id"]: row["incentive"] for row in incentives_data}

            # 5) Now build the GameState. Note that we do NOT pass in
            #    any leftover "resources" from `game_data_copy`.
            #    We manually set `resources=filtered_resources`.
            game_state = cls(
                session_id=session_id,
                players=players_dict,
                resources=filtered_resources,
                current_round=game_data_copy.get("current_round", 1),
                max_rounds=game_data_copy.get("max_rounds", 10),
                current_scenario=game_data_copy.get("current_scenario"),
                current_options=[],
                voting_results={},
                is_active=game_data_copy.get("is_active", True),
                phase=GamePhase(game_data_copy.get("phase", GamePhase.LOBBY)),
                secret_incentives=incentives_dict,
                timer_end_time=game_data_copy.get("timer_end_time"),
                timer_running=game_data_copy.get("timer_running", False),
                round_start_time=game_data_copy.get("round_start_time"),
                round_end_time=game_data_copy.get("round_end_time")
            )
            return game_state

        except Exception as e:
            print(f"Error in GameState.load: {str(e)}")
            return None

    async def save(self):
        try:
            # Update game state in Supabase
            game_updates = {
                "current_round": self.current_round,
                "current_scenario": self.current_scenario,
                "is_active": self.is_active,
                "phase": self.phase.value,  # Convert enum to string value
                "timer_end_time": self.timer_end_time.isoformat() if self.timer_end_time else None,
                "timer_running": self.timer_running
            }
            print(f"Saving game updates: {game_updates}")  # Debug print
            update_game(self.session_id, game_updates)
            
            # Convert resources from ResourceType enum to string keys
            resources_dict = {resource_type.value: value for resource_type, value in self.resources.items()}
            print(f"Saving resources: {resources_dict}")  # Debug print
            update_resources(self.session_id, resources_dict)
            
            # Update players
            for player_id, player in self.players.items():
                player_updates = player.dict()
                print(f"Updating player {player_id}: {player_updates}")  # Debug print
                update_player(self.session_id, player_id, player_updates)
        except Exception as e:
            print(f"Error in save: {str(e)}")  # Debug print
            print(f"Error type: {type(e)}")  # Debug print
            print(f"Error details: {e.__dict__}")  # Debug print
            raise

    async def add_player(self, player: Player) -> bool:
        # Count only active players
        active_players = [p for p in self.players.values() if p.is_active]
        if len(active_players) >= 4:
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
            
        # Update player's voting status
        self.players[player_id].has_voted = True
        update_player(self.session_id, player_id, {"has_voted": True})
        
        # Store vote in voting_results
        round_key = str(self.current_round)
        if round_key not in self.voting_results:
            self.voting_results[round_key] = {}
        self.voting_results[round_key][player_id] = vote
        
        # Record vote in database
        record_vote(self.session_id, player_id, self.current_round, vote)
        
        # Save the updated game state
        await self.save()
        
        # Check if all players have voted
        all_voted = all(player.has_voted for player in self.players.values())
        if all_voted:
            self.phase = GamePhase.RESULTS
            await self.save()
            
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