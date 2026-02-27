'use client';

import { useState } from 'react';
import { Terminal } from './Terminal';

type HomeTerminalProps = {
  className?: string;
};

export const HomeTerminal = ({ className = '' }: HomeTerminalProps) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div
      data-terminal-shell
      className={`h-[400px] w-full rounded-xl overflow-hidden border border-terminal-border shadow-card transition-[box-shadow,border-color] duration-500 ease-out ${className}`}
    >
      <Terminal
        isFullScreen={isFullScreen}
        onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
        autoFocusInput={isFullScreen}
      />
    </div>
  );
};
