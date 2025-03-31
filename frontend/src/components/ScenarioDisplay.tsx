import React from "react";
import { cn } from "../lib/utils";

interface ScenarioDisplayProps {
  title: string;
  description: string;
  round: number;
  consequences?: string;
  className?: string;
}

const ScenarioDisplay = ({
  title,
  description,
  round,
  consequences,
  className,
}: ScenarioDisplayProps) => {
  // Use placeholder text if no title is provided
  const displayTitle = title || "Mysterious Signal From Deep Space";
  const displayDescription =
    description ||
    "Our deep space monitoring stations have detected an unusual signal originating from beyond our solar system. Initial analysis suggests it could be artificial in nature. The signal appears to contain complex mathematical sequences that our scientists believe may be an attempt at communication. However, there is no consensus on whether we should respond or what the message might contain.";
  const displayConsequences =
    consequences ||
    "How we handle this situation could dramatically affect our technological development and potentially our safety if the signal represents a threat.";

  return (
    <div
      className={cn(
        "glass-panel p-6 animate-fade-in bg-black/30 backdrop-blur-sm",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="px-2 py-1 bg-secondary rounded text-xs font-semibold text-white">
          ROUND {round}
        </div>
        {displayConsequences && (
          <div className="px-2 py-1 bg-neon-pink bg-opacity-20 text-neon-pink rounded text-xs font-semibold">
            CRISIS EVENT
          </div>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-4 text-white neon-glow">
        {displayTitle}
      </h2>

      <div className="prose prose-invert max-w-none mb-6">
        <p className="text-gray-300 leading-relaxed text-lg">
          {displayDescription}
        </p>
      </div>

      {displayConsequences && (
        <div className="mt-4 p-4 border border-neon-pink rounded-md bg-neon-pink bg-opacity-5">
          <h3 className="font-semibold text-neon-pink mb-2">
            Potential Consequences
          </h3>
          <p className="text-sm text-gray-300">{displayConsequences}</p>
        </div>
      )}
    </div>
  );
};

export default ScenarioDisplay;
