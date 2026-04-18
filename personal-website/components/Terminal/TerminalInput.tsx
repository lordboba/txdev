import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { CommandType, INITIAL_FILES } from './types';

interface TerminalInputProps {
  onCommand: (command: string) => boolean;
  onCommandStart?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

const AVAILABLE_COMMANDS: CommandType[] = [
  'help',
  'about',
  'projects',
  'experience',
  'contact',
  'exit',
  'clear',
  'ls',
  'cat',
  'pwd',
  'whoami',
  'echo',
  'ascii',
];

const FILES = Object.keys(INITIAL_FILES);

export const TerminalInput = ({
  onCommand,
  onCommandStart,
  disabled,
  autoFocus = true,
}: TerminalInputProps) => {
  const [input, setInput] = useState('');
  const [isInvalid, setIsInvalid] = useState(false);
  const [isPromptFlashing, setIsPromptFlashing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled && autoFocus) {
      inputRef.current?.focus();
    }
  }, [disabled, autoFocus]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = input.trim();
      if (trimmed) {
        onCommandStart?.();
      }
      const isValid = onCommand(input);
      if (trimmed && !isValid) {
        setIsInvalid(false);
        setIsPromptFlashing(false);
        requestAnimationFrame(() => {
          setIsInvalid(true);
          setIsPromptFlashing(true);
        });
        window.setTimeout(() => {
          setIsInvalid(false);
          setIsPromptFlashing(false);
        }, 220);
      }
      setInput('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabCompletion();
    }
  };

  const handleTabCompletion = () => {
    const parts = input.split(' ');

    // Complete command
    if (parts.length === 1) {
      const current = parts[0].toLowerCase();
      const matches = AVAILABLE_COMMANDS.filter((cmd) =>
        cmd.startsWith(current),
      );
      if (matches.length === 1) {
        setInput(matches[0] + ' ');
      }
    }
    // Complete filename (for cat)
    else if (parts.length === 2 && parts[0] === 'cat') {
      const current = parts[1];
      const matches = FILES.filter((file) => file.startsWith(current));
      if (matches.length === 1) {
        setInput(`cat ${matches[0]}`);
      }
    }
  };

  return (
    <div
      className={`terminal-input-row flex items-center gap-2 font-mono ${
        isInvalid ? 'is-invalid' : ''
      }`}
    >
      <span
        className={`terminal-prompt-arrow terminal-accent ${
          isPromptFlashing ? 'is-flashing' : ''
        }`}
      >
        &#10148;
      </span>
      <span className="terminal-soft">~</span>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="terminal-input-field flex-1 border-none bg-transparent outline-none"
        autoComplete="off"
        spellCheck="false"
      />
    </div>
  );
};
