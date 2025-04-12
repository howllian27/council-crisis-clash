import React, { useState, useEffect } from "react";
import Button from "./Button";
import { cn } from "../lib/utils";

interface Option {
  id: string;
  text: string;
}

interface VotingPanelProps {
  options: Option[];
  timeRemaining: number;
  onVote: (optionId: string) => void;
  hasVoted?: boolean;
}

const VotingPanel = ({
  options,
  timeRemaining,
  onVote,
  hasVoted: initialHasVoted = false,
}: VotingPanelProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeRemaining);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);

  useEffect(() => {
    if (timeLeft <= 0) {
      // Only send vote when timer ends and player hasn't voted yet
      if (selectedOption && !hasVoted) {
        onVote(selectedOption);
        setHasVoted(true);
      }
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, selectedOption, hasVoted, onVote]);

  const handleVote = () => {
    if (selectedOption && !hasVoted) {
      setSelectedOption(selectedOption);
    }
  };

  const timePercentage = (timeLeft / timeRemaining) * 100;

  return (
    <div className="w-full max-w-3xl mx-auto glass-panel p-6 animate-fade-in">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-xl">Cast Your Vote</h2>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-neon-pink animate-pulse" />
            <span className="font-mono text-neon-pink">
              {timeLeft}s remaining
            </span>
          </div>
        </div>

        <div className="progress-bar">
          <div
            className="progress-bar-fill bg-neon-pink"
            style={{ width: `${timePercentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {options.map((option) => (
          <div
            key={option.id}
            className={cn(
              "border border-border rounded-lg p-4 transition-all-200 cursor-pointer hover-scale",
              selectedOption === option.id
                ? "border-neon-pink bg-neon-pink bg-opacity-10"
                : "hover:border-neon-pink",
              hasVoted && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => !hasVoted && setSelectedOption(option.id)}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  selectedOption === option.id
                    ? "border-neon-pink"
                    : "border-muted-foreground"
                )}
              >
                {selectedOption === option.id && (
                  <div className="w-3 h-3 rounded-full bg-neon-pink" />
                )}
              </div>
              <span className="text-sm md:text-base">{option.text}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleVote}
          disabled={!selectedOption || hasVoted}
          glow={!!selectedOption && !hasVoted}
        >
          {hasVoted ? "Vote Locked" : "Confirm Vote"}
        </Button>
      </div>
    </div>
  );
};

export default VotingPanel;
