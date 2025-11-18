"use client";

import { useEffect, useRef } from "react";
import { useTerminal } from "./useTerminal";
import { TerminalInput } from "./TerminalInput";
import { TerminalOutput } from "./TerminalOutput";

export const Terminal = () => {
  const { history, handleCommand, isBooting } = useTerminal();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isBooting]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f0f0f0] p-4 sm:p-8 font-mono text-sm sm:text-base overflow-y-auto" onClick={() => document.querySelector("input")?.focus()}>
      <div className="max-w-4xl mx-auto">
        <TerminalOutput history={history} />
        
        {!isBooting && (
          <TerminalInput onCommand={handleCommand} />
        )}
        
        {isBooting && (
          <div className="animate-pulse text-green-500 mt-2">
            System initializing...
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

