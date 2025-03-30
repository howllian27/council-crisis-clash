import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gameService } from "@/services/gameService";

interface JoinGameFormProps {
  onJoinSuccess: (sessionId: string, playerId: string) => void;
}

export function JoinGameForm({ onJoinSuccess }: JoinGameFormProps) {
  const [sessionId, setSessionId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("=== Form submission started ===");
    console.log("Form values:", { sessionId, playerName });

    setError(null);
    setIsLoading(true);

    try {
      if (!sessionId.trim() || !playerName.trim()) {
        console.error("Validation failed: Empty fields");
        throw new Error("Please fill in all fields");
      }

      console.log("Calling gameService.joinGame...");
      const response = await gameService.joinGame(sessionId, playerName);
      console.log("Join game response received:", response);

      console.log("Calling onJoinSuccess callback...");
      onJoinSuccess(sessionId, response.player_id);
      console.log("=== Form submission completed successfully ===");
    } catch (err) {
      console.error("=== Error in form submission ===");
      console.error("Error details:", err);
      if (err instanceof Error) {
        console.error("Error stack:", err.stack);
      }
      setError(err instanceof Error ? err.message : "Failed to join game");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="sessionId" className="block text-sm font-medium mb-1">
          Session Code
        </label>
        <Input
          id="sessionId"
          value={sessionId}
          onChange={(e) => {
            console.log("Session ID changed:", e.target.value);
            setSessionId(e.target.value);
          }}
          placeholder="Enter session code"
          required
        />
      </div>

      <div>
        <label htmlFor="playerName" className="block text-sm font-medium mb-1">
          Your Name
        </label>
        <Input
          id="playerName"
          value={playerName}
          onChange={(e) => {
            console.log("Player name changed:", e.target.value);
            setPlayerName(e.target.value);
          }}
          placeholder="Enter your name"
          required
        />
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full"
        onClick={() => console.log("Submit button clicked")}
      >
        {isLoading ? "Joining..." : "Join Session"}
      </Button>
    </form>
  );
}
