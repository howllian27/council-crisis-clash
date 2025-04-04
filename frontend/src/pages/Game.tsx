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
        })
        .catch((error) => {
          console.error("Error fetching outcome:", error);
          setOutcome(
            "The council's decision had significant consequences, but the details are still being processed."
          );
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

  const handleNextRound = () => {
    if (currentSession) {
      nextRound();
    } else {
      console.log("Debug mode: Moving to next round");
      const updatedSession = { ...debugSession };
      updatedSession.currentRound = updatedSession.currentRound + 1;
      updatedSession.currentScenario = getSampleScenario();
      // Reset voting status for all players
      updatedSession.players = updatedSession.players.map((p) => ({
        ...p,
        hasVoted: false,
      }));
      setDebugSession(updatedSession);
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
                <p className="text-gray-300 mb-6">
                  {outcome || "Processing the council's decision..."}
                </p>
                {/* 
                <div className="p-4 border border-neon-pink rounded-md bg-neon-pink bg-opacity-5 mb-6">
                  <h3 className="font-semibold text-neon-pink mb-2">Outcome</h3>
                  <p className="text-sm text-gray-300 text-justify">
                    {outcome ||
                      "The council's decision had significant consequences, but the details are still being processed."}
                  </p>
                </div> */}

                <div className="flex justify-end">
                  <Button onClick={handleNextRound} glow>
                    Next Round
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right column - Players and Secret Objective */}
          <div className="space-y-6">
            <div className="glass-panel p-4 animate-fade-in">
              <h2 className="text-lg font-semibold mb-4">Council Members</h2>
              <div className="space-y-3">
                {session.players.map((player) => (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded",
                      player.isEliminated ? "opacity-50" : "",
                      player.hasVoted ? "bg-secondary" : "bg-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                        {player.name.charAt(0)}
                      </div>
                      <span
                        className={player.isEliminated ? "line-through" : ""}
                      >
                        {player.name}
                      </span>
                    </div>

                    <div className="flex items-center">
                      {player.hasVoted && (
                        <span className="text-xs px-2 py-1 bg-neon-pink bg-opacity-20 text-neon-pink rounded-full">
                          Voted
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {currentPlayer?.secretObjective && (
              <div className="glass-panel p-4 animate-fade-in border border-neon-pink">
                <h2 className="text-lg font-semibold mb-2 text-neon-pink">
                  Secret Objective
                </h2>
                <p className="text-sm text-gray-300 mb-3">
                  {currentPlayer.secretObjective.description}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Progress</span>
                  <span>
                    {currentPlayer.secretObjective.progress}/
                    {currentPlayer.secretObjective.target} rounds
                  </span>
                </div>
                <div className="progress-bar mt-1">
                  <div
                    className="progress-bar-fill bg-neon-pink"
                    style={{
                      width: `${
                        (currentPlayer.secretObjective.progress /
                          currentPlayer.secretObjective.target) *
                        100
                      }%`,
                    }}
                  />
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
