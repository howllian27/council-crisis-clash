import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../hooks/use-toast";
import { gameService } from "../services/gameService";
import { v4 as uuidv4 } from "uuid";

interface MultiplayerContextType {
  playerId: string | null;
  playerName: string | null;
  currentSession: any | null;
  gamePhase: string;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  isHost: boolean;
  createSession: (name: string) => Promise<void>;
  joinSession: (sessionId: string, name: string) => Promise<void>;
  setPlayerReady: (isReady: boolean) => Promise<void>;
  startGame: () => Promise<void>;
  leaveSession: () => Promise<void>;
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
  const [subscription, setSubscription] = useState<any>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  const isHost =
    !!currentSession && !!playerId && currentSession.host_id === playerId;

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [subscription]);

  // Subscribe to game updates when session changes
  useEffect(() => {
    if (currentSession?.session_id) {
      // Unsubscribe from previous subscription if it exists
      if (subscription) {
        subscription.unsubscribe();
      }

      // Subscribe to game updates
      const newSubscription = gameService.subscribeToGame(
        currentSession.session_id,
        (gameState) => {
          setCurrentSession((prev) => ({
            ...prev,
            players: gameState.players,
            phase: gameState.phase,
            current_scenario: gameState.current_scenario,
          }));
        }
      );

      setSubscription(newSubscription);
    }
  }, [currentSession?.session_id]);

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
        players: {
          [response.host_id]: {
            id: response.host_id,
            name: name,
            role: "Council Leader",
            isReady: true,
            hasVoted: false,
            isEliminated: false,
          },
        },
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
  const joinSession = async (sessionId: string, name: string) => {
    try {
      setIsLoading(true);
      console.log("Joining session:", sessionId, "as:", name);

      const response = await gameService.joinGame(sessionId, name);
      console.log("Successfully joined game:", response);

      // Get the current game state to ensure we have the latest player data
      const gameState = await gameService.getGameState(sessionId);
      console.log("Current game state:", gameState);

      setPlayerId(response.player_id);
      setPlayerName(name);
      setCurrentSession({
        session_id: sessionId,
        host_id: response.host_id,
        code: sessionId,
        players: gameState.players || {},
      });

      setIsConnected(true);
      setIsLoading(false);

      // Navigate to the lobby
      navigate("/lobby");

      toast({
        title: "Joined Session",
        description: "You have successfully joined the game session",
      });
    } catch (err) {
      console.error("Error joining session:", err);
      setError(
        "Failed to join session. Please check the session code and try again."
      );
      setIsLoading(false);
    }
  };

  // Set player ready status
  const setPlayerReady = async (isReady: boolean) => {
    if (!currentSession?.session_id || !playerId) return;

    try {
      await gameService.updatePlayer(currentSession.session_id, playerId, {
        isReady,
      });
    } catch (err) {
      console.error("Error setting player ready status:", err);
      setError("Failed to update ready status. Please try again.");
    }
  };

  // Start the game
  const startGame = async () => {
    if (!currentSession?.session_id) return;

    try {
      await gameService.startGame(currentSession.session_id);
      navigate("/game");
    } catch (err) {
      console.error("Error starting game:", err);
      setError("Failed to start game. Please try again.");
    }
  };

  // Leave the current session
  const leaveSession = async () => {
    if (!currentSession?.session_id || !playerId) return;

    try {
      await gameService.leaveGame(currentSession.session_id, playerId);
      setCurrentSession(null);
      setPlayerId(null);
      setPlayerName(null);
      setIsConnected(false);
      navigate("/");
    } catch (err) {
      console.error("Error leaving session:", err);
      setError("Failed to leave session. Please try again.");
    }
  };

  return (
    <MultiplayerContext.Provider
      value={{
        playerId,
        playerName,
        currentSession,
        gamePhase,
        isConnected,
        isLoading,
        error,
        isHost,
        createSession,
        joinSession,
        setPlayerReady,
        startGame,
        leaveSession,
      }}
    >
      {children}
    </MultiplayerContext.Provider>
  );
};

export const useMultiplayer = () => {
  const context = useContext(MultiplayerContext);
  if (context === undefined) {
    throw new Error("useMultiplayer must be used within a MultiplayerProvider");
  }
  return context;
};
