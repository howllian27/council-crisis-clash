
import React, { useState, useEffect } from 'react';
import ResourceBar from '../components/ResourceBar';
import ScenarioDisplay from '../components/ScenarioDisplay';
import VotingPanel from '../components/VotingPanel';
import Button from '../components/Button';
import { cn } from '../lib/utils';

interface Resource {
  type: 'tech' | 'manpower' | 'economy' | 'happiness' | 'trust';
  value: number;
  maxValue: number;
}

interface Player {
  id: string;
  name: string;
  isReady: boolean;
  hasVoted: boolean;
  isEliminated: boolean;
}

interface GameScenario {
  title: string;
  description: string;
  consequences: string;
  options: { id: string; text: string }[];
}

const Game = () => {
  const [round, setRound] = useState(1);
  const [gamePhase, setGamePhase] = useState<'scenario' | 'voting' | 'results'>('scenario');
  const [timeRemaining, setTimeRemaining] = useState(60);
  
  // Mock game resources
  const [resources, setResources] = useState<Resource[]>([
    { type: 'tech', value: 75, maxValue: 100 },
    { type: 'manpower', value: 60, maxValue: 100 },
    { type: 'economy', value: 80, maxValue: 100 },
    { type: 'happiness', value: 90, maxValue: 100 },
    { type: 'trust', value: 70, maxValue: 100 },
  ]);
  
  // Mock players
  const [players, setPlayers] = useState<Player[]>([
    { id: 'player1', name: 'Council Leader', isReady: true, hasVoted: false, isEliminated: false },
    { id: 'player2', name: 'Tech Minister', isReady: true, hasVoted: false, isEliminated: false },
    { id: 'player3', name: 'Economy Director', isReady: true, hasVoted: false, isEliminated: false },
    { id: 'player4', name: 'Security Chief', isReady: true, hasVoted: false, isEliminated: false },
  ]);
  
  // Mock scenario
  const [currentScenario, setCurrentScenario] = useState<GameScenario>({
    title: "Mysterious Signal From Deep Space",
    description: "Our deep space monitoring stations have detected an unusual signal originating from beyond our solar system. Initial analysis suggests it could be artificial in nature. The signal appears to contain complex mathematical sequences that our scientists believe may be an attempt at communication. However, there is no consensus on whether we should respond or what the message might contain.",
    consequences: "How we handle this situation could dramatically affect our technological development and potentially our safety if the signal represents a threat.",
    options: [
      { id: 'option1', text: "Allocate resources to decode the signal but do not respond yet" },
      { id: 'option2', text: "Immediately broadcast a response using similar mathematical principles" },
      { id: 'option3', text: "Ignore the signal and increase our defensive capabilities" },
      { id: 'option4', text: "Share the discovery with the public and crowdsource analysis" }
    ]
  });
  
  // Mock secret objective
  const [secretObjective, setSecretObjective] = useState({
    description: "Ensure the 'trust' resource stays above 60% for the next 3 rounds",
    isCompleted: false,
  });
  
  useEffect(() => {
    // Simulate game phase progression
    const timer = setTimeout(() => {
      if (gamePhase === 'scenario') {
        setGamePhase('voting');
      } else if (gamePhase === 'voting') {
        setGamePhase('results');
      }
    }, 5000); // Short timeout for demo
    
    return () => clearTimeout(timer);
  }, [gamePhase]);
  
  const handleVote = (optionId: string) => {
    console.log('Voted for option:', optionId);
    // In a real implementation, this would send the vote to the server
    
    // Update player vote status for demo
    setPlayers(players.map(player => 
      player.id === 'player1' ? { ...player, hasVoted: true } : player
    ));
  };
  
  const handleNextRound = () => {
    setRound(round + 1);
    setGamePhase('scenario');
    
    // Reset votes
    setPlayers(players.map(player => ({ ...player, hasVoted: false })));
    
    // Update resources based on previous decision (simulated)
    setResources(resources.map(resource => ({
      ...resource,
      value: Math.min(Math.max(resource.value + Math.floor(Math.random() * 20) - 10, 0), 100)
    })));
  };
  
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-gray-900 p-4 pb-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold neon-glow">Project Oversight</h1>
            <p className="text-gray-400">Round {round} • {gamePhase === 'scenario' ? 'New Crisis' : gamePhase === 'voting' ? 'Council Vote' : 'Resolution'}</p>
          </div>
          
          <div className="flex gap-4">
            <Button variant="outline" size="sm">Game Rules</Button>
            <Button variant="ghost" size="sm">Exit Game</Button>
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
                round={round}
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
            
            <div className="glass-panel p-4 animate-fade-in border border-neon-pink">
              <h2 className="text-lg font-semibold mb-2 text-neon-pink">Secret Objective</h2>
              <p className="text-sm text-gray-300 mb-3">
                {secretObjective.description}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Progress</span>
                <span>1/3 rounds</span>
              </div>
              <div className="progress-bar mt-1">
                <div className="progress-bar-fill bg-neon-pink" style={{ width: "33%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
