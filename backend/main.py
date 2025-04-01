from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging
from game.websocket import websocket_manager
from pydantic import BaseModel
from typing import List, Optional
import uuid
from game.state import GameState, Player, GamePhase
from game.supabase_client import supabase, get_game, get_players, add_player, update_player

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

@app.get("/")
async def root():
    return {"message": "Welcome to Project Oversight API"}

@app.websocket("/ws/game/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket_manager.connect(websocket, session_id)
    try:
        await websocket_manager.handle_message(websocket, session_id)
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, session_id)

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
        logger.info(f"Starting game for session_id: {session_id}")
        
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
        await game.save()
        
        logger.info(f"Game started successfully for session_id: {session_id}")
        return {"message": "Game started successfully"}
    except HTTPException as he:
        logger.error(f"HTTP Exception in start_game: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in start_game: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {e.__dict__}")
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