import React, { useState } from "react";
import { useWebSocket } from "../services/websocket";

const WebSocketTest: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [sessionId] = useState(
    "test-session-" + Math.random().toString(36).substr(2, 9)
  );

  const { sendMessage } = useWebSocket(
    "wss://https://45d3-185-25-195-104.ngrok-free.app",
    sessionId,
    {
      onMessage: (message) => {
        setMessages((prev) => [...prev, JSON.stringify(message)]);
      },
      onConnect: () => {
        setMessages((prev) => [...prev, "Connected to WebSocket server"]);
      },
      onDisconnect: () => {
        setMessages((prev) => [...prev, "Disconnected from WebSocket server"]);
      },
      onError: (error) => {
        setMessages((prev) => [...prev, `WebSocket error: ${error}`]);
      },
    }
  );

  const handleJoinGame = () => {
    if (playerName) {
      sendMessage({
        type: "join_game",
        payload: {
          player_id: Math.random().toString(36).substr(2, 9),
          player_name: playerName,
        },
      });
    }
  };

  const handleStartGame = () => {
    sendMessage({
      type: "start_game",
      payload: {},
    });
  };

  const handleVote = () => {
    sendMessage({
      type: "vote",
      payload: {
        player_id: Math.random().toString(36).substr(2, 9),
        vote: "Option A",
      },
    });
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">WebSocket Test</h2>

      <div className="mb-4">
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          className="border p-2 mr-2"
        />
        <button
          onClick={handleJoinGame}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Join Game
        </button>
      </div>

      <div className="mb-4">
        <button
          onClick={handleStartGame}
          className="bg-green-500 text-white px-4 py-2 rounded mr-2"
        >
          Start Game
        </button>
        <button
          onClick={handleVote}
          className="bg-purple-500 text-white px-4 py-2 rounded"
        >
          Send Test Vote
        </button>
      </div>

      <div className="mt-4">
        <h3 className="text-xl font-semibold mb-2">Messages:</h3>
        <div className="bg-gray-100 p-4 rounded h-64 overflow-y-auto">
          {messages.map((msg, index) => (
            <div key={index} className="mb-2">
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest;
