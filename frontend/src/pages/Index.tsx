import React, { useState } from "react";
import Button from "../components/Button";
import { Play, Users } from "lucide-react";
import { useMultiplayer } from "../contexts/MultiplayerContext";

const Index = () => {
  const [playerName, setPlayerName] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [mode, setMode] = useState<"create" | "join" | null>(null);

  const { createSession, joinSession, isLoading } = useMultiplayer();

  const handleCreateSession = () => {
    if (playerName.trim()) {
      createSession(playerName);
    } else {
      alert("Please enter your council title");
    }
  };

  const handleJoinSession = () => {
    if (playerName.trim() && sessionCode.trim()) {
      joinSession(sessionCode, playerName);
    } else {
      alert("Please enter your council title and session code");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-black to-gray-900 p-4">
      <div className="w-full max-w-lg mx-auto text-center mb-8 animate-fade-in">
        <h1 className="text-5xl font-bold mb-2 text-white">
          Project <span className="text-neon-pink neon-glow">Oversight</span>
        </h1>
        <p className="text-gray-400 text-lg">
          A multiplayer crisis management game powered by AI
        </p>
      </div>

      <div className="w-full max-w-md glass-panel p-8 animate-slide-up">
        <div className="space-y-6">
          <div>
            <label
              htmlFor="playerName"
              className="block text-sm font-medium mb-2"
            >
              Your Council Title
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Council Director"
              className="w-full p-3 bg-secondary text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-neon-pink"
            />
          </div>

          {mode === null && (
            <div className="flex flex-col gap-4">
              <Button
                fullWidth
                glow={!!playerName}
                onClick={() => setMode("create")}
                disabled={!playerName}
              >
                <Play className="mr-2" />
                Create New Session
              </Button>

              <Button
                variant="outline"
                fullWidth
                onClick={() => setMode("join")}
              >
                <Users className="mr-2" />
                Join Existing Session
              </Button>
            </div>
          )}

          {mode === "create" && (
            <div className="animate-fade-in space-y-4">
              <p className="text-sm text-gray-400">
                Create a new game session and invite up to 3 other council
                members to join.
              </p>
              <Button
                fullWidth
                glow={!!playerName}
                onClick={handleCreateSession}
                disabled={isLoading}
              >
                {isLoading ? "Creating Session..." : "Start New Session"}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setMode(null)}>
                Back
              </Button>
            </div>
          )}

          {mode === "join" && (
            <div className="animate-fade-in space-y-4">
              <div>
                <label
                  htmlFor="sessionCode"
                  className="block text-sm font-medium mb-2"
                >
                  Session Code
                </label>
                <input
                  id="sessionCode"
                  type="text"
                  value={sessionCode}
                  onChange={(e) => {
                    // Convert to uppercase and limit to 6 characters
                    const value = e.target.value.toUpperCase().slice(0, 6);
                    setSessionCode(value);
                  }}
                  placeholder="Enter 6-digit code"
                  className="w-full p-3 bg-secondary text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-neon-pink"
                  maxLength={6}
                  pattern="[A-Z0-9]{6}"
                  title="Please enter a 6-digit code using uppercase letters and numbers"
                />
              </div>
              <Button
                fullWidth
                glow={!!playerName && !!sessionCode}
                onClick={handleJoinSession}
                disabled={isLoading}
              >
                {isLoading ? "Joining Session..." : "Join Session"}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setMode(null)}>
                Back
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
