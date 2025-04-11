import React, { useEffect, useState } from "react";
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

// Define interface for vote counts
interface VoteCounts {
  [key: string]: number;
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
  } = useMultiplayer();

  // Debug mode state to bypass session check for direct navigation
  const [debugSession, setDebugSession] = useState(null);
  const [debugMode] = useState(import.meta.env.DEV);
  const [outcome, setOutcome] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});

  // Add debug logging for gamePhase
  console.log("Game Phase Value:", {
    gamePhase,
    currentGamePhase: gamePhase || "scenario",
  });

  // Set game phase based on session state
  const currentGamePhase = gamePhase || "scenario";

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

  // Use either the current session or debug session
  const session = currentSession || debugSession;

  // Fetch outcome when phase changes to results
  useEffect(() => {
    if (currentGamePhase === "results" && session?.session_id) {
      console.log("Results phase detected, checking for outcome...");

      // Check if the outcome is already in the session
      if (session.currentScenario?.outcome) {
        console.log(
          "Using outcome from session:",
          session.currentScenario.outcome
        );
        setOutcome(session.currentScenario.outcome);
        return;
      }

      console.log("No outcome in session, fetching from API...");
      setIsLoading(true);
      setLoadingMessage("Generating outcome...");

      // Call the backend API to generate the outcome
      fetch(
        `http://localhost:8000/api/games/${session.session_id}/scenario/outcome`,
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
          console.log("Received outcome:", data);
          setOutcome(data.outcome);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching outcome:", error);
          setOutcome(
            "The council's decision had significant consequences, but the details are still being processed."
          );
          setIsLoading(false);
        });
    }
  }, [
    currentGamePhase,
    session?.session_id,
    session?.currentScenario?.outcome,
  ]);

  // Add a useEffect to fetch the game state directly when the component mounts
  useEffect(() => {
    if (session?.session_id && !session.currentScenario) {
      console.log("Game component mounted, fetching game state directly...");
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

  if (!session) {
    return <div>Error: No active session</div>;
  }

  // Find current player
  const currentPlayer = session.players.find((p) => p.id === playerId);

  // Debug logging for session data
  console.log("Session Data:", {
    sessionId: session.session_id,
    phase: session.phase,
    currentScenario: session.currentScenario,
    hasCurrentScenario: !!session.currentScenario,
  });

  const currentScenario = session.currentScenario;
  if (!currentScenario) {
    console.error("No scenario available in session:", session);
    console.error("Session phase:", session.phase);
    console.error("Session currentRound:", session.currentRound);

    // Try to fetch the game state directly
    if (session.session_id) {
      console.log("Attempting to fetch game state directly...");
      gameService
        .getGameState(session.session_id)
        .then((gameState) => {
          console.log("Directly fetched game state:", gameState);
          console.log("Game state phase:", gameState.phase);
          console.log(
            "Game state current_scenario:",
            gameState.current_scenario
          );

          // If we have a scenario in the game state but not in the session,
          // update the session directly
          if (gameState.current_scenario && !session.currentScenario) {
            console.log(
              "Found scenario in game state but not in session, updating session directly"
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
          }
        })
        .catch((error) => {
          console.error("Error fetching game state directly:", error);
        });
    }

    return <div>Error: No scenario available</div>;
  }

  // Debug logging for scenario data
  console.log("Current Scenario Data:", {
    title: currentScenario.title,
    description: currentScenario.description,
    consequences: currentScenario.consequences,
    options: currentScenario.options,
    round: session.currentRound,
    phase: currentGamePhase,
  });

  // Handle vote submission
  const handleVote = (optionId: string) => {
    if (currentSession) {
      castVote(optionId);
    } else {
      console.log("Debug mode: Vote cast for", optionId);
      // Update debug session to show voted status
      const updatedSession = { ...debugSession };
      updatedSession.players = updatedSession.players.map((p) =>
        p.id === playerId ? { ...p, hasVoted: true } : p
      );
      setDebugSession(updatedSession);
    }
  };

  const handleNextRound = async () => {
    if (!session?.session_id) return;

    setIsLoading(true);
    setLoadingMessage("Starting next round...");

    try {
      // Call the backend to start the next round
      await nextRound();

      // Clear the current scenario and outcome to prevent showing old data
      setCurrentSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentScenario: null,
        };
      });
      setOutcome("");

      // Poll for the new scenario
      let attempts = 0;
      const maxAttempts = 10;
      const pollInterval = 1000; // 1 second

      const pollForNewScenario = async () => {
        if (attempts >= maxAttempts) {
          throw new Error("Timeout waiting for new scenario");
        }

        const response = await fetch(
          `http://localhost:8000/api/games/${session.session_id}/scenario`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.scenario && data.options) {
          // New scenario is ready
          setOutcome(null);
          setIsLoading(false);
          return;
        }

        // Scenario not ready yet, try again
        attempts++;
        setTimeout(pollForNewScenario, pollInterval);
      };

      await pollForNewScenario();
    } catch (error) {
      console.error("Error starting next round:", error);
      setIsLoading(false);
      // You might want to show an error message to the user here
    }
  };

  const handleLeave = () => {
    if (currentSession) {
      leaveSession();
    } else {
      navigate("/");
    }
  };

  // Define the player type
  interface GamePlayer {
    id: string;
    name: string;
    vote?: string;
    hasVoted: boolean;
  }

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
              {currentGamePhase === "scenario"
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
            <Button variant="outline" size="sm">
              Game Rules
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

                {/* Voting Results Section */}
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

                {/* Outcome Section */}
                <p className="text-gray-300 mb-6">
                  {outcome || "Processing the council's decision..."}
                </p>

                <div className="flex justify-end">
                  <Button onClick={handleNextRound} glow>
                    Next Round
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
