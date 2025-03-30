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
    allow_origins=["*"],  # Allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
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

@app.get("/api/games/{session_id}")
async def get_game_state(session_id: str):
    game = await GameState.load(session_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return game.dict()

@app.post("/api/games/{session_id}/start")
async def start_game(session_id: str):
    game = await GameState.load(session_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if len(game.players) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players to start")
    
    game.phase = GamePhase.SCENARIO
    await game.save()
    
    return {"message": "Game started successfully"}

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
    uvicorn.run(app, host="0.0.0.0", port=8000) 