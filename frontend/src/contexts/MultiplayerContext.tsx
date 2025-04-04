import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../hooks/use-toast";
import { gameService, GameState } from "../services/gameService";
import { v4 as uuidv4 } from "uuid";
import { Scenario } from "../services/gameService";

interface GameSession {
  session_id: string;
  host_id: string;
  code: string;
  players: Array<{
    id: string;
    name: string;
    role: string;
    isReady: boolean;
    hasVoted: boolean;
    isEliminated: boolean;
    secretObjective: {
      description: string;
      isCompleted: boolean;
      progress: number;
      target: number;
    };
  }>;
  resources: Array<{
    type: string;
    value: number;
    maxValue: number;
  }>;
  currentRound: number;
  phase: string;
  currentScenario: Scenario;
  roundStartTime: number;
  timer_running: boolean;
  timer_end_time: string | null;
}

interface Player {
  id: string;
  name: string;
  hasVoted: boolean;
}

interface Resource {
  type: string;
  value: number;
  maxValue: number;
}

interface WebSocketMessage {
  type: string;
  payload: {
    results?: Record<string, string>;
    phase?: string;
    [key: string]: unknown;
  };
}

interface MultiplayerContextType {
  playerId: string | null;
  playerName: string | null;
  currentSession: GameSession | null;
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
  castVote: (optionId: string) => Promise<void>;
  nextRound: () => Promise<void>;
}

const MultiplayerContext = createContext<MultiplayerContextType | undefined>(
  undefined
);

export const MultiplayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(
    null
  );
  const [gamePhase, setGamePhase] = useState<string>("lobby");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    unsubscribe: () => void;
  } | null>(null);

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
      console.log(
        "Setting up subscription for session:",
        currentSession.session_id
      );

      // Unsubscribe from previous subscription if it exists
      if (subscription) {
        console.log("Unsubscribing from previous subscription");
        subscription.unsubscribe();
      }

      // Subscribe to game updates
      const newSubscription = gameService.subscribeToGame(
        currentSession.session_id,
        (gameState) => {
          console.log("=== Received Game State Update ===");
          console.log("Game State:", gameState);

          if (
            typeof gameState === "object" &&
            gameState !== null &&
            "type" in gameState &&
            "payload" in gameState
          ) {
            const message = gameState as unknown as WebSocketMessage;
            if (message.type === "voting_complete") {
              console.log("Voting complete, transitioning to results phase");
              setGamePhase("results");
              // Update session state with voting results
              setCurrentSession((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  phase: "results",
                  votingResults: message.payload.results,
                };
              });
              return; // Exit early to prevent further state updates
            }
          }

          // Log timer state changes
          if (gameState.timer_running !== currentSession?.timer_running) {
            console.log("Timer running state changed:", {
              previous: currentSession?.timer_running,
              current: gameState.timer_running,
              timestamp: new Date().toISOString(),
            });

            if (gameState.timer_running) {
              console.log("Timer started");
            } else {
              console.log("Timer stopped");
            }
          }

          if (gameState.timer_end_time !== currentSession?.timer_end_time) {
            console.log("Timer end time changed:", {
              previous: currentSession?.timer_end_time,
              current: gameState.timer_end_time,
              timestamp: new Date().toISOString(),
            });
          }

          // Update the phase in the context first
          if (gameState.phase !== currentSession?.phase) {
            console.log("Phase changed:", {
              previous: currentSession?.phase,
              current: gameState.phase,
              timestamp: new Date().toISOString(),
            });
          }
          setGamePhase(gameState.phase);

          // Check if phase changed to scenario
          if (
            gameState.phase === "scenario" &&
            currentSession.phase !== "scenario"
          ) {
            console.log(
              "Phase changed to scenario, starting timer and navigating to game page"
            );
            // Only start timer if it's not already running
            if (currentSession?.session_id && !gameState.timer_running) {
              gameService
                .startTimer(currentSession.session_id)
                .then(() => {
                  console.log("Timer started on server");
                })
                .catch((error) => {
                  console.error("Error starting timer:", error);
                  toast({
                    title: "Error",
                    description: "Failed to start timer. Please try again.",
                    variant: "destructive",
                  });
                });
            }
            navigate(
              `/game?sessionId=${currentSession.session_id}&playerId=${playerId}`
            );
            return; // Exit early to prevent state update
          }

          // Check if phase changed to results
          if (
            gameState.phase === "results" &&
            currentSession.phase !== "results"
          ) {
            console.log("Phase changed to results, stopping timer");
            // Only stop timer if it's currently running
            if (currentSession?.session_id && gameState.timer_running) {
              gameService
                .stopTimer(currentSession.session_id)
                .then(() => {
                  console.log("Timer stopped on server");
                })
                .catch((error) => {
                  console.error("Error stopping timer:", error);
                  toast({
                    title: "Error",
                    description: "Failed to stop timer. Please try again.",
                    variant: "destructive",
                  });
                });
            }
          }

          setCurrentSession((prev) => {
            if (!prev) return prev;

            // Get the current scenario from game state or use a default
            const currentScenario = gameState.current_scenario || {
              title: "Mysterious Signal From Deep Space",
              description:
                "Our deep space monitoring stations have detected an unusual signal originating from beyond our solar system. Initial analysis suggests it could be artificial in nature. The signal appears to contain complex mathematical sequences that our scientists believe may be an attempt at communication. However, there is no consensus on whether we should respond or what the message might contain.",
              consequences:
                "How we handle this situation could dramatically affect our technological development and potentially our safety if the signal represents a threat.",
              options: [
                {
                  id: "option1",
                  text: "Allocate resources to decode the signal but do not respond yet",
                },
                {
                  id: "option2",
                  text: "Immediately broadcast a response using similar mathematical principles",
                },
                {
                  id: "option3",
                  text: "Ignore the signal and increase our defensive capabilities",
                },
                {
                  id: "option4",
                  text: "Share the discovery with the public and crowdsource analysis",
                },
              ],
            };

            console.log("Updating session state:", {
              previousPhase: prev.phase,
              newPhase: gameState.phase,
              previousTimerRunning: prev.timer_running,
              newTimerRunning: gameState.timer_running,
              previousTimerEndTime: prev.timer_end_time,
              newTimerEndTime: gameState.timer_end_time,
              timestamp: new Date().toISOString(),
            });

            return {
              ...prev,
              players: Object.values(gameState.players).map((player) => ({
                id: player.id,
                name: player.name,
                role: player.role,
                isReady: true,
                hasVoted: player.has_voted,
                isEliminated: player.is_eliminated,
                secretObjective: {
                  description: player.secret_incentive,
                  isCompleted: false,
                  progress: 0,
                  target: 3,
                },
              })),
              resources: [
                {
                  type: "tech",
                  value: gameState.resources.tech,
                  maxValue: 100,
                },
                {
                  type: "manpower",
                  value: gameState.resources.manpower,
                  maxValue: 100,
                },
                {
                  type: "economy",
                  value: gameState.resources.economy,
                  maxValue: 100,
                },
                {
                  type: "happiness",
                  value: gameState.resources.happiness,
                  maxValue: 100,
                },
                {
                  type: "trust",
                  value: gameState.resources.trust,
                  maxValue: 100,
                },
              ],
              currentRound: gameState.current_round,
              phase: gameState.phase,
              currentScenario,
              roundStartTime: gameState.roundStartTime || Date.now(),
              timer_running: gameState.timer_running,
              timer_end_time: gameState.timer_end_time,
            };
          });
        }
      );

      setSubscription(newSubscription);
    }
  }, [currentSession?.session_id, navigate, playerId, gamePhase]);

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
        phase: "lobby",
        players: [
          {
            id: response.host_id,
            name: name,
            role: "Council Leader",
            isReady: true,
            hasVoted: false,
            isEliminated: false,
            secretObjective: {
              description:
                "Ensure the 'trust' resource stays above 60% for 3 rounds",
              isCompleted: false,
              progress: 0,
              target: 3,
            },
          },
        ],
        resources: [
          { type: "tech", value: 75, maxValue: 100 },
          { type: "manpower", value: 60, maxValue: 100 },
          { type: "economy", value: 80, maxValue: 100 },
          { type: "happiness", value: 90, maxValue: 100 },
          { type: "trust", value: 70, maxValue: 100 },
        ],
        currentRound: 1,
        currentScenario: {
          title: "Mysterious Signal From Deep Space",
          description:
            "Our deep space monitoring stations have detected an unusual signal originating from beyond our solar system. Initial analysis suggests it could be artificial in nature. The signal appears to contain complex mathematical sequences that our scientists believe may be an attempt at communication. However, there is no consensus on whether we should respond or what the message might contain.",
          consequences:
            "How we handle this situation could dramatically affect our technological development and potentially our safety if the signal represents a threat.",
          options: [
            {
              id: "option1",
              text: "Allocate resources to decode the signal but do not respond yet",
            },
            {
              id: "option2",
              text: "Immediately broadcast a response using similar mathematical principles",
            },
            {
              id: "option3",
              text: "Ignore the signal and increase our defensive capabilities",
            },
            {
              id: "option4",
              text: "Share the discovery with the public and crowdsource analysis",
            },
          ],
        },
        roundStartTime: Date.now(),
        timer_running: false,
        timer_end_time: null,
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
        phase: gameState.phase || "lobby",
        players: Object.values(gameState.players).map((player) => ({
          id: player.id,
          name: player.name,
          role: player.role,
          isReady: true,
          hasVoted: player.has_voted,
          isEliminated: player.is_eliminated,
          secretObjective: {
            description: player.secret_incentive,
            isCompleted: false,
            progress: 0,
            target: 3,
          },
        })),
        resources: [
          { type: "tech", value: gameState.resources.tech, maxValue: 100 },
          {
            type: "manpower",
            value: gameState.resources.manpower,
            maxValue: 100,
          },
          {
            type: "economy",
            value: gameState.resources.economy,
            maxValue: 100,
          },
          {
            type: "happiness",
            value: gameState.resources.happiness,
            maxValue: 100,
          },
          { type: "trust", value: gameState.resources.trust, maxValue: 100 },
        ],
        currentRound: gameState.current_round,
        currentScenario: gameState.current_scenario || {
          title: "Mysterious Signal From Deep Space",
          description:
            "Our deep space monitoring stations have detected an unusual signal originating from beyond our solar system. Initial analysis suggests it could be artificial in nature. The signal appears to contain complex mathematical sequences that our scientists believe may be an attempt at communication. However, there is no consensus on whether we should respond or what the message might contain.",
          consequences:
            "How we handle this situation could dramatically affect our technological development and potentially our safety if the signal represents a threat.",
          options: [
            {
              id: "option1",
              text: "Allocate resources to decode the signal but do not respond yet",
            },
            {
              id: "option2",
              text: "Immediately broadcast a response using similar mathematical principles",
            },
            {
              id: "option3",
              text: "Ignore the signal and increase our defensive capabilities",
            },
            {
              id: "option4",
              text: "Share the discovery with the public and crowdsource analysis",
            },
          ],
        },
        roundStartTime: Date.now(),
        timer_running: false,
        timer_end_time: null,
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
      console.log("Starting game...");
      await gameService.startGame(currentSession.session_id);
      console.log("Game started successfully");
      // Navigation will be handled by the subscription when phase changes
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

  // Update the handleTimerExpiration function
  const handleTimerExpiration = useCallback(() => {
    console.log("=== Timer Expiration Handler ===");
    console.log("Current session state:", currentSession);
    console.log("Current game phase:", gamePhase);
    console.log("Timestamp:", new Date().toISOString());

    // Update phase to results when timer expires
    if (currentSession?.session_id) {
      console.log("Timer expired, transitioning to results phase");
      gameService
        .updateGamePhase(currentSession.session_id, "results")
        .then(() => {
          console.log("Game phase updated to results on server");
          // The subscription will handle updating the local state
        })
        .catch((error) => {
          console.error("Error updating game phase:", error);
          toast({
            title: "Error",
            description: "Failed to update game phase. Please try again.",
            variant: "destructive",
          });
        });
    }
  }, [currentSession?.session_id, toast]);

  // Remove the timer check effect since timer is now managed server-side
  useEffect(() => {
    console.log("=== Phase Change Effect ===");
    console.log("Game phase changed to:", gamePhase);
    console.log("Current session phase:", currentSession?.phase);
    console.log("Timer running:", currentSession?.timer_running);
    console.log("Timer end time:", currentSession?.timer_end_time);
    console.log("Timestamp:", new Date().toISOString());

    if (gamePhase === "scenario") {
      console.log("Scenario phase active - timer should be running on server");
    } else if (gamePhase === "results") {
      console.log("Results phase active - timer should be stopped on server");
    }
  }, [gamePhase, currentSession]);

  // Update the castVote function
  const castVote = useCallback(
    async (optionId: string) => {
      if (!currentSession || !playerId) {
        console.log("Cannot cast vote: no session or player ID");
        return;
      }

      try {
        console.log("=== Casting Vote ===");
        console.log("Option ID:", optionId);
        console.log("Player ID:", playerId);
        console.log("Current session state:", currentSession);

        await gameService.recordVote(
          currentSession.session_id,
          playerId,
          optionId
        );

        // Update local state
        setCurrentSession((prev) => {
          if (!prev) return prev;
          console.log("Updating local session state after vote");
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === playerId ? { ...p, hasVoted: true } : p
            ),
          };
        });

        // Check if all players have voted
        const allPlayersVoted = currentSession.players.every((p) => p.hasVoted);
        console.log("All players voted:", allPlayersVoted);

        if (allPlayersVoted) {
          console.log("All players have voted, transitioning to results phase");
          // The server will handle stopping the timer and updating the phase
          // The subscription will handle updating the local state
        }
      } catch (error) {
        console.error("Error casting vote:", error);
        toast({
          title: "Error",
          description: "Failed to record your vote. Please try again.",
          variant: "destructive",
        });
      }
    },
    [currentSession, playerId, toast]
  );

  // Move to the next round
  const nextRound = async () => {
    if (!currentSession?.session_id) return;

    try {
      await gameService.startGame(currentSession.session_id);
    } catch (err) {
      console.error("Error starting next round:", err);
      setError("Failed to start next round. Please try again.");
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
        castVote,
        nextRound,
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
