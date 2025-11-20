'use client';

import { useState } from 'react';
import { Terminal } from './Terminal';

export const HomeTerminal = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-divider shadow-sm">
      <Terminal
        isFullScreen={isFullScreen}
        onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
      />
    </div>
  );
};
