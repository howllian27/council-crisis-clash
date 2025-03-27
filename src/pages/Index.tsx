
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';

const Index = () => {
  const navigate = useNavigate();
  const [sessionCode, setSessionCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const handleCreateSession = () => {
    if (playerName.trim()) {
      navigate('/lobby');
    }
  };
  
  const handleJoinSession = () => {
    if (playerName.trim() && sessionCode.trim()) {
      navigate('/lobby');
    }
  };
  
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-black to-gray-900 p-4">
      <div className="w-full max-w-lg mx-auto text-center mb-8 animate-fade-in">
        <h1 className="text-5xl font-bold mb-2 text-white">
          Project <span className="text-neon-pink neon-glow">Oversight</span>
        </h1>
        <p className="text-gray-400 text-lg">
          A multiplayer crisis management game powered by AI
        </p>
      </div>
      
      <div className="w-full max-w-md glass-panel p-8 animate-slide-up">
        <div className="space-y-6">
          <div>
            <label htmlFor="playerName" className="block text-sm font-medium mb-2">
              Your Council Title
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Council Director"
              className="w-full p-3 bg-secondary text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-neon-pink"
            />
          </div>
          
          <div className="flex flex-col gap-4">
            <Button
              glow
              fullWidth
              onClick={() => {
                setIsCreating(true);
                setIsJoining(false);
              }}
            >
              Create New Session
            </Button>
            
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setIsJoining(true);
                setIsCreating(false);
              }}
            >
              Join Existing Session
            </Button>
          </div>
          
          {isCreating && (
            <div className="animate-fade-in space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a new game session and invite up to 3 other council members to join.
              </p>
              <Button fullWidth onClick={handleCreateSession}>Create Session</Button>
            </div>
          )}
          
          {isJoining && (
            <div className="animate-fade-in space-y-4">
              <div>
                <label htmlFor="sessionCode" className="block text-sm font-medium mb-2">
                  Session Code
                </label>
                <input
                  id="sessionCode"
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full p-3 bg-secondary text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-neon-pink"
                />
              </div>
              <Button fullWidth onClick={handleJoinSession}>Join Session</Button>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-12 text-center animate-fade-in">
        <p className="text-muted-foreground text-sm mb-2">
          Made with minimalist design principles
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="link" size="sm">How to Play</Button>
          <Button variant="link" size="sm">About</Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
