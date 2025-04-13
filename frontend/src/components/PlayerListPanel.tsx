import React from "react";
import { cn } from "../lib/utils";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useMultiplayer } from "../contexts/MultiplayerContext";

interface Player {
  id: string;
  name: string;
  role: string;
  vote_weight: number;
  isEliminated: boolean;
  hasVoted: boolean;
}

interface PlayerListPanelProps {
  players: Player[];
  currentPlayerId: string | null;
}

const PlayerListPanel: React.FC<PlayerListPanelProps> = ({
  players,
  currentPlayerId,
}) => {
  const { isHost } = useMultiplayer();

  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  return (
    <div className="glass-panel">
      <div className="flex flex-col gap-2 p-4">
        <h2 className="text-xl font-bold mb-2 text-neon-pink">
          Council Members
        </h2>
        {players.map((player) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          const isPlayerHost = player.id === currentPlayerId && isHost;
          return (
            <div
              key={player.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors",
                isCurrentPlayer && "border border-neon-pink"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white">
                  {player.name[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-gray-200",
                        isCurrentPlayer && "font-bold"
                      )}
                    >
                      {player.name}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    {capitalizeFirstLetter(player.role)}
                  </span>
                  {isCurrentPlayer && (
                    <div className="text-sm text-gray-400">
                      Vote Weight: {player.vote_weight.toFixed(1)}x
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                {player.hasVoted && (
                  <span className="text-green-500">
                    <CheckCircleIcon className="h-5 w-5" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerListPanel;
