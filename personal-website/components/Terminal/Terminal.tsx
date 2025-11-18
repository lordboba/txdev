"use client";

import { useEffect, useRef } from "react";
import { useTerminal } from "./useTerminal";
import { TerminalInput } from "./TerminalInput";
import { TerminalOutput } from "./TerminalOutput";

export const Terminal = ({ isFullScreen, onToggleFullScreen }: { isFullScreen?: boolean; onToggleFullScreen?: () => void }) => {
  const { history, handleCommand, isBooting } = useTerminal();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isBooting]);

  // Handle Escape key to exit full screen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (isFullScreen && e.key === "Escape" && onToggleFullScreen) {
        onToggleFullScreen();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullScreen, onToggleFullScreen]);

  const containerClass = isFullScreen
    ? "fixed inset-0 z-50 h-screen w-screen bg-[#0f0f0f]"
    : "relative h-full w-full rounded-2xl bg-[#0f0f0f] border border-divider";

  const textClass = isFullScreen ? "text-sm sm:text-base" : "text-xs sm:text-sm";
  const paddingClass = isFullScreen ? "p-4 sm:p-6" : "p-3 sm:p-4";

  return (
    <div 
      className={`${containerClass} ${textClass} text-[#f0f0f0] font-mono flex flex-col overflow-hidden transition-all duration-300`} 
      onClick={() => document.querySelector("input")?.focus()}
    >
      {/* Terminal Header / Controls */}
      <div className="flex items-center justify-between bg-[#1a1a1a] px-4 py-2 border-b border-[#333] shrink-0">
        <div className="flex gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <div className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted hidden sm:inline-block">guest@tyler-portfolio: ~</span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleFullScreen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFullScreen();
              }}
              className="text-muted transition hover:text-foreground"
              title={isFullScreen ? "Exit Full Screen (Esc)" : "Enter Full Screen"}
            >
              {isFullScreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
              )}
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${paddingClass} scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent`}>
        <div className="mx-auto max-w-4xl">
          <TerminalOutput history={history} />
          
          {!isBooting && (
            <TerminalInput onCommand={handleCommand} />
          )}
          
          {isBooting && (
            <div className="mt-2 animate-pulse text-green-500">
              System initializing...
            </div>
          )}
          
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

