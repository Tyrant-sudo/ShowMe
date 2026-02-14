import React from 'react';

interface VisualizerProps {
  volume: number; // 0 to 1
  color: 'teal' | 'rose';
  label: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ volume, color, label }) => {
  // Create 5 bars for the waveform
  const bars = [0, 1, 2, 3, 4].map((i) => {
    // Wave shape logic: center bars (index 2) are naturally taller
    // i: 0 -> 0.6, 1 -> 0.8, 2 -> 1.0, 3 -> 0.8, 4 -> 0.6
    const shapeFactor = 0.6 + (0.4 * (1 - Math.abs(i - 2) / 2));
    
    // Add dynamic jitter for liveness
    const noise = 0.8 + Math.random() * 0.4; 
    
    // Calculate height: minimum 15%, max 100%
    const height = Math.min(100, Math.max(15, volume * 100 * shapeFactor * noise));
    
    return (
      <div
        key={i}
        className={`w-2 md:w-3 mx-0.5 rounded-full transition-all duration-75 ease-out ${
          color === 'teal' 
            ? 'bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.8)]' 
            : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
        }`}
        style={{ height: `${height}%` }}
      />
    );
  });

  return (
    <div className="flex flex-col items-center justify-end h-24 min-w-[100px] bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-xl">
      <div className="h-12 flex items-center justify-center mb-2 w-full">
        {bars}
      </div>
      <span className={`text-[10px] font-bold tracking-widest uppercase whitespace-nowrap ${
        color === 'teal' ? 'text-teal-200' : 'text-rose-200'
      }`}>
        {label}
      </span>
    </div>
  );
};

export default Visualizer;