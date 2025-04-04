from supabase.client import create_client
import os
from dotenv import load_dotenv
from datetime import datetime
from typing import Dict

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase credentials")

supabase = create_client(supabase_url, supabase_key)

# Table names
GAMES_TABLE = "games"
PLAYERS_TABLE = "players"
VOTES_TABLE = "votes"
RESOURCES_TABLE = "resources"
SECRET_INCENTIVES_TABLE = "secret_incentives"

def get_game(session_id: str):
    try:
        # Select only game-specific columns from the games table
        columns = (
            "session_id, host_id, current_round, max_rounds, is_active, phase, current_scenario, "
            "timer_running, timer_end_time, round_start_time, round_end_time"
        )
        response = (
            supabase
            .table(GAMES_TABLE)
            .select(columns)
            .eq("session_id", session_id)
            .single()
            .execute()
        )
        
        if not response.data:
            print(f"No game found for session_id: {session_id}")  # Debug print
            return None
            
        print(f"Game data from Supabase: {response.data}")  # Debug print
        return response.data
    except Exception as e:
        print(f"Error in get_game: {str(e)}")  # Debug print
        print(f"Error type: {type(e)}")  # Debug print
        print(f"Error details: {e.__dict__}")  # Debug print
        return None

def create_game(session_id: str, host_id: str):
    try:
        # Create game in Supabase
        game_data = {
            "session_id": session_id,
            "host_id": host_id,
            "current_round": 1,
            "max_rounds": 10,
            "is_active": True,
            "phase": "lobby"
        }
        
        response = supabase.table(GAMES_TABLE).insert(game_data).execute()
        
        if not response.data:
            raise ValueError("Failed to create game in Supabase")
            
        # Verify the game was created
        verify_response = supabase.table(GAMES_TABLE).select("*").eq("session_id", session_id).execute()
        if not verify_response.data:
            raise ValueError("Game creation verification failed")
            
        return verify_response.data[0]
    except Exception as e:
        print(f"Error creating game in Supabase: {str(e)}")
        raise

def update_game(session_id: str, updates: dict):
    try:
        # Make sure datetime objects are converted to ISO format strings
        updates_copy = updates.copy()
        for key, value in updates_copy.items():
            if isinstance(value, datetime):
                updates_copy[key] = value.isoformat()
        
        response = supabase.table(GAMES_TABLE).update(updates_copy).eq("session_id", session_id).execute()
        print(f"Game update response: {response}")  # Debug print
        return response
    except Exception as e:
        print(f"Error updating game: {str(e)}")
        raise

def get_players(session_id: str):
    response = supabase.table(PLAYERS_TABLE).select("*").eq("session_id", session_id).execute()
    return response.data

def add_player(session_id: str, player_data: dict):
    try:
        # Create a copy of player data to avoid modifying the original
        player_insert_data = player_data.copy()
        
        # Add session_id
        player_insert_data["session_id"] = session_id
        
        # Convert id to player_id if present
        if "id" in player_insert_data:
            player_insert_data["player_id"] = player_insert_data.pop("id")
            
        # Ensure required fields are present
        if "player_id" not in player_insert_data:
            raise ValueError("Player ID is required")
            
        # Insert player into Supabase
        response = supabase.table(PLAYERS_TABLE).insert(player_insert_data).execute()
        
        if not response.data:
            raise ValueError("Failed to insert player into Supabase")
            
        # Verify player was added
        verify_response = supabase.table(PLAYERS_TABLE).select("*").eq("session_id", session_id).eq("player_id", player_insert_data["player_id"]).execute()
        if not verify_response.data:
            raise ValueError("Player creation verification failed")
            
        return verify_response.data[0]
    except Exception as e:
        print(f"Error adding player to Supabase: {str(e)}")
        raise

def update_player(session_id: str, player_id: str, updates: dict):
    supabase.table(PLAYERS_TABLE).update(updates).eq("session_id", session_id).eq("id", player_id).execute()

def get_votes(session_id: str, round_number: int):
    return supabase.table(VOTES_TABLE).select("*").eq("session_id", session_id).eq("round", round_number).execute()

def record_vote(session_id: str, player_id: str, round: int, vote: str):
    supabase.table(VOTES_TABLE).insert({
        "session_id": session_id,
        "player_id": player_id,
        "round": round,
        "vote": vote
    }).execute()

def get_resources(session_id: str) -> Dict[str, int]:
    try:
        # Query the resources table for the specific session
        result = supabase.table("resources").select("*").eq("session_id", session_id).single().execute()
        
        if result.data:
            # Extract individual resource values
            resources = {
                "tech": result.data.get("tech", 100),
                "manpower": result.data.get("manpower", 100),
                "economy": result.data.get("economy", 100),
                "happiness": result.data.get("happiness", 100),
                "trust": result.data.get("trust", 100)
            }
            return resources
        else:
            # If no resources found, return default values
            return {
                "tech": 100,
                "manpower": 100,
                "economy": 100,
                "happiness": 100,
                "trust": 100
            }
    except Exception as e:
        print(f"Error in get_resources: {e.__dict__ if hasattr(e, '__dict__') else str(e)}")
        print(f"Error type: {type(e)}")
        # Return default values on error
        return {
            "tech": 100,
            "manpower": 100,
            "economy": 100,
            "happiness": 100,
            "trust": 100
        }

def update_resources(session_id: str, resources: dict):
    try:
        # Add session_id to resources
        resources["session_id"] = session_id
        
        # Use upsert to handle both insert and update cases
        response = (
            supabase
            .table(RESOURCES_TABLE)
            .upsert(resources, on_conflict="session_id")
            .execute()
        )
        
        if not response.data:
            raise ValueError("Failed to update resources in Supabase")
            
        return response.data[0]
    except Exception as e:
        print(f"Error updating resources: {str(e)}")
        raise

def get_secret_incentives(session_id: str):
    response = supabase.table(SECRET_INCENTIVES_TABLE).select("*").eq("session_id", session_id).execute()
    return response.data

def add_secret_incentive(session_id: str, player_id: str, incentive: str):
    supabase.table(SECRET_INCENTIVES_TABLE).insert({
        "session_id": session_id,
        "player_id": player_id,
        "incentive": incentive
    }).execute() 