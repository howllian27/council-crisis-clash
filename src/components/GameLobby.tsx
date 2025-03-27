
import React, { useState } from 'react';
import Button from './Button';
import { useNavigate } from 'react-router-dom';

interface PlayerSlot {
  id: string | null;
  name: string | null;
  ready: boolean;
  isHost: boolean;
}

const GameLobby = () => {
  const navigate = useNavigate();
  const [sessionCode, setSessionCode] = useState('XYZABC');
  const [playerName, setPlayerName] = useState('');
  const [isReady, setIsReady] = useState(false);
  
  // Mock data for player slots in the lobby
  const [players, setPlayers] = useState<PlayerSlot[]>([
    { id: 'player1', name: 'Council Leader', ready: true, isHost: true },
    { id: 'player2', name: 'Tech Minister', ready: false, isHost: false },
    { id: null, name: null, ready: false, isHost: false },
    { id: null, name: null, ready: false, isHost: false },
  ]);
  
  const handleStartGame = () => {
    // In a real implementation, validate all players are ready
    navigate('/game');
  };
  
  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    // Would show a toast here in a real implementation
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto p-6 glass-panel animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <h1 className="text-3xl font-bold neon-glow mb-4 md:mb-0">Game Lobby</h1>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-md">
            <span className="text-sm text-muted-foreground">Session Code:</span>
            <span className="font-mono font-bold text-neon-pink">{sessionCode}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyCode}>
            Copy Code
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {players.map((player, index) => (
          <div 
            key={index} 
            className={cn(
              "p-4 rounded-lg border transition-all-200 border-border relative",
              player.id ? "bg-secondary" : "bg-secondary bg-opacity-30 border-dashed"
            )}
          >
            {player.isHost && (
              <div className="absolute -top-2 -right-2 bg-neon-pink text-xs px-2 py-1 rounded-full text-white">
                Host
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl">
                {player.id ? player.name?.charAt(0) : '?'}
              </div>
              <div className="flex-1">
                <h3 className="font-bold">
                  {player.name || 'Waiting for player...'}
                </h3>
                <div className="flex items-center mt-1">
                  <div className={cn(
                    "w-2 h-2 rounded-full mr-2",
                    player.ready ? "bg-green-500" : "bg-gray-400"
                  )} />
                  <span className="text-sm text-muted-foreground">
                    {player.ready ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div 
            className={cn(
              "w-4 h-4 rounded-full cursor-pointer border",
              isReady ? "bg-green-500 border-green-600" : "bg-transparent border-gray-400"
            )}
            onClick={() => setIsReady(!isReady)}
          />
          <span>Mark as ready</span>
        </div>
        
        <div className="flex gap-4">
          <Button variant="outline">Leave Game</Button>
          <Button 
            glow={players.every(p => p.id === null || p.ready)}
            disabled={!players.every(p => p.id === null || p.ready)}
            onClick={handleStartGame}
          >
            Start Game
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GameLobby;

function cn(...classes: any[]): string {
  return classes.filter(Boolean).join(' ');
}
