import React from "react";
import { cn } from "../lib/utils";

interface SecretIncentiveNotificationProps {
  playerId: string | null;
  selectedPlayerId: string | null;
  incentiveText: string;
  className?: string;
}

const SecretIncentiveNotification: React.FC<
  SecretIncentiveNotificationProps
> = ({ playerId, selectedPlayerId, incentiveText, className }) => {
  // Debug logging
  console.log("SecretIncentiveNotification Props:", {
    playerId,
    selectedPlayerId,
    incentiveText,
    shouldShow: playerId === selectedPlayerId,
    playerIdType: typeof playerId,
    selectedPlayerIdType: typeof selectedPlayerId,
    playerIdLength: playerId?.length,
    selectedPlayerIdLength: selectedPlayerId?.length,
    exactMatch: playerId === selectedPlayerId,
    looseMatch: playerId == selectedPlayerId,
  });

  // Only show notification if this player is the selected player
  // Make sure we're doing a strict equality check and both IDs exist
  if (!playerId || !selectedPlayerId || playerId !== selectedPlayerId) {
    console.log("Not showing notification - player not selected", {
      reason: !playerId
        ? "no playerId"
        : !selectedPlayerId
        ? "no selectedPlayerId"
        : "ids don't match",
      playerId,
      selectedPlayerId,
    });
    return null;
  }

  return (
    <div
      className={cn(
        "glass-panel p-4 mt-4 border-2 border-neon-pink",
        "bg-gradient-to-r from-pink-900/20 to-purple-900/20",
        "shadow-[0_0_15px_rgba(236,72,153,0.5)]",
        "transition-all duration-300 ease-in-out",
        className
      )}
    >
      <h3 className="text-neon-pink font-semibold mb-2 text-sm">
        Secret Incentive
      </h3>
      <p className="text-gray-300 text-sm">{incentiveText}</p>
    </div>
  );
};

export default SecretIncentiveNotification;
