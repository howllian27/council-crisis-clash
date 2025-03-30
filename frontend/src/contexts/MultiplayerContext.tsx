import React, { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../hooks/use-toast";
import { gameService } from "../services/gameService";
import { v4 as uuidv4 } from "uuid";

interface MultiplayerContextType {
  createSession: (playerName: string) => void;
  joinSession: (sessionCode: string, playerName: string) => void;
  leaveSession: () => void;
  startGame: () => void;
  endGame: () => void;
  setPlayerReady: (isReady: boolean) => void;
  castVote: (optionId: string) => void;
  nextRound: () => void;
  isHost: boolean;
  playerId: string | null;
  playerName: string | null;
  currentSession: any | null;
  gamePhase: string;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

const MultiplayerContext = createContext<MultiplayerContextType | undefined>(
  undefined
);

export const MultiplayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [gamePhase, setGamePhase] = useState<string>("lobby");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  const isHost =
    !!currentSession && !!playerId && currentSession.host_id === playerId;

  // Create a new game session
  const createSession = async (name: string) => {
    try {
      setIsLoading(true);
      console.log("Creating new session for player:", name);

      const response = await gameService.createGame(name);
      console.log("Game created successfully:", response);

      setPlayerId(response.host_id);
      setPlayerName(name);
      setCurrentSession({
        session_id: response.session_id,
        host_id: response.host_id,
        code: response.session_id,
        players: [
          {
            id: response.host_id,
            name: name,
            role: "Council Leader",
            isReady: true,
            hasVoted: false,
            isEliminated: false,
          },
        ],
      });

      setIsConnected(true);
      setIsLoading(false);

      // Navigate to the lobby
      navigate("/lobby");

      toast({
        title: "Session Created",
        description: `Your session code is ${response.session_id}`,
      });
    } catch (err) {
      console.error("Error creating session:", err);
      setError("Failed to create session. Please try again.");
      setIsLoading(false);
    }
  };

  // Join an existing game session
  const joinSession = async (sessionCode: string, name: string) => {
    try {
      setIsLoading(true);
      console.log("Joining session:", sessionCode, "as player:", name);

      const response = await gameService.joinGame(sessionCode, name);
      console.log("Joined game successfully:", response);

      setPlayerId(response.player_id);
      setPlayerName(name);

      // Fetch the current game state
      const gameState = await gameService.getGameState(sessionCode);
      console.log("Current game state:", gameState);

      setCurrentSession(gameState);
      setIsConnected(true);
      setIsLoading(false);

      // Navigate to the lobby
      navigate("/lobby");

      toast({
        title: "Joined Session",
        description: "You have successfully joined the game session.",
      });
    } catch (err) {
      console.error("Error joining session:", err);
      setError("Failed to join session. Please check the code and try again.");
      setIsLoading(false);
    }
  };

  // Leave the current session
  const leaveSession = () => {
    setCurrentSession(null);
    setPlayerId(null);
    setPlayerName(null);
    setIsConnected(false);
    navigate("/");
  };

  // Start the game
  const startGame = async () => {
    if (!currentSession) return;

    try {
      setIsLoading(true);
      await gameService.startGame(currentSession.session_id);
      setGamePhase("scenario");
      navigate("/game");
    } catch (err) {
      console.error("Error starting game:", err);
      setError("Failed to start game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // End the current game
  const endGame = () => {
    if (!currentSession) return;
    setCurrentSession(null);
    navigate("/");
  };

  // Set player ready status
  const setPlayerReady = (isReady: boolean) => {
    if (!currentSession || !playerId) return;

    const updatedSession = { ...currentSession };
    const playerIndex = updatedSession.players.findIndex(
      (p: any) => p.id === playerId
    );

    if (playerIndex !== -1) {
      updatedSession.players[playerIndex].isReady = isReady;
      setCurrentSession(updatedSession);
    }
  };

  // Cast a vote for an option
  const castVote = async (optionId: string) => {
    if (!currentSession || !playerId) return;

    try {
      await gameService.recordVote(
        currentSession.session_id,
        playerId,
        optionId
      );

      const updatedSession = { ...currentSession };
      const playerIndex = updatedSession.players.findIndex(
        (p: any) => p.id === playerId
      );

      if (playerIndex !== -1) {
        updatedSession.players[playerIndex].hasVoted = true;
        setCurrentSession(updatedSession);
      }
    } catch (err) {
      console.error("Error casting vote:", err);
      setError("Failed to cast vote. Please try again.");
    }
  };

  // Advance to the next round
  const nextRound = async () => {
    if (!currentSession) return;

    try {
      const updatedGameState = await gameService.getGameState(
        currentSession.session_id
      );
      setCurrentSession(updatedGameState);
      setGamePhase("scenario");
    } catch (err) {
      console.error("Error advancing to next round:", err);
      setError("Failed to advance to next round. Please try again.");
    }
  };

  // Provide context value
  const contextValue: MultiplayerContextType = {
    createSession,
    joinSession,
    leaveSession,
    startGame,
    endGame,
    setPlayerReady,
    castVote,
    nextRound,
    isHost,
    playerId,
    playerName,
    currentSession,
    gamePhase,
    isConnected,
    isLoading,
    error,
  };

  return (
    <MultiplayerContext.Provider value={contextValue}>
      {children}
    </MultiplayerContext.Provider>
  );
};

// Hook to use the multiplayer context
export const useMultiplayer = () => {
  const context = useContext(MultiplayerContext);
  if (context === undefined) {
    throw new Error("useMultiplayer must be used within a MultiplayerProvider");
  }
  return context;
};
