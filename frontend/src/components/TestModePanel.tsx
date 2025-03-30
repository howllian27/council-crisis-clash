import { Button } from "@/components/ui/button";
import { useTestMode } from "@/contexts/TestModeContext";
import { useTestGame } from "@/hooks/useTestGame";
import { Card } from "@/components/ui/card";

export const TestModePanel = () => {
  const { isTestMode, toggleTestMode } = useTestMode();
  const { gameState, resources, isLoading, createTestGame, recordVote } =
    useTestGame();

  if (!isTestMode) {
    return (
      <Button
        variant="outline"
        onClick={toggleTestMode}
        className="fixed bottom-4 right-4 z-50"
      >
        Enable Test Mode
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 p-4 w-80 z-50">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Test Mode</h3>
          <Button variant="ghost" size="sm" onClick={toggleTestMode}>
            Disable
          </Button>
        </div>

        {!gameState ? (
          <Button
            onClick={createTestGame}
            disabled={isLoading}
            className="w-full"
          >
            Create Test Game
          </Button>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Current Round</h4>
              <p className="text-sm">{gameState.current_round}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Scenario</h4>
              <p className="text-sm">{gameState.current_scenario}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Resources</h4>
              {resources && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Tech: {resources.tech}</div>
                  <div>Manpower: {resources.manpower}</div>
                  <div>Economy: {resources.economy}</div>
                  <div>Happiness: {resources.happiness}</div>
                  <div>Trust: {resources.trust}</div>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Vote Options</h4>
              <div className="space-y-2">
                {gameState.current_options.map((option) => (
                  <Button
                    key={option}
                    variant="outline"
                    size="sm"
                    onClick={() => recordVote(option)}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
