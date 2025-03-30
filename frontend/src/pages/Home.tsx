import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { JoinGameForm } from "@/components/JoinGameForm";
import { gameService } from "@/services/gameService";

export default function Home() {
  const navigate = useNavigate();
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [hostName, setHostName] = useState("");

  const handleCreateGame = async () => {
    try {
      console.log("=== Creating new game ===");
      console.log("Host name:", hostName);

      if (!hostName.trim()) {
        console.error("Host name is empty");
        throw new Error("Please enter your name");
      }

      console.log("Calling gameService.createGame...");
      const response = await gameService.createGame(hostName);
      console.log("Game created successfully:", response);

      if (!response.session_id || !response.host_id) {
        console.error("Invalid response from server:", response);
        throw new Error("Invalid response from server");
      }

      console.log("Navigating to game page with params:", {
        sessionId: response.session_id,
        playerId: response.host_id,
      });

      navigate(
        `/game?sessionId=${response.session_id}&playerId=${response.host_id}`
      );
    } catch (error) {
      console.error("=== Error creating game ===");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Error stack:", error.stack);
      }
      // You might want to show this error to the user
      alert(error instanceof Error ? error.message : "Failed to create game");
    }
  };

  const handleJoinSuccess = (sessionId: string, playerId: string) => {
    console.log("=== Join game success ===");
    console.log("Session ID:", sessionId);
    console.log("Player ID:", playerId);

    console.log("Navigating to game page with params:", {
      sessionId,
      playerId,
    });

    navigate(`/game?sessionId=${sessionId}&playerId=${playerId}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Council Crisis Clash
        </h1>
        <p className="text-xl text-muted-foreground">
          Face absurd crises as a government council in this multiplayer web
          game.
        </p>

        {!showJoinForm ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Enter your name"
                value={hostName}
                onChange={(e) => {
                  console.log("Host name changed:", e.target.value);
                  setHostName(e.target.value);
                }}
                className="w-full p-2 border rounded"
              />
              <Button
                size="lg"
                onClick={() => {
                  console.log("Create game button clicked");
                  handleCreateGame();
                }}
                disabled={!hostName.trim()}
                className="w-full"
              >
                Create New Game
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                console.log("Show join form button clicked");
                setShowJoinForm(true);
              }}
              className="w-full"
            >
              Join Existing Game
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <JoinGameForm onJoinSuccess={handleJoinSuccess} />
            <Button
              variant="ghost"
              onClick={() => {
                console.log("Back button clicked");
                setShowJoinForm(false);
              }}
              className="w-full"
            >
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
