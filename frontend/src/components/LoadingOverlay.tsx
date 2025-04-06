import React from "react";

interface LoadingOverlayProps {
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = "Loading...",
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50">
      <div className="relative w-16 h-16 mb-4">
        <div className="absolute inset-0 border-4 border-neon-pink rounded-full animate-spin border-t-transparent"></div>
      </div>
      <p className="text-neon-pink text-xl font-medium">{message}</p>
    </div>
  );
};

export default LoadingOverlay;
