export enum GamePhase {
  LOBBY = "lobby",
  SCENARIO = "scenario",
  VOTING = "voting",
  RESULTS = "results",
}

export interface GameState {
  session_id: string;
  host_id: string;
  code: string;
  players: Player[];
  resources: Resource[];
  currentRound: number;
  phase: GamePhase;
  currentScenario: Scenario | null;
  roundStartTime: number;
  timer_running: boolean;
  timer_end_time: string | null;
}

export interface Player {
  id: string;
  name: string;
  role: string;
  isReady: boolean;
  hasVoted: boolean;
  isEliminated: boolean;
  vote_weight: number;
  secretObjective: {
    description: string;
    isCompleted: boolean;
    progress: number;
    target: number;
  };
}

export interface Resource {
  type: string;
  value: number;
  maxValue: number;
}

export interface ScenarioOption {
  id: string;
  text: string;
}

export interface Scenario {
  title: string;
  description: string;
  consequences: string;
  options: ScenarioOption[];
}
