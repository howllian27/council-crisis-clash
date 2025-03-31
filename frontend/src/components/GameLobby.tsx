import React from "react";
import Button from "./Button";
import { useMultiplayer } from "../contexts/MultiplayerContext";
import { cn } from "../lib/utils";

interface Player {
  id: string;
  name: string;
  role: string;
  isReady: boolean;
  hasVoted: boolean;
  isEliminated: boolean;
}

const GameLobby = () => {
  const {
    currentSession,
    isHost,
    playerId,
    setPlayerReady,
    startGame,
    leaveSession,
  } = useMultiplayer();

  if (!currentSession) {
    return <div>Loading...</div>;
  }

  const { code: sessionCode, players = {} } = currentSession;

  // Convert players object to array for easier manipulation
  const playersArray = Object.values(players as Record<string, Player>);
  const currentPlayer = (players as Record<string, Player>)[playerId];
  const isReady = currentPlayer?.isReady || false;

  const handleToggleReady = () => {
    setPlayerReady(!isReady);
  };

  const handleStartGame = () => {
    startGame();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    // Would show a toast here in a real implementation
    alert(`Session code ${sessionCode} copied to clipboard!`);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Game Lobby</h1>
          <Button variant="outline" onClick={leaveSession}>
            Leave Game
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Session Code:</span>
            <code className="px-2 py-1 bg-secondary rounded">
              {sessionCode}
            </code>
            <Button variant="ghost" size="sm" onClick={handleCopyCode}>
              Copy
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {Array.from({ length: 4 }).map((_, index) => {
              const player = playersArray[index];
              const isEmpty = !player;

              return (
                <div
                  key={index}
                  className={cn(
                    "p-4 rounded-lg border transition-all-200 border-border relative",
                    player
                      ? "bg-secondary"
                      : "bg-secondary bg-opacity-30 border-dashed"
                  )}
                >
                  {player?.id === currentSession.host_id && (
                    <div className="absolute -top-2 -right-2 bg-neon-pink text-xs px-2 py-1 rounded-full text-white">
                      Host
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl">
                      {player ? player.name.charAt(0) : "?"}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">
                        {player ? player.name : "Waiting for player..."}
                      </h3>
                      <div className="flex items-center mt-1">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full mr-2",
                            player?.isReady ? "bg-green-500" : "bg-gray-400"
                          )}
                        />
                        <span className="text-sm text-muted-foreground">
                          {player?.isReady ? "Ready" : "Not Ready"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-4 h-4 rounded-full cursor-pointer border",
                isReady
                  ? "bg-green-500 border-green-600"
                  : "bg-transparent border-gray-400"
              )}
              onClick={handleToggleReady}
            />
            <span>Mark as ready</span>
          </div>

          <div className="flex gap-4">
            <Button variant="outline" onClick={leaveSession}>
              Leave Game
            </Button>
            {isHost && (
              <div className="flex flex-col gap-2">
                <Button
                  glow={playersArray.length === 4}
                  disabled={playersArray.length < 4}
                  onClick={handleStartGame}
                >
                  Start Game
                </Button>
                {playersArray.length < 4 && (
                  <span className="text-sm text-muted-foreground">
                    Waiting for {4 - playersArray.length} more player
                    {4 - playersArray.length !== 1 ? "s" : ""}...
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLobby;
