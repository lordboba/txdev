import { HistoryItem } from "./types";

interface TerminalOutputProps {
  history: HistoryItem[];
}

export const TerminalOutput = ({ history }: TerminalOutputProps) => {
  return (
    <div className="space-y-2 mb-4">
      {history.map((item) => (
        <div key={item.id} className="space-y-1">
          {item.command && (
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-green-500">➜</span>
              <span className="text-blue-400">~</span>
              <span>{item.command}</span>
            </div>
          )}
          <div className="text-gray-200 leading-relaxed break-words">
            {item.output}
          </div>
        </div>
      ))}
    </div>
  );
};

