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

const Game = () => {
  const navigate = useNavigate();
  const {
    currentSession,
    playerId,
    gamePhase,
    castVote,
    nextRound,
    leaveSession,
  } = useMultiplayer();

  // Debug mode state to bypass session check for direct navigation
  const [debugSession, setDebugSession] = useState(null);
  const [debugMode] = useState(import.meta.env.DEV);

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

  if (!session) {
    return <div>Error: No active session</div>;
  }

  // Find current player
  const currentPlayer = session.players.find((p) => p.id === playerId);

  const currentScenario = session.currentScenario;
  if (!currentScenario) {
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
              <div className="glass-panel p-6 animate-fade-in">
                <h2 className="text-2xl font-bold mb-4 neon-glow">Results</h2>
                <p className="text-gray-300 mb-6">
                  The council has decided to allocate resources to decode the
                  signal without responding yet.
                </p>

                <div className="p-4 border border-neon-pink rounded-md bg-neon-pink bg-opacity-5 mb-6">
                  <h3 className="font-semibold text-neon-pink mb-2">Outcome</h3>
                  <p className="text-sm text-gray-300">
                    Your scientists make significant progress in decoding the
                    signal. It appears to contain complex schematics for what
                    could be an advanced propulsion system. Tech resources have
                    increased, but public rumors about the signal have caused a
                    minor decrease in happiness.
                  </p>
                </div>

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
