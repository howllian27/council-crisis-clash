
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { Play } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  
  const handleStartSession = () => {
    // Basic validation
    if (playerName.trim()) {
      setIsStarting(true);
      
      // Simulate a brief loading period before navigating
      setTimeout(() => {
        navigate('/lobby');
      }, 500);
    } else {
      // Optional: Could add a toast or error state here
      alert('Please enter your council title');
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
          
          <Button
            fullWidth
            glow={!!playerName}
            onClick={handleStartSession}
            disabled={!playerName}
          >
            <Play className="mr-2" />
            {isStarting ? 'Initializing Session...' : 'Start New Session'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;

