const handleVotingOutcome = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/games/${sessionId}/scenario/outcome`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get voting outcome");
    }

    const data = await response.json();
    const { outcome, resource_changes } = data;

    // Update the game state with the outcome and resource changes
    setGameState((prev) => ({
      ...prev,
      currentScenario: {
        ...prev.currentScenario,
        outcome,
        resource_changes,
      },
    }));

    // Show resource changes in a toast notification
    if (resource_changes) {
      const changes = Object.entries(resource_changes)
        .map(
          ([resource, change]) =>
            `${resource}: ${change > 0 ? "+" : ""}${change}`
        )
        .join(", ");

      toast.success(`Resource changes: ${changes}`);
    }
  } catch (error) {
    console.error("Error getting voting outcome:", error);
    toast.error("Failed to get voting outcome");
  }
};
