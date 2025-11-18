import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { CommandType, INITIAL_FILES } from "./types";

interface TerminalInputProps {
  onCommand: (command: string) => void;
  disabled?: boolean;
}

const AVAILABLE_COMMANDS: CommandType[] = [
  "help",
  "about",
  "projects",
  "experience",
  "contact",
  "clear",
  "ls",
  "cat",
  "pwd",
  "whoami",
  "echo",
  "ascii",
];

const FILES = Object.keys(INITIAL_FILES);

export const TerminalInput = ({ onCommand, disabled }: TerminalInputProps) => {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus on input
  useEffect(() => {
    const handleClick = () => inputRef.current?.focus();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onCommand(input);
      setInput("");
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleTabCompletion();
    }
  };

  const handleTabCompletion = () => {
    const parts = input.split(" ");
    
    // Complete command
    if (parts.length === 1) {
      const current = parts[0].toLowerCase();
      const matches = AVAILABLE_COMMANDS.filter((cmd) =>
        cmd.startsWith(current)
      );
      if (matches.length === 1) {
        setInput(matches[0] + " ");
      }
    }
    // Complete filename (for cat)
    else if (parts.length === 2 && parts[0] === "cat") {
      const current = parts[1];
      const matches = FILES.filter((file) => file.startsWith(current));
      if (matches.length === 1) {
        setInput(`cat ${matches[0]}`);
      }
    }
  };

  return (
    <div className="flex items-center gap-2 text-lg font-mono">
      <span className="text-green-500">➜</span>
      <span className="text-blue-400">~</span>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="flex-1 bg-transparent outline-none border-none text-gray-100 placeholder-gray-600"
        autoComplete="off"
        spellCheck="false"
        autoFocus
      />
    </div>
  );
};

