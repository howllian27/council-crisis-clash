import React, { useEffect, useState } from "react";
import { cn } from "../lib/utils";

interface ScenarioDisplayProps {
  title: string;
  description: string;
  round: number;
  consequences?: string;
  options?: Array<{
    id: string;
    text: string;
  }>;
  className?: string;
  onVote?: (optionId: string) => void;
  timeLimit?: number;
  hasVoted?: boolean;
  roundStartTime?: number; // Unix timestamp in milliseconds
}

const ScenarioDisplay: React.FC<ScenarioDisplayProps> = ({
  title,
  description,
  round,
  consequences,
  options,
  className,
  onVote,
  timeLimit = 60,
  hasVoted = false,
  roundStartTime,
}) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    if (timeLeft > 0 && !hasVoted) {
      // Calculate time left based on server start time
      const calculateTimeLeft = () => {
        if (!roundStartTime) return timeLimit;
        const elapsed = (Date.now() - roundStartTime) / 1000; // Convert to seconds
        return Math.max(0, timeLimit - Math.floor(elapsed));
      };

      // Initial calculation
      setTimeLeft(calculateTimeLeft());

      // Update every second
      const timer = setInterval(() => {
        const remaining = calculateTimeLeft();
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft, hasVoted, roundStartTime, timeLimit]);

  const handleOptionClick = (optionId: string) => {
    if (!hasVoted && onVote) {
      setSelectedOption(optionId);
      onVote(optionId);
    }
  };

  return (
    <div className={cn("glass-panel p-6 animate-fade-in", className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 neon-glow">{title}</h2>
        <p className="text-sm text-gray-400 mb-4">Round {round}</p>
        <p className="text-gray-300 mb-4">{description}</p>
        {consequences && (
          <div className="p-4 border border-neon-pink rounded-md bg-neon-pink bg-opacity-5">
            <h3 className="font-semibold text-neon-pink mb-2">Consequences</h3>
            <p className="text-sm text-gray-300">{consequences}</p>
          </div>
        )}
      </div>

      {/* Timer Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Time Remaining</span>
          <span>{timeLeft}s</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-neon-pink transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / timeLimit) * 100}%` }}
          />
        </div>
      </div>

      {options && options.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neon-pink">
            Available Options
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map((option) => (
              <div
                key={option.id}
                className={cn(
                  "p-4 border border-neon-pink rounded-md transition-all cursor-pointer",
                  hasVoted
                    ? option.id === selectedOption
                      ? "bg-neon-pink bg-opacity-20"
                      : "opacity-50"
                    : "bg-neon-pink bg-opacity-5 hover:bg-opacity-10",
                  hasVoted && "cursor-not-allowed"
                )}
                onClick={() => handleOptionClick(option.id)}
              >
                <p className="text-gray-300">{option.text}</p>
                {hasVoted && option.id === selectedOption && (
                  <p className="text-neon-pink text-sm mt-2">Your Vote</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioDisplay;
