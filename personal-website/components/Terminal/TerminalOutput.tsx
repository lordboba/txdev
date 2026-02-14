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
            <div className="flex items-center gap-2 text-[#6C7689]">
              <span className="text-[#4ECDC4]">&#10148;</span>
              <span className="text-[#E8C468]">~</span>
              <span>{item.command}</span>
            </div>
          )}
          <div className="text-[#E8ECF1] leading-relaxed break-words">
            {item.output}
          </div>
        </div>
      ))}
    </div>
  );
};
