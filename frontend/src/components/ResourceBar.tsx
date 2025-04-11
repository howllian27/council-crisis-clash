import React from "react";
import { cn } from "../lib/utils";

interface ResourceProps {
  type: "tech" | "manpower" | "economy" | "happiness" | "trust";
  value: number;
  maxValue: number;
  label?: string;
  className?: string;
}

const ResourceBar = ({
  type,
  value,
  maxValue,
  label,
  className,
}: ResourceProps) => {
  // Calculate the percentage for the progress bar (capped at 100% for display)
  const displayPercentage = Math.min((value / maxValue) * 100, 100);
  const isOverMax = value > maxValue;

  const getColor = () => {
    switch (type) {
      case "tech":
        return "bg-neon-blue";
      case "manpower":
        return "bg-neon-purple";
      case "economy":
        return "bg-neon-green";
      case "happiness":
        return "bg-yellow-400";
      case "trust":
        return "bg-neon-pink";
      default:
        return "bg-neon-pink";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "tech":
        return "🔬";
      case "manpower":
        return "👥";
      case "economy":
        return "💰";
      case "happiness":
        return "😊";
      case "trust":
        return "🤝";
      default:
        return "📊";
    }
  };

  return (
    <div className={cn("w-full space-y-1", className)}>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">{getIcon()}</span>
          <span className="text-sm font-medium uppercase tracking-wider">
            {label || type}
          </span>
        </div>
        <span
          className={cn("text-sm font-medium", isOverMax && "text-neon-pink")}
        >
          {value}/{maxValue}
        </span>
      </div>

      <div className="progress-bar">
        <div
          className={cn(
            "progress-bar-fill",
            getColor(),
            isOverMax && "glow-effect"
          )}
          style={{ width: `${displayPercentage}%` }}
        />
      </div>
    </div>
  );
};

export default ResourceBar;
