import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTestMode } from "@/contexts/TestModeContext";
import type { GameSubscription, ResourceSubscription } from "@/lib/supabase";

export const useTestGame = () => {
  const { isTestMode, testSessionId, setTestSessionId } = useTestMode();
  const [gameState, setGameState] = useState<GameSubscription | null>(null);
  const [resources, setResources] = useState<ResourceSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to game state changes
  useEffect(() => {
    if (!isTestMode || !testSessionId) return;

    const gameSubscription = supabase
      .channel(`game:${testSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `session_id=eq.${testSessionId}`,
        },
        (payload) => {
          setGameState(payload.new as GameSubscription);
        }
      )
      .subscribe();

    const resourcesSubscription = supabase
      .channel(`resources:${testSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resources",
          filter: `session_id=eq.${testSessionId}`,
        },
        (payload) => {
          setResources(payload.new as ResourceSubscription);
        }
      )
      .subscribe();

    return () => {
      gameSubscription.unsubscribe();
      resourcesSubscription.unsubscribe();
    };
  }, [isTestMode, testSessionId]);

  // Create a new test game
  const createTestGame = async () => {
    if (!isTestMode) return;

    setIsLoading(true);
    try {
      const sessionId = crypto.randomUUID();
      const hostId = crypto.randomUUID();

      // Create game
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .insert({
          session_id: sessionId,
          host_id: hostId,
          current_round: 1,
          max_rounds: 10,
          is_active: true,
          phase: "scenario",
          current_scenario: "Test scenario 1",
          current_options: ["Option A", "Option B", "Option C"],
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // Initialize resources
      const { error: resourcesError } = await supabase
        .from("resources")
        .insert({
          session_id: sessionId,
          tech: 100,
          manpower: 100,
          economy: 100,
          happiness: 100,
          trust: 100,
        });

      if (resourcesError) throw resourcesError;

      setTestSessionId(sessionId);
    } catch (error) {
      console.error("Error creating test game:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Record a vote and update resources
  const recordVote = async (option: string) => {
    if (!isTestMode || !testSessionId || !gameState) return;

    setIsLoading(true);
    try {
      // Record vote
      const { error: voteError } = await supabase.from("votes").insert({
        session_id: testSessionId,
        player_id: "test-player",
        round: gameState.current_round,
        vote: option,
      });

      if (voteError) throw voteError;

      // Update resources based on vote
      const resourceChanges = {
        tech: option === "Option A" ? -5 : option === "Option B" ? -3 : -4,
        manpower: option === "Option A" ? -3 : option === "Option B" ? -4 : -2,
        economy: option === "Option A" ? -4 : option === "Option B" ? -2 : -5,
        happiness: option === "Option A" ? -2 : option === "Option B" ? -5 : -3,
        trust: option === "Option A" ? -3 : option === "Option B" ? -4 : -2,
      };

      const { error: resourcesError } = await supabase
        .from("resources")
        .update(resourceChanges)
        .eq("session_id", testSessionId);

      if (resourcesError) throw resourcesError;

      // Move to next round
      const { error: gameError } = await supabase
        .from("games")
        .update({
          current_round: gameState.current_round + 1,
          current_scenario: `Test scenario ${gameState.current_round + 1}`,
          current_options: ["Option A", "Option B", "Option C"],
        })
        .eq("session_id", testSessionId);

      if (gameError) throw gameError;
    } catch (error) {
      console.error("Error recording vote:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    gameState,
    resources,
    isLoading,
    createTestGame,
    recordVote,
  };
};
