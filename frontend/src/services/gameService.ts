import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

// Log all environment variables (excluding sensitive data)
console.log("Environment variables loaded:", {
  hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
  hasKey: !!import.meta.env.VITE_SUPABASE_KEY,
  urlLength: import.meta.env.VITE_SUPABASE_URL?.length,
  keyLength: import.meta.env.VITE_SUPABASE_KEY?.length,
});

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl) {
  console.error("Missing VITE_SUPABASE_URL. Please check your .env file.");
  throw new Error("Missing VITE_SUPABASE_URL");
}

if (!supabaseKey) {
  console.error("Missing VITE_SUPABASE_KEY. Please check your .env file.");
  throw new Error("Missing VITE_SUPABASE_KEY");
}

// Validate URL format
if (!supabaseUrl.includes("supabase.co")) {
  console.error(
    "Invalid Supabase URL format. URL should contain 'supabase.co'"
  );
  throw new Error("Invalid Supabase URL format");
}

// Ensure the URL is properly formatted
const formattedUrl = supabaseUrl.startsWith("http")
  ? supabaseUrl
  : `https://${supabaseUrl}`;

console.log("Using Supabase URL:", formattedUrl);

let supabase;
try {
  supabase = createClient(formattedUrl, supabaseKey);
  console.log("Supabase client initialized successfully");
} catch (error) {
  console.error("Failed to initialize Supabase client:", error);
  throw error;
}

// Add this near the top of the file, after the supabase initialization
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface Scenario {
  title: string;
  description: string;
  consequences: string;
  options: Array<{
    id: string;
    text: string;
  }>;
}

export interface GameState {
  id: string;
  current_round: number;
  current_scenario: Scenario | null;
  phase: string;
  is_active: boolean;
  players: {
    [key: string]: {
      id: string;
      name: string;
      role: string;
      secret_incentive: string;
      is_active: boolean;
      vote_weight: number;
      has_voted: boolean;
      is_eliminated: boolean;
    };
  };
  resources: {
    tech: number;
    manpower: number;
    economy: number;
    happiness: number;
    trust: number;
  };
  votes: {
    [key: string]: {
      player_id: string;
      option: string;
      round: number;
    };
  };
}

interface PlayerUpdate {
  isReady?: boolean;
  hasVoted?: boolean;
  isEliminated?: boolean;
  vote_weight?: number;
  secret_incentive?: string;
}

export const gameService = {
  async createGame(hostName: string) {
    try {
      console.log("=== Starting game creation ===");
      console.log("Host name:", hostName);

      console.log("Making API request to http://localhost:8000/api/games");
      const response = await fetch(`${API_BASE_URL}/api/games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        mode: "cors",
        body: JSON.stringify({ host_name: hostName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Server error:", errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Game created successfully:", data);

      if (!data.session_id || !data.host_id) {
        console.error("Invalid response data:", data);
        throw new Error("Invalid response from server");
      }

      return data;
    } catch (error) {
      console.error("=== Error in createGame ===");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Error stack:", error.stack);
      }
      throw error;
    }
  },

  async joinGame(sessionId: string, playerName: string) {
    try {
      console.log("=== Starting join game process ===");
      console.log("Input parameters:", { sessionId, playerName });

      // First check if the game exists in Supabase
      console.log("Checking if game exists in Supabase...");
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("session_id", sessionId);

      if (gameError) {
        console.error("Error checking game existence:", gameError);
        throw new Error(`Failed to check game existence: ${gameError.message}`);
      }

      if (!gameData || gameData.length === 0) {
        console.error("No game found with session ID:", sessionId);
        throw new Error(
          "Game not found. Please check the session code and try again."
        );
      }

      console.log("Found existing game:", gameData[0]);

      // Check current players
      const { data: currentPlayers, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("session_id", sessionId);

      if (playersError) {
        console.error("Error checking current players:", playersError);
      } else {
        console.log("Current players in game:", currentPlayers);
      }

      // Now try to join through the API
      console.log("Attempting to join through API...");
      console.log("API URL:", `${API_BASE_URL}/api/games/${sessionId}/join`);
      console.log("Request body:", {
        session_id: sessionId,
        player_name: playerName,
      });

      const response = await fetch(
        `${API_BASE_URL}/api/games/${sessionId}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            player_name: playerName,
          }),
        }
      );

      console.log("API Response status:", response.status);
      const responseText = await response.text();
      console.log("API Response text:", responseText);

      if (!response.ok) {
        throw new Error(`Failed to join game: ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Error parsing API response:", e);
        throw new Error("Invalid API response");
      }

      console.log("Successfully joined game:", data);

      // If API call succeeded but player not in Supabase, try direct insert
      console.log("Verifying player in Supabase...");
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("*")
        .eq("session_id", sessionId)
        .eq("name", playerName);

      if (playerError || !playerData || playerData.length === 0) {
        console.log(
          "Player not found in Supabase, attempting direct insert..."
        );
        const playerId = data.player_id || uuidv4();
        const { error: insertError } = await supabase.from("players").insert({
          player_id: playerId,
          session_id: sessionId,
          name: playerName,
          role: "player",
          secret_incentive: "Player's secret objective",
          is_active: true,
          vote_weight: 1.0,
          has_voted: false,
          is_eliminated: false,
        });

        if (insertError) {
          console.error("Error inserting player directly:", insertError);
        } else {
          console.log("Successfully inserted player directly into Supabase");
        }
      } else {
        console.log("Player verified in Supabase:", playerData[0]);
      }

      return data;
    } catch (error) {
      console.error("=== Error in joinGame ===");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Error stack:", error.stack);
      }
      throw error;
    }
  },

  async startGame(sessionId: string) {
    try {
      console.log("Starting game:", sessionId);
      const response = await fetch(
        `${API_BASE_URL}/api/games/${sessionId}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          mode: "cors",
        }
      );

      console.log("Response status:", response.status);
      const responseText = await response.text();
      console.log("Response text:", responseText);

      if (!response.ok) {
        throw new Error(`Failed to start game: ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Error parsing response:", e);
        throw new Error("Invalid response from server");
      }

      console.log("Game started successfully:", data);
      return data;
    } catch (error) {
      console.error("Error starting game:", error);
      throw error;
    }
  },

  async getGameState(sessionId: string): Promise<GameState> {
    console.log("Fetching game state for session:", sessionId);
    try {
      // Fetch game data
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("session_id", sessionId)
        .single();

      if (gameError) {
        console.error("Error fetching game data:", gameError);
        throw gameError;
      }

      // Parse the current_scenario if it exists
      let parsedScenario = null;
      if (gameData.current_scenario) {
        try {
          parsedScenario =
            typeof gameData.current_scenario === "string"
              ? JSON.parse(gameData.current_scenario)
              : gameData.current_scenario;
          console.log("Parsed scenario:", parsedScenario);
        } catch (e) {
          console.error("Error parsing scenario:", e);
          parsedScenario = null;
        }
      }

      // Fetch players
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("session_id", sessionId);

      if (playersError) {
        console.error("Error fetching players:", playersError);
        throw playersError;
      }

      // Fetch resources
      const { data: resourcesData, error: resourcesError } = await supabase
        .from("resources")
        .select("*")
        .eq("session_id", sessionId)
        .single();

      if (resourcesError) {
        console.error("Error fetching resources:", resourcesError);
        throw resourcesError;
      }

      // Combine all data into game state
      const gameState: GameState = {
        ...gameData,
        current_scenario: parsedScenario,
        players: playersData.reduce((acc, player) => {
          acc[player.id] = player;
          return acc;
        }, {}),
        resources: resourcesData || {
          tech: 100,
          manpower: 100,
          economy: 100,
          happiness: 100,
          trust: 100,
        },
      };

      console.log("Game state fetched successfully:", gameState);
      return gameState;
    } catch (error) {
      console.error("Error in getGameState:", error);
      throw error;
    }
  },

  subscribeToGame(sessionId: string, callback: (state: GameState) => void) {
    console.log("Setting up subscription for game:", sessionId);

    // Subscribe to game state changes
    const gameSubscription = supabase
      .channel(`game:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log("Received game state update:", payload);
          // Fetch complete game state to ensure we have all latest data
          const updatedState = await this.getGameState(sessionId);
          callback(updatedState);
        }
      )
      .subscribe();

    // Subscribe to player changes
    const playerSubscription = supabase
      .channel(`players:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log("Received player update:", payload);
          // Fetch complete game state to ensure we have all latest data
          const updatedState = await this.getGameState(sessionId);
          callback(updatedState);
        }
      )
      .subscribe();

    // Subscribe to resource changes
    const resourceSubscription = supabase
      .channel(`resources:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resources",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log("Received resource update:", payload);
          // Fetch complete game state to ensure we have all latest data
          const updatedState = await this.getGameState(sessionId);
          callback(updatedState);
        }
      )
      .subscribe();

    // Subscribe to secret incentives changes
    const incentiveSubscription = supabase
      .channel(`incentives:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "secret_incentives",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log("Received incentive update:", payload);
          // Fetch complete game state to ensure we have all latest data
          const updatedState = await this.getGameState(sessionId);
          callback(updatedState);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        console.log("Unsubscribing from all channels for game:", sessionId);
        gameSubscription.unsubscribe();
        playerSubscription.unsubscribe();
        resourceSubscription.unsubscribe();
        incentiveSubscription.unsubscribe();
      },
    };
  },

  // Temporary mock scenarios for testing
  getMockScenario() {
    return {
      title: "The Great Pigeon Crisis",
      description:
        "A flock of highly intelligent pigeons has taken control of the city's communication towers. They're demanding better bread quality and more park benches in exchange for returning control.",
      options: [
        {
          id: "negotiate",
          text: "Negotiate with the pigeons",
          consequences: {
            tech: -10,
            happiness: 5,
            trust: -5,
          },
        },
        {
          id: "force",
          text: "Deploy the anti-pigeon task force",
          consequences: {
            tech: 5,
            happiness: -10,
            trust: -15,
          },
        },
        {
          id: "bribe",
          text: "Bribe them with premium bread",
          consequences: {
            tech: 0,
            happiness: 10,
            trust: 5,
          },
        },
      ],
    };
  },

  async recordVote(
    sessionId: string,
    playerId: string,
    option: string
  ): Promise<void> {
    console.log("Recording vote:", { sessionId, playerId, option });
    try {
      const { error } = await supabase.from("votes").insert({
        session_id: sessionId,
        player_id: playerId,
        option: option,
      });

      if (error) {
        console.error("Error recording vote:", error);
        throw error;
      }

      console.log("Vote recorded successfully");
    } catch (error) {
      console.error("Error in recordVote:", error);
      throw error;
    }
  },

  async updatePlayer(
    sessionId: string,
    playerId: string,
    updates: PlayerUpdate
  ) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/games/${sessionId}/players/${playerId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update player");
      }

      const data = await response.json();
      console.log("Player updated successfully:", data);
      return data;
    } catch (error) {
      console.error("Error updating player:", error);
      throw error;
    }
  },

  async leaveGame(sessionId: string, playerId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("players")
        .update({ is_active: false })
        .eq("session_id", sessionId)
        .eq("player_id", playerId);

      if (error) {
        console.error("Error leaving game:", error);
        throw error;
      }

      console.log("Successfully left game");
    } catch (error) {
      console.error("Error in leaveGame:", error);
      throw error;
    }
  },
};
