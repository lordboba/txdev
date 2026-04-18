import { useState, useEffect, useCallback, ReactNode } from 'react';
import { HistoryItem, INITIAL_FILES } from './types';
import { ASCII_ART, WELCOME_MESSAGE } from './ascii';
import { AnimatedLines } from './AnimatedLines';
import {
  experiences,
  projects,
  contactLinks,
  quickFacts,
} from '../../lib/siteData';

type UseTerminalOptions = {
  onExit?: () => boolean | void;
};

export const useTerminal = ({ onExit }: UseTerminalOptions = {}) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const bootSequence = async () => {
      // Simulate boot delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const initialOutput = (
        <div className="terminal-boot whitespace-pre overflow-x-auto no-scrollbar text-[10px] font-bold leading-[1.1] sm:text-xs">
          {ASCII_ART}
          <br />
          {WELCOME_MESSAGE.map((line, i) => (
            <div key={i} className="text-sm sm:text-base">
              {line}
            </div>
          ))}
          <br />
        </div>
      );

      setHistory([
        {
          id: 'boot',
          command: '',
          output: initialOutput,
        },
      ]);
      setIsBooting(false);
    };

    bootSequence();
  }, []);

  const addToHistory = useCallback((command: string, output: ReactNode) => {
    setHistory((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        command,
        output,
      },
    ]);
  }, []);

  const handleCommand = useCallback(
    (cmdString: string) => {
      const trimmedCmd = cmdString.trim();
      if (!trimmedCmd) return true;

      const parts = trimmedCmd.split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      let output: ReactNode;
      let isValid = true;

      switch (command) {
        case 'help':
          output = (
            <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[120px_1fr] gap-x-2 sm:gap-x-4 gap-y-2">
              <span className="terminal-accent">about</span>
              <span>Who is Tyler?</span>
              <span className="terminal-accent">projects</span>
              <span>View my work</span>
              <span className="terminal-accent">experience</span>
              <span>View my career history</span>
              <span className="terminal-accent">contact</span>
              <span>Get in touch</span>
              <span className="terminal-accent">exit</span>
              <span>Return to the main site</span>
              <span className="terminal-accent">ls</span>
              <span>List files</span>
              <span className="terminal-accent">cat &lt;file&gt;</span>
              <span>Read a file</span>
              <span className="terminal-accent">echo &lt;text&gt;</span>
              <span>Print text</span>
              <span className="terminal-accent">ascii</span>
              <span>Show splash art</span>
              <span className="terminal-accent">clear</span>
              <span>Clear terminal</span>
            </div>
          );
          break;

        case 'about':
        case 'whoami':
          output = (
            <AnimatedLines
              lines={[
                { text: "Hello! I'm Tyler Xiao." },
                ...quickFacts.map((fact) => ({
                  text: `${fact.label}: ${fact.value}`,
                  className: 'terminal-soft',
                })),
              ]}
            />
          );
          break;

        case 'projects':
          output = (
            <AnimatedLines
              lines={[
                {
                  text: "Here are some things I've built:",
                  className: 'terminal-muted',
                },
                ...projects.map((project) => ({
                  text: `- ${project.title} (${project.role})`,
                  className: 'terminal-soft',
                })),
              ]}
            />
          );
          break;

        case 'experience':
          output = (
            <AnimatedLines
              lines={[
                {
                  text: 'My professional journey:',
                  className: 'terminal-muted',
                },
                ...experiences.map((exp) => ({
                  text: `- ${exp.start} - ${exp.end}: ${exp.role} @ ${exp.company}`,
                  className: 'terminal-accent',
                })),
              ]}
            />
          );
          break;

        case 'contact':
          output = (
            <div className="space-y-2">
              <p>Let&apos;s connect!</p>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                {contactLinks.map((link, i) => (
                  <div key={i} className="contents">
                    <span className="terminal-soft">{link.label}:</span>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="terminal-link hover:underline"
                    >
                      {link.href.replace('mailto:', '')}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          );
          break;

        case 'exit': {
          const didExit = onExit?.();
          output =
            didExit === false ? (
              <span className="terminal-muted">Already at the main site.</span>
            ) : (
              <span className="terminal-accent">
                Returning to the main site...
              </span>
            );
          break;
        }

        case 'ls':
          output = (
            <div className="flex gap-4">
              {Object.keys(INITIAL_FILES).map((file) => (
                <span key={file} className="terminal-soft">
                  {file}
                </span>
              ))}
            </div>
          );
          break;

        case 'echo':
          output = <span>{args.join(' ')}</span>;
          break;

        case 'ascii':
          output = (
            <div className="terminal-boot whitespace-pre overflow-x-auto no-scrollbar text-[10px] font-bold leading-[1.1] sm:text-xs">
              {ASCII_ART}
            </div>
          );
          break;

        case 'cat': {
          const fileName = args[0];
          if (!fileName) {
            output = (
              <span className="terminal-danger">
                Usage: cat &lt;filename&gt;
              </span>
            );
          } else if (fileName === 'resume.pdf') {
            const resumePath = '/resume/resume.pdf';
            // Open the actual PDF in a new tab while still printing something in-terminal.
            if (typeof window !== 'undefined') {
              window.open(resumePath, '_blank', 'noopener,noreferrer');
            }
            output = (
              <div className="space-y-1">
                <div className="terminal-accent">
                  Opening resume in a new tab...
                </div>
                <a
                  href={resumePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="terminal-link hover:underline"
                >
                  Download resume.pdf
                </a>
              </div>
            );
          } else if (INITIAL_FILES[fileName]) {
            output = (
              <div className="terminal-output whitespace-pre-wrap">
                {INITIAL_FILES[fileName].content}
              </div>
            );
          } else {
            output = (
              <span className="terminal-danger">
                cat: {fileName}: No such file or directory
              </span>
            );
          }
          break;
        }

        case 'clear':
          setHistory([]);
          return true; // Return early to avoid adding 'clear' to history

        case 'pwd':
          output = <span>/home/guest</span>;
          break;

        default:
          isValid = false;
          output = (
            <span className="terminal-danger">
              Command not found: {command}. Type{' '}
              <span className="terminal-accent">help</span> for list.
            </span>
          );
      }

      addToHistory(trimmedCmd, output);
      return isValid;
    },
    [addToHistory, onExit],
  );

  return {
    history,
    handleCommand,
    isBooting,
  };
};
