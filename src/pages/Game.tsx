
import React, { useEffect } from 'react';
import ResourceBar from '../components/ResourceBar';
import ScenarioDisplay from '../components/ScenarioDisplay';
import VotingPanel from '../components/VotingPanel';
import Button from '../components/Button';
import { cn } from '../lib/utils';
import { useMultiplayer } from '../contexts/MultiplayerContext';
import { useNavigate } from 'react-router-dom';

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
  
  // Redirect if no session
  useEffect(() => {
    if (!currentSession) {
      navigate('/');
    }
  }, [currentSession, navigate]);
  
  if (!currentSession) {
    return <div>Loading...</div>;
  }
  
  const { 
    players, 
    resources, 
    currentRound, 
    currentScenario 
  } = currentSession;
  
  // Find current player
  const currentPlayer = players.find(p => p.id === playerId);
  const secretObjective = currentPlayer?.secretObjective;
  
  if (!currentScenario) {
    return <div>Error: No scenario available</div>;
  }
  
  const handleVote = (optionId: string) => {
    castVote(optionId);
  };
  
  const handleNextRound = () => {
    nextRound();
  };
  
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-gray-900 p-4 pb-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold neon-glow">Project Oversight</h1>
            <p className="text-gray-400">Round {currentRound} • {gamePhase === 'scenario' ? 'New Crisis' : gamePhase === 'voting' ? 'Council Vote' : 'Resolution'}</p>
          </div>
          
          <div className="flex gap-4">
            <Button variant="outline" size="sm">Game Rules</Button>
            <Button variant="ghost" size="sm" onClick={leaveSession}>Exit Game</Button>
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
