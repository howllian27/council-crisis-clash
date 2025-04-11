import React, { useEffect, useState } from "react";

interface TimerProps {
  endTime: string | null;
  isRunning: boolean;
}

const Timer: React.FC<TimerProps> = ({ endTime, isRunning }) => {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!isRunning || !endTime) {
      setTimeLeft("");
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const difference = end - now;

      if (difference <= 0) {
        setTimeLeft("Time's up!");
        return;
      }

      const seconds = Math.floor((difference / 1000) % 60);
      setTimeLeft(`${seconds}s`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endTime, isRunning]);

  if (!isRunning || !timeLeft) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
      <div className="text-lg font-bold">{timeLeft}</div>
    </div>
  );
};

export default Timer;
