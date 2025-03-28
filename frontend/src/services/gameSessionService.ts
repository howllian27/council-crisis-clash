
import { v4 as uuidv4 } from 'uuid';

// Game session types
export interface GameSession {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  status: 'waiting' | 'in-progress' | 'completed';
  currentRound: number;
  maxRounds: number;
  resources: Resource[];
  currentScenario?: GameScenario;
  createdAt: number;
}

export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  hasVoted: boolean;
  isEliminated: boolean;
  role: string;
  secretObjective?: SecretObjective;
}

export interface Resource {
  type: 'tech' | 'manpower' | 'economy' | 'happiness' | 'trust';
  value: number;
  maxValue: number;
}

export interface GameScenario {
  title: string;
  description: string;
  consequences: string;
  options: { id: string; text: string }[];
}

export interface SecretObjective {
  description: string;
  isCompleted: boolean;
  progress: number;
  target: number;
}

// Game phase type
export type GamePhase = 'scenario' | 'voting' | 'results';

// Generate a random 6-character code
const generateSessionCode = (): string => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Initial resources setup
const getInitialResources = (): Resource[] => [
  { type: 'tech', value: 75, maxValue: 100 },
  { type: 'manpower', value: 60, maxValue: 100 },
  { type: 'economy', value: 80, maxValue: 100 },
  { type: 'happiness', value: 90, maxValue: 100 },
  { type: 'trust', value: 70, maxValue: 100 },
];

// Create a new game session
export const createGameSession = (hostName: string): GameSession => {
  const hostId = uuidv4();
  return {
    id: uuidv4(),
    code: generateSessionCode(),
    hostId,
    players: [
      {
        id: hostId,
        name: hostName,
        isReady: true,
        hasVoted: false,
        isEliminated: false,
        role: 'Council Leader',
      },
    ],
    status: 'waiting',
    currentRound: 1,
    maxRounds: 10,
    resources: getInitialResources(),
    createdAt: Date.now(),
  };
};

// Sample scenario for testing
export const getSampleScenario = (): GameScenario => ({
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

// Generate a secret objective for a player
export const generateSecretObjective = (): SecretObjective => {
  const objectives = [
    "Ensure the 'trust' resource stays above 60% for 3 rounds",
    "Ensure the 'tech' resource drops below 40% at least once",
    "Make sure at least one player gets eliminated",
    "Keep the 'economy' resource above 70% for the next 2 rounds",
    "Ensure the 'happiness' resource stays balanced between 40-60%"
  ];
  
  return {
    description: objectives[Math.floor(Math.random() * objectives.length)],
    isCompleted: false,
    progress: 0,
    target: 3,
  };
};
