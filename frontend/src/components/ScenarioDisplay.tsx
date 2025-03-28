
import React from 'react';
import { cn } from '../lib/utils';

interface ScenarioDisplayProps {
  title: string;
  description: string;
  round: number;
  consequences?: string;
  className?: string;
}

const ScenarioDisplay = ({ title, description, round, consequences, className }: ScenarioDisplayProps) => {
  return (
    <div className={cn("glass-panel p-6 animate-fade-in", className)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="px-2 py-1 bg-secondary rounded text-xs font-semibold">
          ROUND {round}
        </div>
        {consequences && (
          <div className="px-2 py-1 bg-neon-pink bg-opacity-20 text-neon-pink rounded text-xs font-semibold">
            CRISIS EVENT
          </div>
        )}
      </div>
      
      <h2 className="text-2xl font-bold mb-4 neon-glow">{title}</h2>
      
      <div className="prose prose-invert max-w-none mb-6">
        <p className="text-gray-300 leading-relaxed">{description}</p>
      </div>
      
      {consequences && (
        <div className="mt-4 p-4 border border-neon-pink rounded-md bg-neon-pink bg-opacity-5">
          <h3 className="font-semibold text-neon-pink mb-2">Potential Consequences</h3>
          <p className="text-sm text-gray-300">{consequences}</p>
        </div>
      )}
    </div>
  );
};

export default ScenarioDisplay;
