from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional
import json
from game.state import GameState, GamePhase
from datetime import datetime, timedelta
import asyncio
from game.supabase_client import supabase
import logging
from ai.scenario_generator import scenario_generator

logger = logging.getLogger(__name__)

class GameWebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.timer_tasks: Dict[str, asyncio.Task] = {}
        self.timer_start_times: Dict[str, datetime] = {}
        self.timer_durations: Dict[str, int] = {}  # in seconds
        self.loading_states: Dict[str, bool] = {}  # Track loading state per session

    async def connect(self, websocket: WebSocket, session_id: str, player_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {}
        self.active_connections[session_id][player_id] = websocket
        logger.info(f"Player {player_id} connected to session {session_id}")
        
        # Send current loading state to newly connected player
        if session_id in self.loading_states and self.loading_states[session_id]:
            await websocket.send_json({
                "type": "loading_state",
                "payload": {
                    "isLoading": True,
                    "message": "Stand By for New Council Motion..."
                }
            })
        
        await self.check_and_start_timer(session_id)

    async def disconnect(self, session_id: str, player_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].pop(player_id, None)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                if session_id in self.timer_tasks:
                    self.timer_tasks[session_id].cancel()
                    del self.timer_tasks[session_id]
                # Clear loading state when all players disconnect
                if session_id in self.loading_states:
                    del self.loading_states[session_id]
        logger.info(f"Player {player_id} disconnected from session {session_id}")

    async def broadcast_to_session(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            # Update loading state tracking if this is a loading state message
            if message.get("type") == "loading_state":
                self.loading_states[session_id] = message["payload"]["isLoading"]
            
            # Broadcast to all connected clients
            for connection in self.active_connections[session_id].values():
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting message to session {session_id}: {str(e)}")
                    # Don't raise the exception - continue trying to send to other clients

    async def check_and_start_timer(self, session_id: str):
        """Check if all players are connected and start the timer if they are."""
        logger.info(f"Checking if all players are connected for session {session_id}")
        
        # Get the game state
        game = await GameState.load(session_id)
        if not game:
            logger.error(f"Game not found for session {session_id}")
            return
        
        # Check if the game is in the scenario phase
        if game.phase != GamePhase.SCENARIO:
            logger.info(f"Game {session_id} is not in scenario phase, current phase: {game.phase}")
            return
        
        # Count the number of connected players
        connected_players = 0
        if session_id in self.active_connections:
            connected_players = len(self.active_connections[session_id])
        
        # Count the total number of players in the game
        total_players = len(game.players)
        
        logger.info(f"Session {session_id}: {connected_players}/{total_players} players connected")
        
        # If all players are connected, start the timer
        if connected_players == total_players and total_players >= 2:
            logger.info(f"All players connected for session {session_id}, starting timer")
            await self.start_timer(session_id)
        else:
            logger.info(f"Not all players connected for session {session_id}, waiting for more players")
            # Broadcast a message to all connected clients about waiting for more players
            await self.broadcast_to_session(session_id, {
                "type": "waiting_for_players",
                "connected": connected_players,
                "total": total_players
            })

    async def start_timer(self, session_id: str):
        """Start a timer for a specific session."""
        logger.info(f"Starting timer for session {session_id}")
        
        # Set the timer start time to now
        self.timer_start_times[session_id] = datetime.utcnow()
        
        # Set the timer duration to 60 seconds (1 minute)
        self.timer_durations[session_id] = 90
        
        # Cancel any existing timer task
        if session_id in self.timer_tasks and not self.timer_tasks[session_id].done():
            logger.info(f"Cancelling existing timer task for session {session_id}")
            self.timer_tasks[session_id].cancel()
        
        # Create a new timer task
        self.timer_tasks[session_id] = asyncio.create_task(self.check_timer(session_id))
        logger.info(f"Created new timer task for session {session_id}")
        
        # Broadcast timer started message
        await self.broadcast_to_session(session_id, {"type": "timer_started", "duration": 90})
        logger.info(f"Broadcasted timer started message for session {session_id}")

    async def check_timer(self, session_id: str):
        """Check the timer for a specific session and transition to results phase when it expires."""
        logger.info(f"Starting timer check for session {session_id}")
        
        try:
            # Get the start time and duration
            start_time = self.timer_start_times.get(session_id)
            duration = self.timer_durations.get(session_id, 90)  # Default to 60 seconds
            
            if not start_time:
                logger.info(f"Timer start time not found for session {session_id}, stopping timer check")
                return
                
            logger.info(f"Timer started at {start_time.isoformat()} with duration {duration} seconds")
            
            # Calculate the end time
            end_time = start_time + timedelta(seconds=duration)
            logger.info(f"Timer will end at {end_time.isoformat()}")
            
            # Check the timer every second
            while True:
                now = datetime.utcnow()
                remaining = (end_time - now).total_seconds()
                
                if remaining <= 0:
                    logger.info(f"Timer expired for session {session_id} at {now.isoformat()}")
                    logger.info(f"Total elapsed time: {(now - start_time).total_seconds():.2f} seconds")
                    
                    # Transition to results phase
                    game = await GameState.load(session_id)
                    if game:
                        game.phase = GamePhase.RESULTS
                        await game.save()
                        logger.info(f"Game phase updated to {game.phase}")
                        
                        # Broadcast phase change to all connected clients
                        await self.broadcast_to_session(session_id, {"type": "phase_change", "phase": "results"})
                        logger.info(f"Broadcasted phase change to results for session {session_id}")
                    else:
                        logger.error(f"Game not found for session {session_id}, cannot transition to results phase")
                    break
                
                # Log the remaining time every 10 seconds
                if int(remaining) % 10 == 0:
                    logger.info(f"Timer for session {session_id}: {int(remaining)} seconds remaining")
                
                # Wait for 1 second before checking again
                await asyncio.sleep(1)
                
        except Exception as e:
            logger.error(f"Error in timer check for session {session_id}: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {e.__dict__}")
            raise

    async def broadcast_timer_update(self, session_id: str, remaining_seconds: int):
        if session_id in self.active_connections:
            message = {
                "type": "timer_update",
                "remaining_seconds": remaining_seconds
            }
            await self.broadcast_to_session(session_id, message)

    async def end_timer(self, session_id: str):
        logger.info(f"Ending timer for session {session_id}")
        game = await GameState.load(session_id)
        if game:
            logger.info(f"Updating game phase to results for session {session_id}")
            game.phase = GamePhase.RESULTS
            await game.save()
            
            # Clean up timer resources
            if session_id in self.timer_tasks and not self.timer_tasks[session_id].done():
                self.timer_tasks[session_id].cancel()
                logger.info(f"Cancelled timer task for session {session_id}")
                
            if session_id in self.timer_start_times:
                del self.timer_start_times[session_id]
                logger.info(f"Removed timer start time for session {session_id}")
                
            # Broadcast phase change
            logger.info(f"Broadcasting phase change to results for session {session_id}")
            await self.broadcast_to_session(session_id, {"type": "phase_change", "phase": "results"})
        else:
            logger.error(f"Game not found for session {session_id}, cannot end timer")

    async def handle_message(self, websocket: WebSocket, session_id: str, data: dict):
        try:
            message_type = data.get("type")
            payload = data.get("payload", {})
            logger.info(f"Handling message type: {message_type} for session {session_id}")

            if message_type == "join_game":
                # Handle player joining the game
                player_id = payload.get("player_id")
                player_name = payload.get("player_name")
                if player_id and player_name:
                    game = await GameState.load(session_id)
                    if not game:
                        game = await GameState.create(session_id)
                    
                    # Add player to game
                    success = await game.add_player({
                        "id": player_id,
                        "name": player_name,
                        "role": "Council Member",
                        "secret_incentive": "Survive and thrive"
                    })
                    
                    if success:
                        await self.broadcast_to_session(session_id, {
                            "type": "player_joined",
                            "payload": {
                                "player_id": player_id,
                                "player_name": player_name
                            }
                        })
                        
                        # Check if we should start the timer
                        await self.check_and_start_timer(session_id)

            elif message_type == "start_game":
                # Generate initial scenario
                game = await GameState.load(session_id)
                if game and len(game.players) >= 2:
                    # Generate scenario using OpenAI
                    title, description = await scenario_generator.generate_scenario(game.dict())
                    options = await scenario_generator.generate_voting_options(title, description)
                    
                    # Format scenario
                    scenario = {
                        "title": title,
                        "description": description,
                        "consequences": "The council's decision will have significant implications for our future.",
                        "options": [
                            {"id": f"option{i+1}", "text": option} 
                            for i, option in enumerate(options)
                        ]
                    }
                    
                    logger.info(f"Generated scenario: {scenario}")
                    
                    game.current_scenario = scenario
                    game.phase = GamePhase.SCENARIO
                    await game.save()

                    # Start timer
                    await self.start_timer(session_id)

                    await self.broadcast_to_session(session_id, {
                        "type": "game_started",
                        "payload": {
                            "scenario": scenario,
                            "players": list(game.players.values())
                        }
                    })

            elif message_type == "vote":
                # Handle player voting
                player_id = payload.get("player_id")
                vote = payload.get("vote")
                if player_id and vote:
                    game = await GameState.load(session_id)
                    if game:
                        round_key = str(game.current_round)
                        if round_key not in game.voting_results:
                            game.voting_results[round_key] = {}
                        game.voting_results[round_key][player_id] = vote

        except WebSocketDisconnect:
            await self.disconnect(session_id, websocket.client.host)
            # Cancel timer task if it exists
            if session_id in self.timer_tasks and not self.timer_tasks[session_id].done():
                self.timer_tasks[session_id].cancel()
            # Clean up timer start time
            if session_id in self.timer_start_times:
                del self.timer_start_times[session_id]

    async def clear_loading_state(self, session_id: str):
        """Clear the loading state for a session."""
        if session_id in self.loading_states:
            del self.loading_states[session_id]
            await self.broadcast_to_session(session_id, {
                "type": "loading_state",
                "payload": {
                    "isLoading": False,
                    "message": ""
                }
            })

# Create a global instance of the WebSocket manager
manager = GameWebSocketManager() 