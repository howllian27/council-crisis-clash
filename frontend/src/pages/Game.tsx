import React, { useEffect, useState, useRef } from "react";
import ResourceBar from "../components/ResourceBar";
import ScenarioDisplay from "../components/ScenarioDisplay";
import VotingPanel from "../components/VotingPanel";
import Button from "../components/Button";
import { cn } from "../lib/utils";
import { useMultiplayer } from "../contexts/MultiplayerContext";
import { useNavigate } from "react-router-dom";
import {
  createGameSession,
  getSampleScenario,
} from "../services/gameSessionService";
import { gameService } from "../services/gameService";
import LoadingOverlay from "../components/LoadingOverlay";
import Timer from "../components/Timer";
import PlayerListPanel from "../components/PlayerListPanel";
import SecretIncentiveNotification from "../components/SecretIncentiveNotification";
import { GamePhase } from "../types/game";

// Define interface for vote counts
interface VoteCounts {
  [key: string]: number;
}

interface GamePlayer {
  id: string;
  name: string;
  role: string;
  isReady: boolean;
  hasVoted: boolean;
  isEliminated: boolean;
  vote_weight: number;
  secretObjective: {
    description: string;
    isCompleted: boolean;
    progress: number;
    target: number;
  };
}

interface IncentiveData {
  player_id: string;
  text: string;
}

const Game = () => {
  const navigate = useNavigate();
  const {
    currentSession,
    playerId,
    gamePhase,
    castVote,
    nextRound,
    leaveSession,
    setCurrentSession,
    isLoading,
    loadingMessage,
    setIsLoading,
    setLoadingMessage,
    startGame,
  } = useMultiplayer();

  // Debug mode state to bypass session check for direct navigation
  const [debugSession, setDebugSession] = useState(null);
  const [debugMode] = useState(import.meta.env.DEV);
  const [outcome, setOutcome] = useState("");
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [incentiveText, setIncentiveText] = useState<string>("");
  const [isIncentiveLoading, setIsIncentiveLoading] = useState<boolean>(false);
  const [fetchedRound, setFetchedRound] = useState<number | null>(null);
  // Add state for button debouncing and phase transition
  const [isStartButtonDisabled, setIsStartButtonDisabled] = useState(false);
  const [isPhaseTransition, setIsPhaseTransition] = useState(false);
  const [startButtonTimeout, setStartButtonTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const [previousGamePhase, setPreviousGamePhase] = useState<GamePhase | null>(
    null
  );
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState("");

  // Use either the current session or debug session
  const session = currentSession || debugSession;

  // Declare currentPlayer before using it in useEffect dependencies.
  const currentPlayer: GamePlayer | undefined = session?.players?.find(
    (p: GamePlayer) => p.id === playerId
  );

  // Set game phase based on session state - only use session phase if available
  const currentGamePhase = session?.phase || gamePhase || "lobby";

  // Sample incentive texts
  const sampleIncentives = [
    "Vote for the option that will decrease Tech resources for a secret reward.",
    "Support the option that boosts Economy for hidden benefits.",
    "Choose the option that might lower Trust - your loyalty will be rewarded.",
    "Pick the option that affects Happiness negatively for covert gains.",
    "Select the choice that reduces Manpower for concealed advantages.",
  ];

  // Single effect to manage secret incentives
  useEffect(() => {
    const generateIncentive = async () => {
      try {
        // Only run if the current player is the host and we're in scenario phase
        if (
          currentPlayer?.id !== session?.host_id ||
          currentGamePhase !== "scenario"
        )
          return;

        // Don't regenerate if we already have an incentive for this round
        if (session.currentRound === fetchedRound) {
          console.log("Already generated incentive for this round");
          return;
        }

        console.log(
          "Host generating secret incentive for round:",
          session.currentRound
        );
        const response = await fetch(
          `http://localhost:8000/api/games/${session.session_id}/secret_incentive?round=${session.currentRound}`,
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
        const data: IncentiveData = await response.json();
        console.log("Host generated secret incentive:", data);
      } catch (error) {
        console.error("Error generating secret incentive:", error);
      }
    };

    // Generate incentive at the start of scenario phase
    if (currentGamePhase === "scenario") {
      generateIncentive();
    }
  }, [
    session?.session_id,
    session?.currentRound,
    currentGamePhase,
    currentPlayer,
    fetchedRound,
  ]);

  useEffect(() => {
    const pollForSecretIncentive = async () => {
      console.log("Polling for secret incentive with:", {
        sessionId: session?.session_id,
        currentRound: session?.currentRound,
        gamePhase: currentGamePhase,
        playerId,
      });

      if (
        !session?.session_id ||
        !session?.currentRound ||
        currentGamePhase !== "scenario"
      ) {
        console.log("Skipping poll - missing required data");
        return; // Don't clear the state here, only when phase changes
      }

      // Only poll if we haven't already fetched for this round
      if (session.currentRound === fetchedRound) {
        console.log("Already fetched incentive for this round");
        return;
      }

      try {
        setIsIncentiveLoading(true);
        const maxAttempts = 5;
        let attempts = 0;
        let incentive: Partial<IncentiveData> = {};

        while (attempts < maxAttempts) {
          console.log(
            `Polling attempt ${attempts + 1} for round ${session.currentRound}`
          );
          const response = await fetch(
            `http://localhost:8000/api/games/${session.session_id}/secret_incentive?player_id=${playerId}&round=${session.currentRound}`
          );
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data: Partial<IncentiveData> = await response.json();
          console.log("Received polling data:", data);
          // Break out if valid incentive data is present
          if (data.player_id && data.text) {
            incentive = data;
            break;
          }
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        if (incentive.player_id && incentive.text) {
          setSelectedPlayerId(incentive.player_id);
          setIncentiveText(incentive.text);
          setFetchedRound(session.currentRound);
          console.log("Updated incentive state:", {
            selectedPlayerId: incentive.player_id,
            incentiveText: incentive.text,
            fetchedRound: session.currentRound,
          });
        }
      } catch (error) {
        console.error("Error polling for secret incentive:", error);
      } finally {
        setIsIncentiveLoading(false);
      }
    };

    // Start polling when entering scenario phase
    if (currentGamePhase === "scenario") {
      pollForSecretIncentive();
    }
  }, [
    session?.session_id,
    session?.currentRound,
    currentGamePhase,
    playerId,
    fetchedRound,
  ]);

  // Clear incentive state only when phase changes to results
  useEffect(() => {
    if (currentGamePhase === "results") {
      console.log("Clearing secret incentive selection in results phase");
      setSelectedPlayerId(null);
      setIncentiveText("");
      setIsIncentiveLoading(false);
    }
  }, [currentGamePhase]);

  // Debug logging
  useEffect(() => {
    console.log("Incentive State:", {
      round: session?.currentRound,
      phase: currentGamePhase,
      selectedPlayer: selectedPlayerId,
      incentiveText,
      sessionId: session?.session_id,
      isIncentiveLoading,
    });
  }, [
    session?.currentRound,
    currentGamePhase,
    selectedPlayerId,
    incentiveText,
    session?.session_id,
    isIncentiveLoading,
  ]);

  // Add an effect to monitor consecutive rounds
  useEffect(() => {
    console.log("Consecutive rounds state:", {
      consecutiveRounds: session?.consecutiveRounds,
    });
  }, [session?.consecutiveRounds]);

  // Add debug logging for gamePhase
  console.log("Game Phase Value:", {
    gamePhase,
    currentGamePhase: gamePhase || "scenario",
  });

  // Initialize a debug session if navigating directly to /game
  useEffect(() => {
    if (debugMode && !currentSession) {
      console.log("Debug mode: Creating sample game session");
      const sampleSession = {
        session_id: "debug-session",
        host_id: "debug-host",
        code: "DEBUG",
        phase: "scenario",
        players: [
          {
            id: "debug-host",
            name: "Debug Host",
            role: "Council Leader",
            isReady: true,
            hasVoted: false,
            isEliminated: false,
            vote_weight: 1.0,
            secretObjective: {
              description: "Debug objective",
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
      };
      setDebugSession(sampleSession);
    }
  }, [debugMode, currentSession]);

  // Fetch outcome when phase changes to results
  useEffect(() => {
    let ignore = false;
    let retries = 0;
    const maxRetries = 3;
    const retryDelay = 1500; // ms
  
    async function fetchOutcome() {
      if (!session?.session_id) return;
      try {
        const response = await fetch(
          `http://localhost:8000/api/games/${session.session_id}/scenario/outcome`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (!ignore) {
          if (data.outcome) {
            setOutcome(data.outcome);
            setCurrentSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                currentScenario: {
                  ...prev.currentScenario,
                  outcome: data.outcome,
                },
              };
            });
          } else {
            // If no outcome, try again if retries left
            if (retries < maxRetries) {
              retries++;
              setTimeout(fetchOutcome, retryDelay);
            } else {
              setOutcome(
                "The council's decision had significant consequences, but the details are still being processed."
              );
            }
          }
        }
      } catch (error) {
        if (!ignore && retries < maxRetries) {
          retries++;
          setTimeout(fetchOutcome, retryDelay);
        } else if (!ignore) {
          setOutcome(
            "The council's decision had significant consequences, but the details are still being processed."
          );
        }
      }
    }
  
    if (currentGamePhase === "results" && session?.session_id) {
      // If the outcome is already in the session, use it
      if (session.currentScenario?.outcome) {
        setOutcome(session.currentScenario.outcome);
      } else {
        setOutcome(""); // clear previous outcome
        fetchOutcome();
      }
    }
  
    return () => {
      ignore = true;
    };
  }, [
    currentGamePhase,
    session?.session_id,
    session?.currentScenario?.outcome,
    setCurrentSession,
  ]);  

  // Add a useEffect to fetch the game state directly when the component mounts
  useEffect(() => {
    if (session?.session_id && !session.currentScenario) {
      console.log("Game component mounted, fetching game state directly...");
      setIsLoading(true);
      setLoadingMessage("Stand By for New Council Motion...");
      gameService
        .getGameState(session.session_id)
        .then((gameState) => {
          console.log("Directly fetched game state on mount:", gameState);

          if (gameState.current_scenario) {
            console.log(
              "Found scenario in game state:",
              gameState.current_scenario
            );

            // Parse the scenario if it's a string
            let parsedScenario = gameState.current_scenario;
            if (typeof parsedScenario === "string") {
              try {
                parsedScenario = JSON.parse(parsedScenario);
                console.log(
                  "Successfully parsed scenario from string:",
                  parsedScenario
                );
              } catch (e) {
                console.error("Failed to parse current_scenario:", e);
                return;
              }
            }

            // Update the session directly with the scenario data
            setCurrentSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                currentScenario: {
                  title: parsedScenario.title
                    ? parsedScenario.title.replace(/^"|"$/g, "")
                    : "Untitled Scenario",
                  description:
                    parsedScenario.description || "No description available",
                  consequences:
                    parsedScenario.consequences || "No consequences specified.",
                  options: parsedScenario.options
                    ? parsedScenario.options.map((opt, index) => ({
                        id: opt.id || `option${index + 1}`,
                        text: opt.text || `Option ${index + 1}`,
                      }))
                    : [],
                },
              };
            });

            // Update the game phase to trigger the subscription in MultiplayerContext
            gameService
              .updateGamePhase(session.session_id, gameState.phase)
              .then(() => {
                console.log("Updated game phase to:", gameState.phase);
              })
              .catch((error) => {
                console.error("Error updating game phase:", error);
              });
          }
        })
        .catch((error) => {
          console.error("Error fetching game state on mount:", error);
        });
    }
  }, [session?.session_id, setCurrentSession]);

  // Add a useEffect to fetch voting options if we have a scenario but no options
  useEffect(() => {
    if (
      session?.session_id &&
      session.currentScenario &&
      (!session.currentScenario.options ||
        session.currentScenario.options.length === 0)
    ) {
      console.log("Fetching voting options for scenario...");

      // Call the backend API to generate voting options
      fetch(
        `http://localhost:8000/api/games/${session.session_id}/scenario/options`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Received voting options:", data);

          // Update the session with the new options
          setCurrentSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              currentScenario: {
                ...prev.currentScenario,
                options: data.options.map((text, index) => ({
                  id: `option${index + 1}`,
                  text: text.replace(/^"|"$/g, ""),
                })),
              },
            };
          });
        })
        .catch((error) => {
          console.error("Error fetching voting options:", error);
        });
    }
  }, [session?.session_id, session?.currentScenario, setCurrentSession]);

  // Add effect to fetch vote counts
  useEffect(() => {
    const fetchVoteCounts = async () => {
      if (
        !session?.session_id ||
        !session.currentScenario?.options ||
        currentGamePhase !== "results"
      ) {
        return;
      }

      try {
        // Fetch votes for each option
        const promises = session.currentScenario.options.map(
          async (_, index) => {
            const optionId = `option${index + 1}`;
            const response = await fetch(
              `http://localhost:8000/api/games/${session.session_id}/votes?round=${session.currentRound}&option=${optionId}`
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return { optionId, count: data.count };
          }
        );

        const results = await Promise.all(promises);
        const newVoteCounts = results.reduce((acc, { optionId, count }) => {
          acc[optionId] = count;
          return acc;
        }, {} as VoteCounts);

        setVoteCounts(newVoteCounts);
      } catch (error) {
        console.error("Error fetching vote counts:", error);
      }
    };

    fetchVoteCounts();
  }, [
    session?.session_id,
    session?.currentRound,
    session?.currentScenario?.options,
    currentGamePhase,
  ]);

  // Standardized loading state management
  useEffect(() => {
    const handleLoadingState = () => {
      // Clear loading state only when we have both the scenario and we're in the correct phase
      if (session?.currentScenario && gamePhase === "scenario") {
        setIsLoading(false);
        setLoadingMessage("");
        setIsPhaseTransition(false);
        return;
      }

      // Set loading state for phase transitions
      if (gamePhase === "scenario" && previousGamePhase === "results") {
        setIsLoading(true);
        setIsPhaseTransition(true);
        setLoadingMessage("The council session will now commence");
      } else if (gamePhase === "outcome") {
        setIsLoading(false);
        setLoadingMessage("");
        setIsPhaseTransition(false);
      }
    };

    handleLoadingState();
    setPreviousGamePhase(gamePhase as GamePhase);
  }, [gamePhase, session?.currentScenario]);

  // Handle next round with loading state
  const handleNextRound = async () => {
    if (!currentSession?.session_id) return;
  
    try {
      // Set loading state before starting next round
      setIsLoading(true);
      setIsPhaseTransition(true);
      setLoadingMessage("Stand By for New Council Motion...");
  
      // Broadcast loading state to all players
      await fetch(`http://localhost:8000/api/games/${currentSession.session_id}/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'loading_state',
          payload: {
            isLoading: true,
            isPhaseTransition: true,
            message: "Stand By for New Council Motion...",
            phase: "scenario" // Add a temporary phase to ensure all clients show loading
          }
        })
      });
  
      // Clear the current outcome before starting next round
      setOutcome("");
  
      // Call the backend to start the next round
      await nextRound();
    } catch (error) {
      console.error("Error starting next round:", error);
      // Clear loading state on error
      setIsLoading(false);
      setLoadingMessage("");
      setIsPhaseTransition(false);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (startButtonTimeout) {
        clearTimeout(startButtonTimeout);
      }
    };
  }, [startButtonTimeout]);

  // Handle WebSocket messages
  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === "game_started" || data.type === "scenario_update") {
        // Update the session with the new scenario
        setCurrentSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentScenario: data.payload.scenario,
            phase: data.payload.phase,
            currentRound: data.payload.current_round,
          };
        });

        // Only clear loading state if we're in the scenario phase
        if (data.payload.phase === "scenario") {
          setIsLoading(false);
          setLoadingMessage("");
          setIsPhaseTransition(false);
        }

        // Re-enable the start button after a delay
        const timeout = setTimeout(() => {
          setIsStartButtonDisabled(false);
        }, 2000);
        setStartButtonTimeout(timeout);
      } else if (data.type === "loading_state") {
        // Update loading state for all clients
        setIsLoading(data.payload.isLoading);
        setLoadingMessage(data.payload.message || "");
        setIsPhaseTransition(data.payload.isPhaseTransition || false);
        
        // If we're in a transition phase, clear the current scenario to force the loading screen
        if (data.payload.phase === "scenario") {
          setCurrentSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              currentScenario: null, // Clear scenario to trigger loading overlay
            };
          });
        }
      } else if (data.type === "phase_change") {
        // Handle phase changes
        if (
          data.payload.phase === "scenario" &&
          previousGamePhase === "results"
        ) {
          setIsLoading(true);
          setIsPhaseTransition(true);
          setLoadingMessage("The council session will now commence");
        }
        setPreviousGamePhase(data.payload.phase as GamePhase);
      } else if (data.type === "secret_incentive") {
        // Handle secret incentive updates
        if (data.payload.player_id === playerId) {
          setSelectedPlayerId(data.payload.player_id);
          setIncentiveText(data.payload.text);
          setIsIncentiveLoading(false);
        }
      }
    };

    // Only establish WebSocket connection if we have both session and player IDs
    if (session?.session_id && playerId) {
      const ws = new WebSocket(
        `ws://localhost:8000/ws/${session.session_id}/${playerId}`
      );
      ws.onmessage = handleWebSocketMessage;
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Re-enable the start button on error
        setIsStartButtonDisabled(false);
        setIsPhaseTransition(false);
      };
      ws.onclose = () => {
        console.log("WebSocket connection closed");
        // Re-enable the start button on connection close
        setIsStartButtonDisabled(false);
        setIsPhaseTransition(false);
      };

      return () => {
        ws.close();
      };
    }
  }, [
    session?.session_id,
    playerId,
    setCurrentSession,
    setIsLoading,
    setLoadingMessage,
    previousGamePhase,
  ]);

  // Update resources when outcome changes
  useEffect(() => {
    if (currentSession?.current_outcome?.resource_changes) {
      const changes = currentSession.current_outcome.resource_changes;
      setCurrentSession((prev) => ({
        ...prev,
        resources: {
          ...prev.resources,
          ...changes,
        },
      }));
    }
  }, [currentSession?.current_outcome?.resource_changes]);

  // Check for game over condition when resources change
  useEffect(() => {
    if (currentSession?.resources) {
      const depletedResources = currentSession.resources
        .filter((resource) => resource.value <= 0)
        .map((resource) => resource.type);

      if (depletedResources.length > 0) {
        setIsGameOver(true);
        setGameOverMessage(
          `Game Over! The following resources have been depleted: ${depletedResources.join(
            ", "
          )}`
        );
      }
    }
  }, [currentSession?.resources]);

  if (isGameOver) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-black to-gray-900 p-4 pb-16">
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Game Over</h2>
            <p className="text-white mb-6">{gameOverMessage}</p>
            <div className="space-y-4">
              <div className="glass-panel p-4">
                <h3 className="text-lg font-semibold text-neon-pink mb-2">
                  Final Resources
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {session?.resources.map((resource) => (
                    <div
                      key={resource.type}
                      className="flex items-center justify-between"
                    >
                      <span className="text-gray-300 capitalize">
                        {resource.type}:
                      </span>
                      <span
                        className={cn(
                          "font-bold",
                          resource.value <= 0
                            ? "text-red-500"
                            : "text-green-500"
                        )}
                      >
                        {resource.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-panel p-4">
                <h3 className="text-lg font-semibold text-neon-pink mb-2">
                  Final Round
                </h3>
                <p className="text-white">Round {session?.currentRound}</p>
              </div>
            </div>
            <div className="mt-6">
              <button
                onClick={handleLeave}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Leave Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <div>Error: No active session</div>;
  }

  const currentScenario = session.currentScenario;
  if (
    (currentGamePhase === "scenario" && !currentScenario) ||
    (isPhaseTransition && currentGamePhase !== "results")
  ) {
    // Only show the loading overlay during scenario phase or phase transitions NOT in results
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-black to-gray-900 p-4 pb-16">
        <LoadingOverlay
          message={
            isPhaseTransition
              ? "The council session will now commence"
              : "Stand By for New Council Motion..."
          }
        />
      </div>
    );
  }
  

  // Handle vote submission
  const handleVote = (optionId: string) => {
    if (currentSession) {
      castVote(optionId);
    } else {
      // Update debug session to show voted status
      const updatedSession = { ...debugSession };
      updatedSession.players = updatedSession.players.map((p) =>
        p.id === playerId ? { ...p, hasVoted: true } : p
      );
      setDebugSession(updatedSession);
    }
  };

  // Handle start game with debouncing
  const handleStartGame = async () => {
    if (isStartButtonDisabled) return;

    setIsStartButtonDisabled(true);
    setIsLoading(true);
    setLoadingMessage("Starting game...");

    try {
      await startGame();
    } catch (error) {
      console.error("Error starting game:", error);
      // Re-enable the start button after a delay on error
      const timeout = setTimeout(() => {
        setIsStartButtonDisabled(false);
      }, 2000); // 2 second delay before re-enabling
      setStartButtonTimeout(timeout);
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleLeave = () => {
    if (currentSession) {
      leaveSession();
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-gray-900 p-4 pb-16">
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      <Timer
        endTime={currentSession?.timer_end_time || null}
        isRunning={currentSession?.timer_running || false}
      />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold neon-glow">Project Oversight</h1>
            <p className="text-gray-400">
              Round {session.currentRound} •{" "}
              {currentGamePhase === "scenario" && isIncentiveLoading
                ? "Preparing Round..."
                : currentGamePhase === "scenario"
                ? "Council Decision"
                : currentGamePhase === "results"
                ? "Resolution"
                : "Lobby"}
            </p>
            {!currentSession && (
              <div className="text-neon-pink text-xs mt-1">Debug Mode</div>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartGame}
              disabled={isStartButtonDisabled}
              className={cn(
                "transition-colors duration-200",
                isStartButtonDisabled &&
                  "opacity-50 cursor-not-allowed bg-gray-700 hover:bg-gray-700"
              )}
            >
              {isStartButtonDisabled ? "Starting..." : "Start Game"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              Exit Game
            </Button>
          </div>
        </header>

        {/* Resources Dashboard */}
        <div className="glass-panel p-4 mb-8 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4">Resource Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {session.resources.map((resource) => (
              <ResourceBar
                key={resource.type}
                type={resource.type}
                value={resource.value}
                maxValue={resource.maxValue}
              />
            ))}
          </div>
        </div>

        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left column - Scenario */}
          <div className="lg:col-span-3">
            {(() => {
              console.log("Game Phase Debug:", {
                currentGamePhase,
                isScenarioPhase: currentGamePhase === "scenario",
                currentScenario: !!currentScenario,
              });
              return null;
            })()}
            {currentGamePhase === "scenario" && (
              <>
                {(() => {
                  console.log("Current Scenario Data:", {
                    title: currentScenario.title,
                    description: currentScenario.description,
                    round: session.currentRound,
                    consequences: currentScenario.consequences,
                    fullScenario: currentScenario,
                  });
                  return null;
                })()}
                <ScenarioDisplay
                  title={currentScenario.title}
                  description={currentScenario.description}
                  round={session.currentRound}
                  consequences={currentScenario.consequences}
                  options={currentScenario.options}
                  onVote={handleVote}
                  hasVoted={currentPlayer?.hasVoted}
                  roundStartTime={session.roundStartTime}
                  className="mb-8"
                />
              </>
            )}

            {currentGamePhase === "results" && (
              <div className="glass-panel p-6 animate-fade-in text-justify">
                <h2 className="text-2xl font-bold mb-4 neon-glow">Results</h2>

                {/* Voting Results Section - Show immediately */}
                {currentScenario?.options && (
                  <div className="mb-6 p-4 border border-neon-pink rounded-md bg-neon-pink bg-opacity-5">
                    <h3 className="font-semibold text-neon-pink mb-3">
                      Council Votes
                    </h3>
                    <div className="space-y-2">
                      {currentScenario.options.map((option, index) => {
                        const optionId = `option${index + 1}`;
                        const voteCount = voteCounts[optionId] || 0;

                        // Check if this is the winning option
                        const maxVotes = Math.max(...Object.values(voteCounts));
                        const isWinningOption =
                          voteCount === maxVotes && voteCount > 0;

                        return (
                          <div
                            key={optionId}
                            className={cn(
                              "flex justify-between items-center p-3 rounded",
                              isWinningOption &&
                                "bg-neon-pink bg-opacity-10 border border-neon-pink"
                            )}
                          >
                            <span
                              className={cn(
                                "text-sm flex-grow mr-4 text-white",
                                isWinningOption && "text-neon-pink"
                              )}
                            >
                              {option.text}
                            </span>
                            <span
                              className={cn(
                                "text-sm font-bold whitespace-nowrap",
                                isWinningOption
                                  ? "text-neon-pink"
                                  : "text-gray-200"
                              )}
                            >
                              {voteCount} {voteCount === 1 ? "vote" : "votes"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Outcome Section - Show loading state while outcome is being generated */}
                {!outcome ? (
                  <div className="glass-panel p-6 mb-6">
                    <h3 className="text-xl font-semibold mb-4">
                      Society is reacting to your decision...
                    </h3>
                    <p className="text-gray-300">
                      The consequences of the council's choice are being
                      determined...
                    </p>
                  </div>
                ) : (
                  <div className="glass-panel p-6 mb-6">
                    <h3 className="text-xl font-semibold mb-4">Outcome</h3>
                    <p className="text-gray-300">{outcome}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleNextRound} glow>
                    Next Round
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right column - Player List and Secret Incentive */}
          <div className="lg:col-span-1">
            <PlayerListPanel
              players={session.players}
              currentPlayerId={playerId}
            />
            {/* Show secret incentive only during scenario phase and when loading is complete */}
            {currentGamePhase === "scenario" &&
              !isIncentiveLoading &&
              playerId && (
                <SecretIncentiveNotification
                  playerId={playerId}
                  selectedPlayerId={selectedPlayerId}
                  incentiveText={incentiveText}
                />
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
