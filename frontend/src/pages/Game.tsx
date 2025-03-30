import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { gameService, GameState } from "@/services/gameService";

export default function Game() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("sessionId");
  const playerId = searchParams.get("playerId");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !playerId) {
      navigate("/");
      return;
    }

    // Load initial game state
    const loadGameState = async () => {
      try {
        const state = await gameService.getGameState(sessionId);
        setGameState(state);
      } catch (err) {
        console.error("Error loading game state:", err);
        setError("Failed to load game state");
      }
    };

    loadGameState();

    // Subscribe to game state changes
    const subscription = gameService.subscribeToGame(sessionId, (state) => {
      console.log("Game state updated:", state);
      setGameState(state);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [sessionId, playerId, navigate]);

  const handleLeave = () => {
    navigate("/");
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">{error}</h2>
          <Button onClick={handleLeave}>Return to Home</Button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading game...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Game Session</h1>
          <Button variant="outline" onClick={handleLeave}>
            Leave Game
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Current Scenario</h2>
            <div className="p-4 border rounded-lg">
              <p className="text-muted-foreground">
                {gameState.current_scenario ||
                  "No active scenario. Waiting for game to start..."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Resources</h2>
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Public Trust</span>
                <span>{gameState.resources.trust}%</span>
              </div>
              <div className="flex justify-between">
                <span>Budget</span>
                <span>${gameState.resources.economy * 10000}</span>
              </div>
              <div className="flex justify-between">
                <span>Tech Level</span>
                <span>{gameState.resources.tech}%</span>
              </div>
              <div className="flex justify-between">
                <span>Manpower</span>
                <span>{gameState.resources.manpower}%</span>
              </div>
              <div className="flex justify-between">
                <span>Happiness</span>
                <span>{gameState.resources.happiness}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Players</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(gameState.players).map((player) => (
              <div
                key={player.id}
                className={`p-4 border rounded-lg ${
                  player.id === playerId ? "border-primary" : ""
                } ${player.is_eliminated ? "opacity-50" : ""}`}
              >
                <div className="font-medium">{player.name}</div>
                <div className="text-sm text-muted-foreground">
                  {player.role}
                </div>
                {player.has_voted && (
                  <div className="text-xs text-green-500 mt-1">Voted</div>
                )}
                {player.is_eliminated && (
                  <div className="text-xs text-red-500 mt-1">Eliminated</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
