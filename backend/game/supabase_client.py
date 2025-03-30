from supabase.client import create_client
import os
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

logger.debug("Initializing Supabase client...")
logger.debug(f"SUPABASE_URL: {'Set' if supabase_url else 'Not set'}")
logger.debug(f"SUPABASE_KEY: {'Set' if supabase_key else 'Not set'}")

if not supabase_url or not supabase_key:
    logger.error("Missing Supabase credentials")
    raise ValueError("Missing Supabase credentials")

try:
    supabase = create_client(supabase_url, supabase_key)
    logger.info("Supabase client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {str(e)}")
    raise

# Table names
GAMES_TABLE = "games"
PLAYERS_TABLE = "players"
VOTES_TABLE = "votes"
RESOURCES_TABLE = "resources"
SECRET_INCENTIVES_TABLE = "secret_incentives"

def get_game(session_id: str):
    logger.debug(f"Fetching game from database: {session_id}")
    try:
        response = supabase.table(GAMES_TABLE).select("*").eq("session_id", session_id).execute()
        logger.debug(f"Game data: {response.data}")
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error fetching game: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def create_game(session_id: str, host_id: str):
    logger.debug(f"Creating new game: {session_id}")
    logger.debug(f"Host ID: {host_id}")
    try:
        response = supabase.table(GAMES_TABLE).insert({
            "session_id": session_id,
            "host_id": host_id,
            "current_round": 1,
            "is_active": True,
            "phase": "lobby"
        }).execute()
        logger.debug(f"Create game response: {response.data}")
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error creating game: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def update_game(session_id: str, game_data: dict):
    logger.debug(f"Updating game: {session_id}")
    logger.debug(f"Game data: {game_data}")
    try:
        response = supabase.table(GAMES_TABLE).update(game_data).eq("session_id", session_id).execute()
        logger.debug(f"Update game response: {response.data}")
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error updating game: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def get_players(session_id: str):
    logger.debug(f"Fetching players for game: {session_id}")
    try:
        response = supabase.table(PLAYERS_TABLE).select("*").eq("session_id", session_id).execute()
        logger.debug(f"Players data: {response.data}")
        return response.data
    except Exception as e:
        logger.error(f"Error fetching players: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def add_player(session_id: str, player_data: dict):
    logger.debug(f"Adding player to game: {session_id}")
    logger.debug(f"Player data: {player_data}")
    try:
        response = supabase.table(PLAYERS_TABLE).insert(player_data).execute()
        logger.debug(f"Add player response: {response.data}")
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error adding player: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def update_player(session_id: str, player_id: str, player_data: dict):
    logger.debug(f"Updating player in game: {session_id}")
    logger.debug(f"Player ID: {player_id}")
    logger.debug(f"Player data: {player_data}")
    try:
        response = supabase.table(PLAYERS_TABLE).update(player_data).eq("id", player_id).execute()
        logger.debug(f"Update player response: {response.data}")
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error updating player: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def get_votes(session_id: str, round_number: int):
    return supabase.table(VOTES_TABLE).select("*").eq("session_id", session_id).eq("round", round_number).execute()

def record_vote(session_id: str, player_id: str, round_number: int, vote: str):
    logger.debug(f"Recording vote for player: {player_id}")
    logger.debug(f"Game: {session_id}")
    logger.debug(f"Round: {round_number}")
    logger.debug(f"Vote: {vote}")
    try:
        response = supabase.table(VOTES_TABLE).insert({
            "session_id": session_id,
            "player_id": player_id,
            "round": round_number,
            "option": vote
        }).execute()
        logger.debug(f"Record vote response: {response.data}")
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error recording vote: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def get_resources(session_id: str):
    logger.debug(f"Fetching resources for game: {session_id}")
    try:
        response = supabase.table(RESOURCES_TABLE).select("*").eq("session_id", session_id).execute()
        logger.debug(f"Resources data: {response.data}")
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error fetching resources: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def update_resources(session_id: str, resources_data: dict):
    logger.debug(f"Updating resources for game: {session_id}")
    logger.debug(f"Resources data: {resources_data}")
    try:
        response = supabase.table(RESOURCES_TABLE).upsert({
            "session_id": session_id,
            **resources_data
        }).execute()
        logger.debug(f"Update resources response: {response.data}")
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error updating resources: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def get_secret_incentives(session_id: str):
    logger.debug(f"Fetching secret incentives for game: {session_id}")
    try:
        response = supabase.table(SECRET_INCENTIVES_TABLE).select("*").eq("session_id", session_id).execute()
        logger.debug(f"Secret incentives data: {response.data}")
        return response.data
    except Exception as e:
        logger.error(f"Error fetching secret incentives: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise

def add_secret_incentive(session_id: str, player_id: str, incentive: str):
    logger.debug(f"Adding secret incentive for player: {player_id}")
    logger.debug(f"Game: {session_id}")
    logger.debug(f"Incentive: {incentive}")
    try:
        response = supabase.table(SECRET_INCENTIVES_TABLE).insert({
            "session_id": session_id,
            "player_id": player_id,
            "incentive": incentive
        }).execute()
        logger.debug(f"Add secret incentive response: {response.data}")
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error adding secret incentive: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise 