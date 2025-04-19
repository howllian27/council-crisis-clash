import React, { useEffect, useState, useRef } from "react";
import ResourceBar from "../components/ResourceBar";
import ScenarioDisplay from "../components/ScenarioDisplay";
import Button from "../components/Button";
import { cn } from "../lib/utils";
import { useMultiplayer } from "../contexts/MultiplayerContext";
import { useNavigate } from "react-router-dom";
import LoadingOverlay from "../components/LoadingOverlay";
import Timer from "../components/Timer";
import PlayerListPanel from "../components/PlayerListPanel";
import SecretIncentiveNotification from "../components/SecretIncentiveNotification";

interface VoteCounts { [key: string]: number }
interface IncentiveData { player_id: string; text: string }
type ResourceType = "tech" | "manpower" | "economy" | "happiness" | "trust";

const Game: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentSession: session,
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
  } = useMultiplayer();

  const phase = session?.phase ?? gamePhase;
  const round = session?.currentRound ?? 0;
  const scen = session?.currentScenario ?? null;
  const player = session?.players?.find(p => p.id === playerId);

  const [outcome, setOutcome] = useState<string>("");
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [selectedPlayerId, setSelect] = useState<string | null>(null);
  const [incentiveText, setIncentive] = useState<string>("");
  const [isIncentiveLoading, setIncL] = useState<boolean>(false);
  const [polledRound, setPolled] = useState<number | null>(null);
  const [loadedScenarioRound, setLoadedScenarioRound] = useState<number | null>(null);

  const prevPhase = useRef<string>();
  const prevRound = useRef<number>();

  // Manage overlay for scenario loading
  useEffect(() => {
    const phaseChanged = prevPhase.current !== phase;
    const roundChanged = prevRound.current !== round;

    if (phaseChanged && phase === "scenario") {
      setPolled(null);
      setSelect(null);
      setIncentive("");
      setLoadedScenarioRound(null);
    }

    if (phase === "scenario" && (phaseChanged || roundChanged) && !scen?.options?.length) {
      setIsLoading(true);
      setLoadingMessage("The council session will now begin …");
    }
    prevPhase.current = phase;
    prevRound.current = round;
  }, [phase, round, scen?.options]);

  useEffect(() => {
    if (phase === "scenario" && scen?.options?.length && loadedScenarioRound !== round) {
      setIsLoading(false);
      setLoadingMessage("");
      setLoadedScenarioRound(round);
    }
  }, [phase, round, scen?.options, loadedScenarioRound]);

  // Secret incentive polling
  useEffect(() => {
    if (phase !== "scenario" || !session?.session_id) return;
    if (polledRound === round) return;

    setIncL(true);
    (async () => {
      for (let i = 0; i < 5; i++) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/games/${session.session_id}/secret_incentive?player_id=${playerId}&round=${round}`
          );
          const data: Partial<IncentiveData> = await res.json();
          if (data.player_id && data.text) {
            setSelect(data.player_id);
            setIncentive(data.text);
            break;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 1500));
      }
      setIncL(false);
      setPolled(round);
    })();
  }, [phase, round, session?.session_id, playerId, polledRound]);

  // Outcome placeholder + fetch
  const outcomeRound = useRef<number>(0);
  useEffect(() => {
    if (phase !== "results" || outcomeRound.current === round || !session?.session_id) return;
    setOutcome("Society is reacting to the decision you made...");
    fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/games/${session.session_id}/scenario/outcome`,
      { method: "POST" }
    )
      .then(r => r.json())
      .then(d => setOutcome(d.outcome))
      .catch(() => setOutcome("Outcome unavailable"));
    outcomeRound.current = round;
  }, [phase, round, session?.session_id]);

  // Vote counts
  useEffect(() => {
    if (phase !== "results" || !scen?.options?.length || !session?.session_id) return;
    Promise.all(
      scen.options.map((_, i) =>
        fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/games/${session.session_id}/votes?round=${round}&option=option${i+1}`
        )
          .then(r => r.json())
          .then(d => [`option${i+1}`, d.count ?? 0] as const)
          .catch(() => [`option${i+1}`, 0] as const)
      )
    ).then(arr => setVoteCounts(Object.fromEntries(arr)));
  }, [phase, round, scen?.options, session?.session_id]);

  // WebSocket updates
  useEffect(() => {
    const ws = new WebSocket("wss://45d3-185-25-195-104.ngrok-free.app/ws");
    ws.onmessage = ev => {
      const d = JSON.parse(ev.data);
      if (d.type === "scenario_update") {
        setOutcome("");
        setCurrentSession(prev => prev ? { ...prev, currentScenario: d.payload.scenario } : prev);
      }
    };
    return () => ws.close();
  }, [setCurrentSession]);

  const handleVote = (id: string) => castVote(id);
  const handleNext = async () => {
    setOutcome("");
    setLoadedScenarioRound(null);
    setIsLoading(true);
    setLoadingMessage("Generating scenario …");
    setCurrentSession(prev => prev ? { ...prev, currentScenario: null } : prev);
    await nextRound();
  };
  const handleLeave = () => { leaveSession(); navigate("/"); };

  if (!session) return <div>No session</div>;
  if (phase === "scenario" && loadedScenarioRound !== round) return null;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-gray-900 p-4 pb-16">
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      <Timer endTime={session.timer_end_time} isRunning={session.timer_running} />
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold neon-glow">Project Oversight</h1>
            <p className="text-gray-400">Round {round} • {phase === "scenario" ? "Council Decision" : phase === "results" ? "Resolution" : "Lobby"}</p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" size="sm">Game Rules</Button>
            <Button variant="ghost" size="sm" onClick={handleLeave}>Exit Game</Button>
          </div>
        </header>

        <div className="glass-panel p-4 mb-8">
          <h2 className="text-lg font-semibold mb-4">Resource Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {session.resources.map(r => (
              <ResourceBar key={r.type} type={r.type as ResourceType} value={r.value} maxValue={r.maxValue} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {phase === "scenario" && scen && (
              <ScenarioDisplay
                title={scen.title}
                description={scen.description}
                consequences={scen.consequences}
                round={round}
                options={scen.options}
                onVote={handleVote}
                hasVoted={player?.hasVoted}
                roundStartTime={session.roundStartTime}
              />
            )}
            {phase === "results" && scen && (
              <div className="glass-panel p-6 animate-fade-in text-justify">
                <h2 className="text-2xl font-bold mb-4 neon-glow">Results</h2>
                <div className="mb-6 p-4 border border-neon-pink rounded bg-neon-pink/10">
                  <h3 className="font-semibold text-neon-pink mb-3">Council Votes</h3>
                  <div className="space-y-2">
                    {scen.options.map((o, i) => {
                      const id = `option${i+1}`;
                      const c = voteCounts[id] || 0;
                      const max = Math.max(0, ...Object.values(voteCounts));
                      const win = c === max && c > 0;
                      return (
                        <div key={id} className={cn("flex justify-between items-center p-3 rounded", win && "bg-neon-pink/20 border border-neon-pink")}>                        <span className={cn("flex-grow text-sm mr-4", win ? "text-neon-pink" : "text-gray-200")}>{o.text}</span>
                          <span className={cn("font-bold text-sm", win ? "text-neon-pink" : "text-gray-200")}>{c} {c === 1 ? "vote" : "votes"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-gray-300 mb-6">{outcome}</p>
                <div className="flex justify-end">
                  <Button glow onClick={handleNext}>Next Round</Button>
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-1 space-y-6">
            <PlayerListPanel players={session.players} currentPlayerId={playerId} />
            {phase === "scenario" && !isIncentiveLoading && playerId && (
              <SecretIncentiveNotification playerId={playerId} selectedPlayerId={selectedPlayerId} incentiveText={incentiveText} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;