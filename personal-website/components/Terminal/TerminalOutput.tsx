import { HistoryItem } from './types';

interface TerminalOutputProps {
  history: HistoryItem[];
}

export const TerminalOutput = ({ history }: TerminalOutputProps) => {
  return (
    <div className="space-y-2 mb-4">
      {history.map((item) => (
        <div key={item.id} className="space-y-1">
          {item.command && (
            <div className="terminal-command-line flex items-center gap-2">
              <span className="terminal-accent">&#10148;</span>
              <span className="terminal-soft">~</span>
              <span>{item.command}</span>
            </div>
          )}
          <div className="terminal-output break-words leading-relaxed">
            {item.output}
          </div>
        </div>
      ))}
    </div>
  );
};
