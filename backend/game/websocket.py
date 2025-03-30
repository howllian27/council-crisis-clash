from fastapi import WebSocket
from typing import Dict, List
import json

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                await connection.send_json(message)

    async def handle_message(self, websocket: WebSocket, session_id: str):
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                # Handle different message types here
                await self.broadcast(session_id, message)
        except Exception as e:
            print(f"Error handling message: {e}")
            self.disconnect(websocket, session_id)

websocket_manager = WebSocketManager() 