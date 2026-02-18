'use client';

import { useState } from 'react';
import { Terminal } from './Terminal';

export const HomeTerminal = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div
      data-terminal-shell
      className="h-[400px] w-full rounded-xl overflow-hidden border border-terminal-border shadow-card transition-[box-shadow,border-color] duration-500 ease-out"
    >
      <Terminal
        isFullScreen={isFullScreen}
        onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
      />
    </div>
  );
};
