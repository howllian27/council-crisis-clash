import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { gameService } from "../services/gameService";
import { v4 as uuidv4 } from "uuid";
import { GamePhase, Scenario, GameState } from "../types/game";

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
  currentScenario: Scenario | null;
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
    scenario?: {
      title: string;
      description: string;
      consequences: string;
      options: Array<{
        id: string;
        text: string;
      }>;
    };
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
  scenarioTitle: string;
  scenarioDescription: string;
  scenarioOptions: string[];
  isScenarioComplete: boolean;
  setCurrentSession: React.Dispatch<React.SetStateAction<GameSession | null>>;
}

export const MultiplayerContext = createContext<MultiplayerContextType | null>(
  null
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
  const [scenarioTitle, setScenarioTitle] = useState<string>("");
  const [scenarioDescription, setScenarioDescription] = useState<string>("");
  const [scenarioOptions, setScenarioOptions] = useState<string[]>([]);
  const [isScenarioComplete, setIsScenarioComplete] = useState<boolean>(false);
  const [scenarioSocket, setScenarioSocket] = useState<WebSocket | null>(null);
  const [timerEndTime, setTimerEndTime] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  const navigate = useNavigate();

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

            // Handle game started message with scenario
            if (message.type === "game_started" && message.payload.scenario) {
              console.log(
                "Game started with scenario:",
                message.payload.scenario
              );
              setCurrentSession((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  phase: "scenario",
                  currentScenario: {
                    title: message.payload.scenario.title,
                    description: message.payload.scenario.description,
                    consequences: message.payload.scenario.consequences,
                    options: message.payload.scenario.options,
                  },
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
                  toast.error("Failed to start timer. Please try again.");
                });
            }
            navigate(
              `/game?sessionId=${currentSession.session_id}&playerId=${playerId}`
            );

            // Update the session phase immediately
            setCurrentSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                phase: "scenario",
              };
            });

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
                  toast.error("Failed to stop timer. Please try again.");
                });
            }

            // Update the session phase immediately
            setCurrentSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                phase: "results",
              };
            });
          }

          // Fetch the latest game state to ensure we have the most up-to-date data
          gameService
            .getGameState(currentSession.session_id)
            .then((latestGameState) => {
              console.log("Fetched latest game state:", latestGameState);

              // Parse current_scenario if it's a string
              let parsedScenario = latestGameState.current_scenario;
              if (typeof parsedScenario === "string") {
                try {
                  parsedScenario = JSON.parse(parsedScenario);
                  console.log(
                    "Successfully parsed scenario from string:",
                    parsedScenario
                  );
                } catch (e) {
                  console.error("Failed to parse current_scenario:", e);
                  parsedScenario = null;
                }
              } else if (parsedScenario) {
                console.log("Scenario is already an object:", parsedScenario);
              } else {
                console.log("No scenario available in game state");
              }

              // If we have a scenario in the game state but not in the session, update the session directly
              if (parsedScenario && !currentSession.currentScenario) {
                console.log(
                  "Found scenario in game state but not in session, updating session directly"
                );
                setCurrentSession((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    currentScenario: {
                      title: parsedScenario.title
                        ? parsedScenario.title.replace(/^"|"$/g, "")
                        : "Untitled Scenario",
                      description:
                        parsedScenario.description ||
                        "No description available",
                      consequences:
                        parsedScenario.consequences ||
                        "No consequences specified.",
                      options: parsedScenario.options
                        ? parsedScenario.options.map((opt, index) => ({
                            id: opt.id || `option${index + 1}`,
                            text: opt.text || `Option ${index + 1}`,
                          }))
                        : [],
                    },
                  };
                });
                return; // Exit early to prevent further state updates
              }

              setCurrentSession((prev) => {
                if (!prev) return prev;

                console.log("Updating session state with latest game state:", {
                  previousPhase: prev.phase,
                  newPhase: latestGameState.phase,
                  previousTimerRunning: prev.timer_running,
                  newTimerRunning: latestGameState.timer_running,
                  previousTimerEndTime: prev.timer_end_time,
                  newTimerEndTime: latestGameState.timer_end_time,
                  currentScenario: parsedScenario,
                  timestamp: new Date().toISOString(),
                });

                // Create the updated session
                const updatedSession = {
                  ...prev,
                  players: Object.values(latestGameState.players).map(
                    (player) => ({
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
                    })
                  ),
                  resources: [
                    {
                      type: "tech",
                      value: latestGameState.resources.tech,
                      maxValue: 100,
                    },
                    {
                      type: "manpower",
                      value: latestGameState.resources.manpower,
                      maxValue: 100,
                    },
                    {
                      type: "economy",
                      value: latestGameState.resources.economy,
                      maxValue: 100,
                    },
                    {
                      type: "happiness",
                      value: latestGameState.resources.happiness,
                      maxValue: 100,
                    },
                    {
                      type: "trust",
                      value: latestGameState.resources.trust,
                      maxValue: 100,
                    },
                  ],
                  currentRound: latestGameState.current_round,
                  phase: latestGameState.phase,
                  currentScenario: parsedScenario
                    ? {
                        title: parsedScenario.title
                          ? parsedScenario.title.replace(/^"|"$/g, "")
                          : "Untitled Scenario",
                        description:
                          parsedScenario.description ||
                          "No description available",
                        consequences:
                          parsedScenario.consequences ||
                          "No consequences specified.",
                        options: parsedScenario.options
                          ? parsedScenario.options.map((opt, index) => ({
                              id: opt.id || `option${index + 1}`,
                              text: opt.text || `Option ${index + 1}`,
                            }))
                          : [],
                      }
                    : null,
                  roundStartTime: latestGameState.roundStartTime || Date.now(),
                  timer_running: latestGameState.timer_running,
                  timer_end_time: latestGameState.timer_end_time,
                };

                console.log("Updated session with scenario:", {
                  hasScenario: !!updatedSession.currentScenario,
                  scenarioTitle: updatedSession.currentScenario?.title,
                  scenarioOptions:
                    updatedSession.currentScenario?.options?.length,
                });

                return updatedSession;
              });
            })
            .catch((error) => {
              console.error("Error fetching latest game state:", error);
            });
        }
      );

      setSubscription(newSubscription);
    }
  }, [currentSession?.session_id, navigate, playerId, gamePhase]);

  // Add timer check interval
  useEffect(() => {
    if (!timerRunning || !timerEndTime) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(timerEndTime).getTime();

      if (now >= end) {
        setTimerRunning(false);
        setTimerEndTime(null);
        // Update game phase to results when timer ends
        if (currentSession?.session_id) {
          gameService
            .updateGamePhase(currentSession.session_id, "results")
            .catch((error) => {
              console.error("Error updating game phase:", error);
              toast.error("Failed to update game phase");
            });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, timerEndTime, currentSession]);

  // Update timer state handling in handleGameStateUpdate
  const handleGameStateUpdate = useCallback(
    (gameState: GameState) => {
      if (!gameState) return;

      console.log("Handling game state update:", gameState);

      setTimerRunning(gameState.timer_running);
      setTimerEndTime(gameState.timer_end_time);

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
        setGamePhase(gameState.phase);
      }

      // Check if phase changed to scenario
      if (
        gameState.phase === "scenario" &&
        currentSession?.phase !== "scenario"
      ) {
        console.log("Phase changed to scenario, starting timer");
        // Only start timer if it's not already running
        if (currentSession?.session_id && !gameState.timer_running) {
          gameService
            .startTimer(currentSession.session_id)
            .then(() => {
              console.log("Timer started on server");
              setTimerRunning(true);
            })
            .catch((error) => {
              console.error("Error starting timer:", error);
              toast.error("Failed to start timer");
            });
        }
      }

      // Update the session state
      setCurrentSession((prev) => {
        if (!prev) return gameState;
        return {
          ...prev,
          ...gameState,
          timer_running: gameState.timer_running,
          timer_end_time: gameState.timer_end_time,
        };
      });
    },
    [currentSession, setGamePhase, setCurrentSession]
  );

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
        currentScenario: null,
        roundStartTime: Date.now(),
        timer_running: false,
        timer_end_time: null,
      });

      setIsConnected(true);
      setIsLoading(false);

      // Navigate to the lobby
      navigate("/lobby");

      toast.success(
        `Session created. Your session code is ${response.session_id}`
      );
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
        currentScenario: gameState.current_scenario
          ? {
              title: gameState.current_scenario.title,
              description: gameState.current_scenario.description,
              consequences:
                gameState.current_scenario.consequences ||
                "No consequences specified.",
              options: gameState.current_scenario.options.map((opt, index) => ({
                id: opt.id || `option${index + 1}`,
                text: opt.text,
              })),
            }
          : null,
        roundStartTime: Date.now(),
        timer_running: false,
        timer_end_time: null,
      });

      setIsConnected(true);
      setIsLoading(false);

      // Navigate to the lobby
      navigate("/lobby");

      toast.success("You have successfully joined the game session");
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
          toast.error("Failed to update game phase. Please try again.");
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
        toast.error("Failed to record your vote. Please try again.");
      }
    },
    [currentSession, playerId, toast]
  );

  // Move to the next round
  const nextRound = async () => {
    if (!currentSession?.session_id) return;

    try {
      console.log("Starting next round...");
      // Call the backend API to start the next round
      const response = await fetch(
        `http://localhost:8000/api/games/${currentSession.session_id}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Next round started successfully:", data);

      // Update the session with the new round number
      setCurrentSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentRound: prev.currentRound + 1,
          // Don't update the scenario here, it will be fetched by the Game component
        };
      });
    } catch (err) {
      console.error("Error starting next round:", err);
      setError("Failed to start next round. Please try again.");
    }
  };

  const handlePhaseChange = async (newPhase: GamePhase) => {
    if (!currentSession) return;

    try {
      // Update game phase in Supabase
      await gameService.updateGamePhase(currentSession.session_id, newPhase);

      // If transitioning to scenario phase, start scenario generation
      if (newPhase === GamePhase.SCENARIO) {
        // Reset scenario state
        setScenarioTitle("");
        setScenarioDescription("");
        setScenarioOptions([]);
        setIsScenarioComplete(false);

        // Connect to scenario WebSocket
        const ws = new WebSocket(
          `ws://localhost:8000/ws/${currentSession.session_id}/scenario`
        );

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "scenario_title":
              setScenarioTitle(data.content);
              break;
            case "scenario_description":
              setScenarioDescription((prev) => prev + data.content);
              break;
            case "scenario_complete":
              setIsScenarioComplete(true);
              // Request voting options
              requestVotingOptions();
              break;
          }
        };

        ws.onerror = (error) => {
          console.error("Scenario WebSocket error:", error);
          toast.error("Failed to generate scenario");
        };

        ws.onclose = () => {
          console.log("Scenario WebSocket closed");
        };

        setScenarioSocket(ws);
      }

      // If transitioning to results phase, stop the timer
      if (newPhase === GamePhase.RESULTS) {
        await gameService.stopTimer(currentSession.session_id);
      }

      setGamePhase(newPhase);
    } catch (error) {
      console.error("Error updating game phase:", error);
      toast.error("Failed to update game phase");
    }
  };

  const requestVotingOptions = async () => {
    if (!currentSession) return;

    try {
      const response = await fetch(
        `http://localhost:8000/api/games/${currentSession.session_id}/scenario/options`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get voting options");
      }

      const data = await response.json();
      setScenarioOptions(data.options);
    } catch (error) {
      console.error("Error getting voting options:", error);
      toast.error("Failed to get voting options");
    }
  };

  // Clean up WebSocket connection when component unmounts
  useEffect(() => {
    return () => {
      if (scenarioSocket) {
        scenarioSocket.close();
      }
    };
  }, [scenarioSocket]);

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
        scenarioTitle,
        scenarioDescription,
        scenarioOptions,
        isScenarioComplete,
        setCurrentSession,
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
