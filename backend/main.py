from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging
import asyncio
from game.websocket import manager
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
from game.state import GameState, Player, GamePhase
from game.supabase_client import supabase, get_game, get_players, add_player, update_player, get_votes
from datetime import datetime, timedelta
from ai.scenario_generator import scenario_generator
import json
import random
import string

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Changed from DEBUG to INFO
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Disable noisy loggers
logging.getLogger('hpack.hpack').setLevel(logging.WARNING)
logging.getLogger('httpcore.http2').setLevel(logging.WARNING)
logging.getLogger('httpx').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Log environment variables (without sensitive values)
logger.info("Environment variables loaded:")
logger.info(f"SUPABASE_URL: {'Set' if os.getenv('SUPABASE_URL') else 'Not set'}")
logger.info(f"SUPABASE_KEY: {'Set' if os.getenv('SUPABASE_KEY') else 'Not set'}")
logger.info(f"OPENAI_API_KEY: {'Set' if os.getenv('OPENAI_API_KEY') else 'Not set'}")  # Add OpenAI key check

app = FastAPI(title="Project Oversight API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],  # Allow frontend origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Request models
class CreateGameRequest(BaseModel):
    host_name: str

class JoinGameRequest(BaseModel):
    session_id: str
    player_name: str

class VoteRequest(BaseModel):
    session_id: str
    player_id: str
    option: str

# Store active timer tasks
timer_tasks: Dict[str, asyncio.Task] = {}

# In-memory storage for secret incentives keyed by session_id then round.
secret_incentives: Dict[str, Dict[int, Dict[str, str]]] = {}
# A lock per session to prevent race conditions.
secret_incentive_locks: Dict[str, asyncio.Lock] = {}

async def check_timer(session_id: str):
    try:
        # logger.info(f"Starting timer check for session {session_id}")
        while True:
            # Get current game state
            game = await GameState.load(session_id)
            # logger.info(f"Timer check - Game state: {game.dict() if game else 'None'}")
            
            if not game:
                logger.info(f"Game not found for session {session_id}, stopping timer")
                break
                
            if not game.timer_running:
                logger.info(f"Timer not running for session {session_id}, stopping timer check")
                break

            # Use timezone-aware datetime for comparison
            now = datetime.utcnow().replace(tzinfo=None)
            if game.timer_end_time and now >= game.timer_end_time.replace(tzinfo=None):
                logger.info(f"Timer expired for session {session_id}")
                # Update game phase to results
                game.phase = GamePhase.RESULTS
                game.timer_running = False
                game.timer_end_time = None
                
                # Update in Supabase
                update_data = {
                    "phase": "results",
                    "timer_running": False,
                    "timer_end_time": None,
                    "updated_at": now.isoformat()
                }
                result = supabase.table("games").update(update_data).eq("session_id", session_id).execute()
                logger.info(f"Updated game phase to results: {result}")
                
                # Save game state
                await game.save()
                
                # Broadcast phase change to all connected clients
                await manager.broadcast_to_session(session_id, {
                    "type": "phase_change",
                    "payload": {"phase": "results"}
                })
                break

            await asyncio.sleep(1)  # Check every second
    except Exception as e:
        logger.error(f"Error in timer check for session {session_id}: {str(e)}")
        raise

# Add new models for scenario generation
class ScenarioResponse(BaseModel):
    title: str
    description: str
    options: List[str]

# Store active scenario generation tasks
scenario_tasks: Dict[str, asyncio.Task] = {}

# Add a lock for outcome generation to prevent multiple generations
outcome_generation_locks: Dict[str, asyncio.Lock] = {}

# Store secret incentives for each round
secret_incentives: Dict[str, Dict[int, Dict[str, str]]] = {}

def generate_session_code():
    """Generate a random 6-digit alphanumeric code."""
    # Use uppercase letters and numbers, excluding similar characters
    characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join(random.choices(characters, k=6))

@app.get("/")
async def root():
    return {"message": "Welcome to Project Oversight API"}

@app.websocket("/ws/{session_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, player_id: str):
    await manager.connect(websocket, session_id, player_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(websocket, session_id, data)
    except WebSocketDisconnect:
        await manager.disconnect(session_id, player_id)

@app.websocket("/ws/{session_id}/scenario")
async def scenario_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        # Get game state
        game = await GameState.load(session_id)
        if not game:
            await websocket.close(code=1008, reason="Game not found")
            return

        # Generate scenario title and description with streaming
        title, description = await scenario_generator.generate_scenario(game.dict())
        
        # Send title and description in chunks
        await websocket.send_json({
            "type": "scenario_title",
            "content": title
        })
        
        # Split description into chunks and send
        chunk_size = 100
        for i in range(0, len(description), chunk_size):
            chunk = description[i:i + chunk_size]
            await websocket.send_json({
                "type": "scenario_description",
                "content": chunk
            })
            await asyncio.sleep(0.1)  # Small delay between chunks
        
        # Send completion message
        await websocket.send_json({
            "type": "scenario_complete"
        })
        
        # Keep connection alive for a short time
        await asyncio.sleep(5)
        
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"Error in scenario WebSocket: {str(e)}")
        await websocket.close(code=1011, reason=str(e))

# Game endpoints
@app.post("/api/games")
async def create_game(request: CreateGameRequest):
    try:
        session_id = generate_session_code()
        host_id = str(uuid.uuid4())
        
        logger.info(f"Creating new game with session_id: {session_id}")
        
        # Create game state
        game = await GameState.create(session_id, host_id)
        if not game:
            logger.error("Failed to create game state")
            raise HTTPException(status_code=500, detail="Failed to create game")
        
        # Add host as first player
        host = Player(
            id=host_id,
            name=request.host_name,
            role="host",
            secret_incentive="Host's secret objective"
        )
        success = await game.add_player(host)
        if not success:
            logger.error("Failed to add host player")
            raise HTTPException(status_code=500, detail="Failed to add host player")
        
        # Verify game was created in Supabase
        game_data = get_game(session_id)
        if not game_data:
            logger.error("Game creation verification failed")
            raise HTTPException(status_code=500, detail="Game creation verification failed")
        
        logger.info(f"Game created successfully with session_id: {session_id}")
        return {
            "session_id": session_id,
            "host_id": host_id,
            "message": "Game created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating game: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/games/{session_id}/join")
async def join_game(session_id: str, request: JoinGameRequest):
    logger.debug("=== Starting join game process ===")
    logger.debug(f"Session ID: {session_id}")
    logger.debug(f"Player name: {request.player_name}")
    
    try:
        # First check if game exists in Supabase
        logger.debug("Checking if game exists in Supabase...")
        game_data = get_game(session_id)
        if not game_data:
            logger.error(f"Game {session_id} not found in Supabase")
            raise HTTPException(status_code=404, detail="Game not found")
        
        logger.debug(f"Found game in Supabase: {game_data}")
        
        # Check current active players
        logger.debug("Checking current players...")
        players_data = get_players(session_id)
        logger.debug(f"Current players: {players_data}")
        
        # Count only active players
        active_players = [p for p in players_data if p.get("is_active", True)]
        if len(active_players) >= 4:
            logger.error(f"Game {session_id} is full with {len(active_players)} active players")
            raise HTTPException(status_code=400, detail="Game is full")
        
        # Create new player
        player_id = str(uuid.uuid4())
        logger.debug(f"Creating new player with ID: {player_id}")
        
        player = Player(
            id=player_id,
            name=request.player_name,
            role="player",
            secret_incentive="Player's secret objective",
            is_active=True
        )
        
        # Add player to game
        logger.debug("Attempting to add player to game...")
        try:
            add_player(session_id, player.dict())
            logger.debug(f"Successfully added player {request.player_name} to game {session_id}")
        except Exception as e:
            logger.error(f"Failed to add player to Supabase: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to add player to game")
        
        # Return success response with player info
        return {
            "player_id": player_id,
            "host_id": game_data.get("host_id"),
            "message": "Successfully joined game"
        }
    except HTTPException as he:
        logger.error(f"HTTP Exception in join_game: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in join_game: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/games/{session_id}/vote")
async def record_vote(session_id: str, request: VoteRequest):
    game = await GameState.load(session_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    success = await game.record_vote(request.player_id, request.option)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to record vote")
    
    return {"message": "Vote recorded successfully"}

@app.get("/api/games/{session_id}", response_model=GameState)
async def get_game_state(session_id: str):
    game_state = await GameState.load(session_id)
    if not game_state:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Ensure current_scenario is properly formatted
    if game_state.current_scenario:
        if isinstance(game_state.current_scenario, str):
            try:
                game_state.current_scenario = json.loads(game_state.current_scenario)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse scenario JSON: {game_state.current_scenario}")
                game_state.current_scenario = None
        elif not isinstance(game_state.current_scenario, dict):
            logger.error(f"Invalid scenario format: {type(game_state.current_scenario)}")
            game_state.current_scenario = None
    
    return game_state

@app.post("/api/games/{session_id}/start")
async def start_game(session_id: str):
    try:
        # Broadcast loading state to all players
        await manager.broadcast_to_session(session_id, {
            "type": "loading_state",
            "payload": {
                "isLoading": True,
                "message": "Generating next scenario..."
            }
        })

        logger.info(f"=== Starting game for session_id: {session_id} ===")
        
        # Load game state
        logger.info("Loading game state...")
        game = await GameState.load(session_id)
        if not game:
            logger.error(f"Game not found for session_id: {session_id}")
            raise HTTPException(status_code=404, detail="Game not found")
        
        logger.info(f"Current game state: {game.dict()}")
        
        if len(game.players) < 2:
            logger.error(f"Not enough players to start game. Current players: {len(game.players)}")
            raise HTTPException(status_code=400, detail="Need at least 2 players to start")
        
        # Increment round number if we're in RESULTS phase
        if game.phase == GamePhase.RESULTS:
            game.current_round += 1
            logger.info(f"Incremented round number to: {game.current_round}")
        
        # Generate scenario using OpenAI
        logger.info("Generating scenario using OpenAI...")
        title, description = await scenario_generator.generate_scenario(game.dict())
        
        # Generate voting options
        logger.info("Generating voting options...")
        options = await scenario_generator.generate_voting_options(title, description)
        
        # Format scenario
        generated_scenario = {
            "title": title,
            "description": description,
            "consequences": "The council's decision will have far-reaching consequences for our society.",
            "options": [{"id": f"option{i+1}", "text": option} for i, option in enumerate(options)]
        }
        
        logger.info(f"Generated scenario: {generated_scenario}")
        game.current_scenario = generated_scenario
        game.phase = GamePhase.SCENARIO
        
        # Update game in Supabase
        logger.info("Updating game in Supabase...")
        update_data = {
            "current_scenario": json.dumps(generated_scenario),  # Convert to JSON string
            "phase": "scenario",
            "current_round": game.current_round,  # Add round number to update
            "updated_at": datetime.utcnow().isoformat()
        }
        logger.info(f"Update data: {update_data}")
        
        result = supabase.table("games").update(update_data).eq("session_id", session_id).execute()
        logger.info(f"Supabase response: {result}")
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error updating game in Supabase: {result.error}")
            raise HTTPException(status_code=500, detail="Failed to update game in database")
        
        await game.save()
        
        # Broadcast game started message to all connected clients
        logger.info("Broadcasting game started message to all connected clients")
        await manager.broadcast_to_session(session_id, {
            "type": "game_started",
            "payload": {
                "scenario": generated_scenario,
                "phase": "scenario",
                "current_round": game.current_round
            }
        })
        
        # Check if we should start the timer now
        await manager.check_and_start_timer(session_id)
        
        # After scenario is generated and game is started, broadcast loading state end
        await manager.broadcast_to_session(session_id, {
            "type": "loading_state",
            "payload": {
                "isLoading": False,
                "message": ""
            }
        })
        
        logger.info(f"Game started successfully for session_id: {session_id}")
        logger.info(f"Current phase: {game.phase}")
        return {"message": "Game started successfully"}
    except HTTPException as he:
        # Ensure loading state is cleared even on error
        await manager.broadcast_to_session(session_id, {
            "type": "loading_state",
            "payload": {
                "isLoading": False,
                "message": ""
            }
        })
        logger.error(f"HTTP Exception in start_game: {he.detail}")
        raise he
    except Exception as e:
        # Ensure loading state is cleared even on error
        await manager.broadcast_to_session(session_id, {
            "type": "loading_state",
            "payload": {
                "isLoading": False,
                "message": ""
            }
        })
        logger.error(f"Unexpected error in start_game: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/games/{session_id}/timer")
async def update_timer(session_id: str, request: Request):
    try:
        updates = await request.json()
        game = await GameState.load(session_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
            
        # If starting the timer, set the end time to 60 seconds from now
        if updates.get("timer_running", False):
            # Use timezone-naive datetime for consistency
            end_time = datetime.utcnow().replace(tzinfo=None) + timedelta(seconds=60)
        else:
            end_time = None
            
        # Update timer state in Supabase
        result = supabase.table("games").update({
            "timer_end_time": end_time.isoformat() if end_time else None,
            "timer_running": updates.get("timer_running", False),
            "updated_at": datetime.utcnow().replace(tzinfo=None).isoformat()
        }).eq("session_id", session_id).execute()
        
        # Check if the update was successful
        if not result.data:
            logger.error(f"Failed to update timer in Supabase: {result}")
            raise HTTPException(status_code=500, detail="Failed to update timer in database")
            
        # Update local game state
        game.timer_end_time = end_time
        game.timer_running = updates.get("timer_running", False)
        await game.save()
        
        # If starting the timer, ensure the timer check task is running
        if game.timer_running:
            if session_id not in timer_tasks or timer_tasks[session_id].done():
                timer_tasks[session_id] = asyncio.create_task(check_timer(session_id))
        
        return {"message": "Timer updated successfully"}
    except Exception as e:
        logger.error(f"Error updating timer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/games/{session_id}/players/{player_id}")
async def update_player(session_id: str, player_id: str, request: Request):
    try:
        updates = await request.json()
        logger.debug(f"Updating player {player_id} in session {session_id} with updates: {updates}")
        
        # Update player in Supabase
        update_player(session_id, player_id, updates)
        
        # Get updated game state
        game_state = await GameState.load(session_id)
        if not game_state:
            raise HTTPException(status_code=404, detail="Game not found")
            
        return game_state.dict()
    except Exception as e:
        logger.error(f"Error updating player: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/games/{session_id}/phase")
async def update_game_phase(session_id: str, request: Request):
    try:
        updates = await request.json()
        new_phase = updates.get("phase")
        
        if not new_phase:
            raise HTTPException(status_code=400, detail="Phase is required")
            
        # Update game phase in Supabase
        game = await GameState.load(session_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
            
        # Update phase in Supabase
        from game.supabase_client import supabase
        from datetime import datetime
        
        result = supabase.table("games").update({
            "phase": new_phase,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("session_id", session_id).execute()
        
        if result.error:
            logger.error(f"Error updating game phase in Supabase: {result.error}")
            raise HTTPException(status_code=500, detail="Failed to update game phase in database")
            
        # Update local game state
        game.phase = new_phase
        await game.save()
        
        return {"message": "Game phase updated successfully"}
    except Exception as e:
        logger.error(f"Error updating game phase: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/games/{session_id}/scenario/options")
async def get_voting_options(session_id: str):
    try:
        # Get game state
        game = await GameState.load(session_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
            
        # Get the current scenario from the game state
        current_scenario = game.current_scenario
        if not current_scenario:
            raise HTTPException(status_code=400, detail="No scenario available")
            
        # Generate voting options
        options = await scenario_generator.generate_voting_options(
            current_scenario.get("title", ""),
            current_scenario.get("description", "")
        )
        
        # Update the game state with the options
        current_scenario["options"] = options
        game.current_scenario = current_scenario
        await game.save()
        
        return {"options": options}
    except Exception as e:
        logger.error(f"Error generating voting options: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating voting options: {str(e)}")

@app.post("/api/games/{session_id}/scenario/outcome")
async def get_voting_outcome(session_id: str):
    try:
        # Broadcast loading state to all players
        await manager.broadcast_to_session(session_id, {
            "type": "loading_state",
            "payload": {
                "isLoading": True,
                "message": "Generating outcome..."
            }
        })

        # Get game state
        game = await GameState.load(session_id)
        if not game:
            logger.error(f"Game not found for session {session_id}")
            raise HTTPException(status_code=404, detail="Game not found")
            
        # Get the current scenario from the game state
        current_scenario = game.current_scenario
        if not current_scenario:
            logger.error(f"No scenario available for session {session_id}")
            raise HTTPException(status_code=400, detail="No scenario available")
        
        # Check if outcome is already generated (first check)
        if "outcome" in current_scenario and current_scenario["outcome"]:
            logger.info(f"Outcome already exists for session {session_id} (initial check), returning existing.")
            return {
                "outcome": current_scenario["outcome"],
                "resource_changes": current_scenario.get("resource_changes", {})
            }
        
        # Create a lock for this session if it doesn't exist
        if session_id not in outcome_generation_locks:
            outcome_generation_locks[session_id] = asyncio.Lock()
        
        # Use the lock to ensure only one outcome is generated
        logger.info(f"Attempting to acquire outcome generation lock for session {session_id}")
        async with outcome_generation_locks[session_id]:
            logger.info(f"Acquired outcome generation lock for session {session_id}")

            # --- Reload game state *inside* the lock to get the latest data ---
            game = await GameState.load(session_id)
            if not game or not game.current_scenario:
                 logger.error(f"Game or scenario disappeared while holding lock for session {session_id}")
                 raise HTTPException(status_code=500, detail="Game state changed unexpectedly during lock")
            current_scenario = game.current_scenario # Update local variable with latest data
            # --- End reload ---

            # Check again if outcome was generated while waiting for the lock (second check, now more reliable)
            if "outcome" in current_scenario and current_scenario["outcome"]:
                logger.info(f"Outcome generated while waiting for lock for session {session_id}, returning existing.")
                return {
                    "outcome": current_scenario["outcome"],
                    "resource_changes": current_scenario.get("resource_changes", {})
                }
                
            logger.info(f"Proceeding with outcome generation for session {session_id}")
            # Get the voting results for the current round
            round_key = str(game.current_round)
            voting_results = game.voting_results.get(round_key, {})
            
            logger.info(f"Voting results for round {round_key}: {voting_results}")
            
            if not voting_results:
                # Try to get votes from the database
                votes = get_votes(session_id, game.current_round)
                if votes.data:
                    # Convert database votes to voting_results format
                    # Ensure vote is always a string to prevent unhashable dict errors
                    voting_results = {vote["player_id"]: str(vote["vote"]) for vote in votes.data}
                    # Update game state with the votes
                    game.voting_results[round_key] = voting_results
                    # No need to save here, will be saved after outcome generation
                else:
                    logger.error(f"No voting results available for session {session_id}, round {round_key}")
                    raise HTTPException(status_code=400, detail="No voting results available")
                
            # Count votes for each option
            vote_counts = {}
            for player_id, vote in voting_results.items():
                # Ensure vote is a string to prevent unhashable dict errors
                vote_str = str(vote)
                if vote_str not in vote_counts:
                    vote_counts[vote_str] = 0
                vote_counts[vote_str] += 1
                
            logger.info(f"Vote counts: {vote_counts}")
                
            # Find the winning option
            if not vote_counts: # Handle case where there are no votes somehow?
                logger.error(f"No votes were cast for session {session_id}, round {round_key}. Cannot determine winner.")
                raise HTTPException(status_code=400, detail="No votes cast, cannot determine outcome.")
            winning_option = max(vote_counts.items(), key=lambda x: x[1])[0]
            logger.info(f"Winning option: {winning_option}")
            
            # Generate outcome based on the scenario and winning option
            outcome, resource_changes = await scenario_generator.generate_voting_outcome(
                current_scenario.get("title", ""),
                current_scenario.get("description", ""),
                winning_option,  # This is now guaranteed to be a string
                vote_counts
            )
            
            # Update the game state with the outcome and resource changes
            current_scenario["outcome"] = outcome
            current_scenario["resource_changes"] = resource_changes
            game.current_scenario = current_scenario # Ensure game object has updated scenario
            
            # Apply resource changes
            await game.update_resources(resource_changes)
            
            logger.info(f"Saving generated outcome and resource changes for session {session_id}")
            await game.save() # Save the game state with the new outcome and resource changes
            logger.info(f"Outcome and resource changes saved for session {session_id}. Releasing lock.")
            
            # After generating outcome, broadcast loading state end
            await manager.broadcast_to_session(session_id, {
                "type": "loading_state",
                "payload": {
                    "isLoading": False,
                    "message": ""
                }
            })
            
            return {
                "outcome": outcome,
                "resource_changes": resource_changes
            }
        # Lock is released automatically here
    except Exception as e:
        # Ensure loading state is cleared even on error
        await manager.broadcast_to_session(session_id, {
            "type": "loading_state",
            "payload": {
                "isLoading": False,
                "message": ""
            }
        })
        logger.error(f"Error generating voting outcome: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        # Log more details if possible, e.g., traceback
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating voting outcome: {str(e)}")

@app.get("/api/games/{session_id}/votes")
async def get_vote_count(session_id: str, round: int, option: str):
    try:
        # Directly query the votes table
        result = supabase.table("votes").select("*").eq("session_id", session_id).eq("round", round).eq("vote", option).execute()
        
        if not hasattr(result, 'data'):
            logger.error("Invalid response from database")
            return {"count": 0}
            
        count = len(result.data)
        logger.info(f"Found {count} votes for session {session_id}, round {round}, option {option}")
        
        # Debug log the actual votes found
        if count > 0:
            logger.info(f"Vote details: {result.data}")
            
        return {"count": count}
    except Exception as e:
        logger.error(f"Error getting vote count: {str(e)}")
        return {"count": 0}

@app.post("/api/games/{session_id}/next_round")
async def next_round(session_id: str):
    try:
        # Broadcast loading state to all players
        await manager.broadcast_to_session(session_id, {
            "type": "loading_state",
            "payload": {
                "isLoading": True,
                "message": "Generating new scenario..."
            }
        })

        # Get current game state
        game = await GameState.load(session_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        # Increment round and clear previous scenario/outcome
        game.current_round += 1
        game.phase = GamePhase.SCENARIO
        game.current_scenario = None  # Clear previous scenario and outcome
        await game.save()

        # Generate new scenario
        title, description = await scenario_generator.generate_scenario(game.dict())
        options = await scenario_generator.generate_voting_options(title, description)

        # Update game with new scenario
        game.current_scenario = {
            "title": title,
            "description": description,
            "options": options,
            "outcome": None  # Ensure outcome is cleared
        }
        await game.save()

        # Broadcast new scenario to all players
        await manager.broadcast_to_session(session_id, {
            "type": "scenario_update",
            "payload": {
                "scenario": game.current_scenario
            }
        })

        # Clear loading state
        await manager.broadcast_to_session(session_id, {
            "type": "loading_state",
            "payload": {
                "isLoading": False,
                "message": ""
            }
        })

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error in next_round: {str(e)}")
        # Clear loading state on error
        await manager.broadcast_to_session(session_id, {
            "type": "loading_state",
            "payload": {
                "isLoading": False,
                "message": ""
            }
        })
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/games/{session_id}/secret_incentive")
async def generate_secret_incentive(session_id: str, round: int):
    """
    Host-only endpoint: generate and store a secret incentive for the current round.
    """
    try:
        # Load the game state.
        game = await GameState.load(session_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        
        # Initialize storage and lock if needed.
        if session_id not in secret_incentives:
            secret_incentives[session_id] = {}
        if session_id not in secret_incentive_locks:
            secret_incentive_locks[session_id] = asyncio.Lock()
        
        # Use the lock to prevent duplicate generation.
        async with secret_incentive_locks[session_id]:
            if round in secret_incentives[session_id]:
                return secret_incentives[session_id][round]
            
            # Ensure we have players.
            players = game.players
            if not players:
                raise HTTPException(status_code=400, detail="No players in game")
            
            # Randomly select a player.
            player_ids = list(players.keys())
            selected_player_id = random.choice(player_ids)
            
            # Retrieve scenario context.
            current_scenario = game.current_scenario or {}
            scenario_title = current_scenario.get("title", "Unknown Crisis")
            scenario_description = current_scenario.get("description", "")
            
            # Use your scenario generator to generate incentive text.
            incentive_text = await scenario_generator.generate_secret_incentive(
                scenario_title,
                scenario_description
            )
            
            new_incentive = {
                "player_id": selected_player_id,
                "text": incentive_text
            }
            
            # Store the incentive.
            secret_incentives[session_id][round] = new_incentive
            logger.info(f"Created new secret incentive for session {session_id}, round {round}: {new_incentive}")
            return new_incentive

    except Exception as e:
        logger.error(f"Error getting secret incentive: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/games/{session_id}/secret_incentive")
async def get_secret_incentive(session_id: str, player_id: str, round: int):
    """
    Client endpoint: returns the secret incentive only if the requesting player's ID 
    matches the selected player's ID stored for this round. Otherwise, returns {}.
    """
    try:
        # Load the game state to ensure the session exists.
        game = await GameState.load(session_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        
        # Check if we have stored an incentive.
        if session_id not in secret_incentives or round not in secret_incentives[session_id]:
            # Incentive not generated yet – return empty object.
            return {}
        
        incentive = secret_incentives[session_id][round]
        # Only return the payload if the requesting player_id matches.
        if incentive["player_id"] == player_id:
            return incentive
        else:
            # If not, return an empty object.
            return {}
    except Exception as e:
        logger.error(f"Error getting secret incentive: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/games/{session_id}/clear_incentives")
async def clear_incentives(session_id: str):
    """Clear all incentives for a session."""
    try:
        if session_id in secret_incentives:
            del secret_incentives[session_id]
        return {"message": "Incentives cleared successfully"}
    except Exception as e:
        logger.error(f"Error clearing incentives: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Clean up timer tasks when the server shuts down
@app.on_event("shutdown")
async def shutdown_event():
    for task in timer_tasks.values():
        task.cancel()
    await asyncio.gather(*timer_tasks.values(), return_exceptions=True)

if __name__ == "__main__":
    import uvicorn
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    print(f"\nServer starting...")
    print(f"Hostname: {hostname}")
    print(f"Local IP: {local_ip}")
    print(f"Access the API at:")
    print(f"- Local: http://localhost:8000")
    print(f"- Network: http://{local_ip}:8000")
    print(f"- All interfaces: http://0.0.0.0:8000\n")
    uvicorn.run(app, host="0.0.0.0", port=8000) 