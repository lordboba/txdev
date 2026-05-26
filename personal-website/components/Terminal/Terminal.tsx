'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTerminal } from './useTerminal';
import { TerminalInput } from './TerminalInput';
import { TerminalOutput } from './TerminalOutput';

export const Terminal = ({
  isFullScreen,
  onToggleFullScreen,
  autoFocusInput = true,
}: {
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  autoFocusInput?: boolean;
}) => {
  const { push } = useRouter();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showTip, setShowTip] = useState(true);
  const handleExitCommand = useCallback(() => {
    if (pathname === '/terminal') {
      push('/');
      return true;
    }

    if (isFullScreen && onToggleFullScreen) {
      onToggleFullScreen();
      return true;
    }

    if (pathname !== '/') {
      push('/');
      return true;
    }

    return false;
  }, [isFullScreen, onToggleFullScreen, pathname, push]);
  const { history, handleCommand } = useTerminal({
    onExit: handleExitCommand,
  });

  const quickCommands = ['about', 'projects', 'experience', 'help'] as const;

  // Keep the scroll position at the bottom of the terminal without moving the page
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [history]);

  // Handle Escape key to exit full screen
  const handleToggleFullScreen = useEffectEvent(() => {
    onToggleFullScreen?.();
  });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (isFullScreen && e.key === 'Escape') {
        handleToggleFullScreen();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullScreen]);

  const dismissTip = () => {
    setShowTip(false);
  };

  const containerClass = isFullScreen
    ? 'fixed inset-0 z-50 h-screen w-screen bg-terminal-bg'
    : 'relative h-full w-full rounded-sm bg-terminal-bg border border-terminal-border';

  const textClass = isFullScreen
    ? 'text-sm sm:text-base'
    : 'text-xs sm:text-sm';
  const paddingClass = isFullScreen ? 'p-4 sm:p-6' : 'p-3 sm:p-4';

  return (
    <div
      role="button"
      tabIndex={-1}
      className={`${containerClass} ${textClass} terminal-root font-mono flex flex-col overflow-hidden transition-all duration-400`}
      onClick={(e) => {
        const input = e.currentTarget.querySelector('input');
        if (input) (input as HTMLElement).focus();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const input = e.currentTarget.querySelector('input');
          if (input) (input as HTMLElement).focus();
        }
      }}
    >
      {/* Terminal Header / Controls */}
      <div className="flex items-center justify-between bg-terminal-bar px-4 py-2.5 border-b border-terminal-border shrink-0">
        <div className="flex gap-2">
          <div className="size-2.5 rounded-full border border-[color:color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]" />
          <div className="size-2.5 rounded-full border border-[color:color-mix(in_srgb,var(--accent)_15%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_20%,transparent)]" />
          <div className="size-2.5 rounded-full border border-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="terminal-muted hidden text-xs sm:inline-block">
            guest@tyler-portfolio: ~
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleFullScreen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFullScreen();
              }}
              className="terminal-muted transition hover:text-accent"
              title={
                isFullScreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen'
              }
            >
              {isFullScreen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                  <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                  <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                  <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h6v6" />
                  <path d="M9 21H3v-6" />
                  <path d="M21 3l-7 7" />
                  <path d="M3 21l7-7" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      <div
        className={`flex-1 overflow-y-auto ${paddingClass} scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent`}
        ref={scrollContainerRef}
      >
        <div className="mx-auto max-w-4xl">
          <div className={`terminal-tip ${showTip ? 'is-visible' : ''}`}>
            Tip: try <code>help</code> or <code>cat resume.pdf</code>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {quickCommands.map((command) => (
              <button
                key={command}
                type="button"
                className="terminal-command-chip"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissTip();
                  handleCommand(command);
                }}
              >
                {command}
              </button>
            ))}
          </div>

          <TerminalOutput history={history} />

          <TerminalInput
            onCommand={handleCommand}
            onCommandStart={dismissTip}
            autoFocus={autoFocusInput}
          />
        </div>
      </div>
    </div>
  );
};
