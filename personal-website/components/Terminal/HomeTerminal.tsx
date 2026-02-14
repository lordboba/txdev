'use client';

import { useState } from 'react';
import { Terminal } from './Terminal';

export const HomeTerminal = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-terminal-border shadow-card">
      <Terminal
        isFullScreen={isFullScreen}
        onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
      />
    </div>
  );
};
