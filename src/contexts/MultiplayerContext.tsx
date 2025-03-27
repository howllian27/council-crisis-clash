
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { 
  GameSession, 
  Player, 
  GamePhase, 
  createGameSession,
  getSampleScenario,
  generateSecretObjective
} from '../services/gameSessionService';
import { v4 as uuidv4 } from 'uuid';

interface MultiplayerContextType {
  createSession: (playerName: string) => void;
  joinSession: (sessionCode: string, playerName: string) => void;
  leaveSession: () => void;
  startGame: () => void;
  endGame: () => void;
  setPlayerReady: (isReady: boolean) => void;
  castVote: (optionId: string) => void;
  nextRound: () => void;
  isHost: boolean;
  playerId: string | null;
  playerName: string | null;
  currentSession: GameSession | null;
  gamePhase: GamePhase;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

const MultiplayerContext = createContext<MultiplayerContextType | undefined>(undefined);

export const MultiplayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('scenario');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const isHost = !!currentSession && !!playerId && currentSession.hostId === playerId;

  // Create a new game session
  const createSession = (name: string) => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would call your backend API
      // For now, we'll simulate it with local state
      const newPlayerId = uuidv4();
      setPlayerId(newPlayerId);
      setPlayerName(name);
      
      // Create a new session with the player as host
      const session = createGameSession(name);
      session.players[0].id = newPlayerId; // Set the host ID
      
      // Update local state
      setCurrentSession(session);
      setIsConnected(true);
      setIsLoading(false);
      
      // Navigate to the lobby
      navigate('/lobby');
      
      toast({
        title: "Session Created",
        description: `Your session code is ${session.code}`,
      });
    } catch (err) {
      setError("Failed to create session. Please try again.");
      setIsLoading(false);
    }
  };

  // Join an existing game session
  const joinSession = (sessionCode: string, name: string) => {
    try {
      setIsLoading(true);
      
      // In real implementation, this would validate the session code with your backend
      // For demo, we'll just simulate joining a session
      
      // Check if we have a mocked session with this code
      if (currentSession && currentSession.code === sessionCode) {
        // Generate a player ID
        const newPlayerId = uuidv4();
        setPlayerId(newPlayerId);
        setPlayerName(name);
        
        // Add the player to the session
        const updatedSession = { ...currentSession };
        
        // Default roles based on player count
        const roles = ['Tech Minister', 'Economy Director', 'Security Chief'];
        const playerRole = roles[updatedSession.players.length - 1];
        
        updatedSession.players.push({
          id: newPlayerId,
          name,
          isReady: false,
          hasVoted: false,
          isEliminated: false,
          role: playerRole,
          secretObjective: generateSecretObjective(),
        });
        
        setCurrentSession(updatedSession);
        setIsConnected(true);
        setIsLoading(false);
        
        // Navigate to the lobby
        navigate('/lobby');
      } else {
        throw new Error("Invalid session code");
      }
    } catch (err) {
      setError("Failed to join session. Please check the code and try again.");
      setIsLoading(false);
    }
  };

  // Leave the current session
  const leaveSession = () => {
    // In a real implementation, this would notify other players
    setCurrentSession(null);
    setPlayerId(null);
    setPlayerName(null);
    setIsConnected(false);
    navigate('/');
  };

  // Start the game
  const startGame = () => {
    if (!currentSession) return;
    
    // Check if enough players are ready
    const readyPlayers = currentSession.players.filter(p => p.isReady);
    if (readyPlayers.length < 1) {
      toast({
        title: "Cannot Start Game",
        description: "At least one player must be ready to start.",
        variant: "destructive",
      });
      return;
    }
    
    // Update session status
    const updatedSession = { ...currentSession, status: 'in-progress' as const };
    
    // Assign a scenario
    updatedSession.currentScenario = getSampleScenario();
    
    // Assign secret objectives to players who don't have them
    updatedSession.players = updatedSession.players.map(player => {
      if (!player.secretObjective) {
        return {
          ...player,
          secretObjective: generateSecretObjective(),
        };
      }
      return player;
    });
    
    setCurrentSession(updatedSession);
    setGamePhase('scenario');
    
    // Navigate to the game
    navigate('/game');
  };

  // End the current game
  const endGame = () => {
    if (!currentSession) return;
    
    const updatedSession = { 
      ...currentSession, 
      status: 'completed' as const 
    };
    
    setCurrentSession(updatedSession);
    navigate('/');
  };

  // Set player ready status
  const setPlayerReady = (isReady: boolean) => {
    if (!currentSession || !playerId) return;
    
    const updatedSession = { ...currentSession };
    const playerIndex = updatedSession.players.findIndex(p => p.id === playerId);
    
    if (playerIndex !== -1) {
      updatedSession.players[playerIndex].isReady = isReady;
      setCurrentSession(updatedSession);
    }
  };

  // Cast a vote for an option
  const castVote = (optionId: string) => {
    if (!currentSession || !playerId) return;
    
    const updatedSession = { ...currentSession };
    const playerIndex = updatedSession.players.findIndex(p => p.id === playerId);
    
    if (playerIndex !== -1) {
      updatedSession.players[playerIndex].hasVoted = true;
      setCurrentSession(updatedSession);
      
      // For demo purposes, advance to results after a short delay
      setTimeout(() => {
        setGamePhase('results');
      }, 2000);
    }
  };

  // Advance to the next round
  const nextRound = () => {
    if (!currentSession) return;
    
    const updatedSession = { 
      ...currentSession,
      currentRound: currentSession.currentRound + 1,
    };
    
    // Reset player votes
    updatedSession.players = updatedSession.players.map(player => ({
      ...player,
      hasVoted: false,
    }));
    
    // Update resources (simulated changes)
    updatedSession.resources = updatedSession.resources.map(resource => ({
      ...resource,
      value: Math.min(Math.max(resource.value + Math.floor(Math.random() * 20) - 10, 0), 100)
    }));
    
    // Set a new scenario
    updatedSession.currentScenario = getSampleScenario();
    
    setCurrentSession(updatedSession);
    setGamePhase('scenario');
  };

  // Provide context value
  const contextValue: MultiplayerContextType = {
    createSession,
    joinSession,
    leaveSession,
    startGame,
    endGame,
    setPlayerReady,
    castVote,
    nextRound,
    isHost,
    playerId,
    playerName,
    currentSession,
    gamePhase,
    isConnected,
    isLoading,
    error,
  };

  return (
    <MultiplayerContext.Provider value={contextValue}>
      {children}
    </MultiplayerContext.Provider>
  );
};

// Hook to use the multiplayer context
export const useMultiplayer = () => {
  const context = useContext(MultiplayerContext);
  if (context === undefined) {
    throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  }
  return context;
};
