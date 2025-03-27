
import React, { useEffect, useState } from 'react';
import ResourceBar from '../components/ResourceBar';
import ScenarioDisplay from '../components/ScenarioDisplay';
import VotingPanel from '../components/VotingPanel';
import Button from '../components/Button';
import { cn } from '../lib/utils';
import { useMultiplayer } from '../contexts/MultiplayerContext';
import { useNavigate } from 'react-router-dom';
import { createGameSession, getSampleScenario } from '../services/gameSessionService';

const Game = () => {
  const navigate = useNavigate();
  const { 
    currentSession, 
    playerId,
    gamePhase, 
    castVote, 
    nextRound,
    leaveSession
  } = useMultiplayer();
  
  // Debug mode state to bypass session check for direct navigation
  const [debugSession, setDebugSession] = useState(null);
  
  // Initialize a debug session if navigating directly to /game
  useEffect(() => {
    if (!currentSession && !debugSession) {
      // Check if we're in development mode (for debugging only)
      if (import.meta.env.DEV) {
        console.log("Debug mode: Creating sample session for direct game view");
        // Create a sample session for debugging purposes
        const sampleSession = createGameSession("Debug Player");
        sampleSession.currentScenario = getSampleScenario();
        sampleSession.status = 'in-progress';
        setDebugSession(sampleSession);
      } else {
        // In production, redirect to home
        navigate('/');
      }
    }
  }, [currentSession, navigate, debugSession]);
  
  // Use currentSession if available, otherwise use debugSession
  const activeSession = currentSession || debugSession;
  
  if (!activeSession) {
    return <div>Loading...</div>;
  }
  
  const { 
    players, 
    resources, 
    currentRound, 
    currentScenario 
  } = activeSession;
  
  // Find current player
  const currentPlayer = players.find(p => p.id === playerId) || players[0]; // Fallback to first player in debug mode
  const secretObjective = currentPlayer?.secretObjective;
  
  if (!currentScenario) {
    return <div>Error: No scenario available</div>;
  }
  
  const handleVote = (optionId: string) => {
    if (currentSession) {
      castVote(optionId);
    } else {
      console.log("Debug mode: Vote cast for", optionId);
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
      setDebugSession(updatedSession);
    }
  };
  
  const handleLeave = () => {
    if (currentSession) {
      leaveSession();
    } else {
      navigate('/');
    }
  };
  
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-gray-900 p-4 pb-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold neon-glow">Project Oversight</h1>
            <p className="text-gray-400">Round {currentRound} • {gamePhase === 'scenario' ? 'New Crisis' : gamePhase === 'voting' ? 'Council Vote' : 'Resolution'}</p>
            {!currentSession && <div className="text-neon-pink text-xs mt-1">Debug Mode</div>}
          </div>
          
          <div className="flex gap-4">
            <Button variant="outline" size="sm">Game Rules</Button>
            <Button variant="ghost" size="sm" onClick={handleLeave}>Exit Game</Button>
          </div>
        </header>
        
        {/* Resources Dashboard */}
        <div className="glass-panel p-4 mb-8 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4">Resource Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {resources.map(resource => (
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
            {gamePhase === 'scenario' && (
              <ScenarioDisplay
                title={currentScenario.title}
                description={currentScenario.description}
                round={currentRound}
                consequences={currentScenario.consequences}
              />
            )}
            
            {gamePhase === 'voting' && (
              <VotingPanel
                options={currentScenario.options}
                timeRemaining={60}
                onVote={handleVote}
              />
            )}
            
            {gamePhase === 'results' && (
              <div className="glass-panel p-6 animate-fade-in">
                <h2 className="text-2xl font-bold mb-4 neon-glow">Results</h2>
                <p className="text-gray-300 mb-6">
                  The council has decided to allocate resources to decode the signal without responding yet.
                </p>
                
                <div className="p-4 border border-neon-pink rounded-md bg-neon-pink bg-opacity-5 mb-6">
                  <h3 className="font-semibold text-neon-pink mb-2">Outcome</h3>
                  <p className="text-sm text-gray-300">
                    Your scientists make significant progress in decoding the signal. It appears to contain complex schematics for what could be an advanced propulsion system. Tech resources have increased, but public rumors about the signal have caused a minor decrease in happiness.
                  </p>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handleNextRound} glow>Next Round</Button>
                </div>
              </div>
            )}
          </div>
          
          {/* Right column - Players and Secret Objective */}
          <div className="space-y-6">
            <div className="glass-panel p-4 animate-fade-in">
              <h2 className="text-lg font-semibold mb-4">Council Members</h2>
              <div className="space-y-3">
                {players.map(player => (
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
                      <span className={player.isEliminated ? "line-through" : ""}>
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
            
            {secretObjective && (
              <div className="glass-panel p-4 animate-fade-in border border-neon-pink">
                <h2 className="text-lg font-semibold mb-2 text-neon-pink">Secret Objective</h2>
                <p className="text-sm text-gray-300 mb-3">
                  {secretObjective.description}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Progress</span>
                  <span>{secretObjective.progress}/{secretObjective.target} rounds</span>
                </div>
                <div className="progress-bar mt-1">
                  <div 
                    className="progress-bar-fill bg-neon-pink" 
                    style={{ width: `${(secretObjective.progress / secretObjective.target) * 100}%` }} 
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
