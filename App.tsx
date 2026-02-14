import React, { useEffect, useRef } from 'react';
import { useLiveGemini } from './hooks/useLiveGemini';
import { ConnectionState } from './types';
import Visualizer from './components/Visualizer';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
);

const StopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);

const App: React.FC = () => {
  const { connect, disconnect, connectionState, videoRef, canvasRef, volume, error } = useLiveGemini();
  
  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;
  
  return (
    <div className="relative w-full h-full flex flex-col bg-stone-900">
      
      {/* Header / Branding */}
      <div className="absolute top-0 left-0 w-full p-6 z-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <h1 className="text-2xl font-light tracking-wide text-stone-100 flex items-center gap-2">
          <span className="text-teal-400"><EyeIcon /></span>
          Reality Witness
        </h1>
        <p className="text-stone-300 text-sm mt-1 max-w-md opacity-80">
          I am here to confirm what is real around you. Show me your surroundings.
        </p>
      </div>

      {/* Main Video Area */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center bg-black">
        {/* Hidden Canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* The Live Video Feed */}
        <video 
          ref={videoRef} 
          className={`w-full h-full object-cover transition-opacity duration-1000 ${isConnected ? 'opacity-100' : 'opacity-30 grayscale'}`} 
          autoPlay 
          playsInline 
          muted 
        />

        {/* Start Overlay */}
        {!isConnected && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 backdrop-blur-sm">
            <button 
              onClick={connect}
              className="group flex flex-col items-center gap-4 transition-transform hover:scale-105"
            >
              <div className="w-20 h-20 rounded-full bg-teal-600/20 border border-teal-500/50 flex items-center justify-center group-hover:bg-teal-500/30 transition-colors shadow-[0_0_30px_rgba(20,184,166,0.2)]">
                <MicIcon />
              </div>
              <span className="text-stone-200 text-lg font-light tracking-wider">Tap to Connect</span>
            </button>
          </div>
        )}

        {/* Connecting State */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
              <span className="text-teal-400 text-sm tracking-widest uppercase animate-pulse">Establishing Connection...</span>
            </div>
          </div>
        )}

        {/* Active Session Visualizers */}
        {isConnected && (
          <div className="absolute bottom-32 left-0 w-full flex justify-center items-end pointer-events-none gap-4 px-4 z-20">
             
             {/* Model Output (Witness) */}
             <div className={`transition-all duration-500 transform ${volume.output > 0.01 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
                <Visualizer volume={volume.output} color="teal" label="Witness" />
             </div>

             {/* User Input (You) */}
             <div className={`transition-all duration-500 transform ${volume.input > 0.01 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
                <Visualizer volume={volume.input} color="rose" label="You" />
             </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      {isConnected && (
        <div className="absolute bottom-10 left-0 w-full flex justify-center z-30 pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-md rounded-full px-8 py-4 border border-white/10 flex items-center gap-8 shadow-2xl">
            
            <div className="flex flex-col items-center gap-1">
               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
               <span className="text-[10px] text-stone-400 uppercase tracking-wider">Live</span>
            </div>

            <button 
              onClick={disconnect}
              className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-200 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
              aria-label="End Session"
            >
              <StopIcon />
            </button>
          </div>
        </div>
      )}

      {/* Connection Error Message */}
      {connectionState === ConnectionState.ERROR && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-red-100 px-6 py-4 rounded-xl backdrop-blur-md shadow-2xl z-50 max-w-sm text-center">
          <div className="flex flex-col items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="font-semibold">Connection Failed</p>
          </div>
          <p className="text-sm mt-2 opacity-90 leading-relaxed">
            {error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError'
               ? "Access to camera or microphone was denied. Please allow permissions in your browser settings."
               : error?.message?.includes("403") || error?.message?.includes("API Key")
                 ? "Authentication failed. Please check your API key."
                 : "Unable to establish connection. Please check your internet or try again."}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-xs font-medium transition-colors w-full"
          >
            Reload Page
          </button>
        </div>
      )}
    </div>
  );
};

export default App;