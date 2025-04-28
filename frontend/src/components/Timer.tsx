import React, { useEffect, useState } from "react";

interface TimerProps {
  endTime: string | null;
  isRunning: boolean;
}

const Timer: React.FC<TimerProps> = ({ endTime, isRunning }) => {
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false);

  useEffect(() => {
    if (!isRunning || !endTime) {
      setIsTimeUp(false);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const difference = end - now;

      if (difference <= 0) {
        setIsTimeUp(true);
        return;
      }

      setIsTimeUp(false);
      // No countdown display
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endTime, isRunning]);

  if (!isRunning) {
    return null;
  }

  if (isTimeUp) {
    return (
      <div className="fixed top-4 right-4 bg-black text-neon-red px-4 py-2 rounded-lg shadow-lg border-2 border-neon-red font-bold text-lg">
        Time's Up!
      </div>
    );
  }

  // Hide countdown during countdown phase
  return null;
};

export default Timer;
