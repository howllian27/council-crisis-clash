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
from game.supabase_client import supabase, get_game, get_players, add_player, update_player
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed from INFO to DEBUG
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Log environment variables (without sensitive values)
logger.info("Environment variables loaded:")
logger.info(f"SUPABASE_URL: {'Set' if os.getenv('SUPABASE_URL') else 'Not set'}")
logger.info(f"SUPABASE_KEY: {'Set' if os.getenv('SUPABASE_KEY') else 'Not set'}")

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

async def check_timer(session_id: str):
    try:
        logger.info(f"Starting timer check for session {session_id}")
        while True:
            # Get current game state
            game = await GameState.load(session_id)
            logger.info(f"Timer check - Game state: {game.dict() if game else 'None'}")
            
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

# Game endpoints
@app.post("/api/games")
async def create_game(request: CreateGameRequest):
    try:
        session_id = str(uuid.uuid4())
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
        
        # Check current players
        logger.debug("Checking current players...")
        players_data = get_players(session_id)
        logger.debug(f"Current players: {players_data}")
        
        if len(players_data) >= 4:
            logger.error(f"Game {session_id} is full with {len(players_data)} players")
            raise HTTPException(status_code=400, detail="Game is full")
        
        # Create new player
        player_id = str(uuid.uuid4())
        logger.debug(f"Creating new player with ID: {player_id}")
        
        player = Player(
            id=player_id,
            name=request.player_name,
            role="player",
            secret_incentive="Player's secret objective"
        )
        
        # Add player to game
        logger.debug("Attempting to add player to game...")
        try:
            add_player(session_id, player.dict())
            logger.debug(f"Successfully added player {request.player_name} to game {session_id}")
        except Exception as e:
            logger.error(f"Failed to add player to Supabase: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to add player to game")
        
        # Verify player was added
        logger.debug("Verifying player was added to Supabase...")
        players_data = get_players(session_id)
        logger.debug(f"Updated players list: {players_data}")
        
        return {
            "player_id": player_id,
            "message": "Joined game successfully"
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
    return game_state

@app.post("/api/games/{session_id}/start")
async def start_game(session_id: str):
    try:
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
        
        # Set initial scenario
        initial_scenario = {
            "title": "Mysterious Signal From Deep Space",
            "description": "Our deep space monitoring stations have detected an unusual signal originating from beyond our solar system. Initial analysis suggests it could be artificial in nature. The signal appears to contain complex mathematical sequences that our scientists believe may be an attempt at communication. However, there is no consensus on whether we should respond or what the message might contain.",
            "consequences": "How we handle this situation could dramatically affect our technological development and potentially our safety if the signal represents a threat.",
            "options": [
                {"id": "option1", "text": "Allocate resources to decode the signal but do not respond yet"},
                {"id": "option2", "text": "Immediately broadcast a response using similar mathematical principles"},
                {"id": "option3", "text": "Ignore the signal and increase our defensive capabilities"},
                {"id": "option4", "text": "Share the discovery with the public and crowdsource analysis"}
            ]
        }
        
        logger.info(f"Setting initial scenario: {initial_scenario}")
        game.current_scenario = initial_scenario
        game.phase = GamePhase.SCENARIO
        
        # Update game in Supabase
        logger.info("Updating game in Supabase...")
        update_data = {
            "current_scenario": initial_scenario,
            "phase": "scenario",
            "updated_at": datetime.utcnow().isoformat()
        }
        logger.info(f"Update data: {update_data}")
        
        result = supabase.table("games").update(update_data).eq("session_id", session_id).execute()
        logger.info(f"Supabase response: {result}")
        
        if hasattr(result, 'error') and result.error:
            logger.error(f"Error updating game in Supabase: {result.error}")
            raise HTTPException(status_code=500, detail="Failed to update game in database")
        
        await game.save()
        
        # Broadcast a message to all connected clients to check if they should start the timer
        logger.info("Broadcasting game started message to all connected clients")
        await manager.broadcast_to_session({
            "type": "game_started",
            "scenario": initial_scenario,
            "phase": "scenario"
        }, session_id)
        
        # Check if we should start the timer now
        await manager.check_and_start_timer(session_id)
        
        logger.info(f"Game started successfully for session_id: {session_id}")
        logger.info(f"Current phase: {game.phase}")
        return {"message": "Game started successfully"}
    except HTTPException as he:
        logger.error(f"HTTP Exception in start_game: {he.detail}")
        raise he
    except Exception as e:
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