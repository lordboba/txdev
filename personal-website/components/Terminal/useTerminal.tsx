import { useState, useEffect, useCallback, ReactNode } from "react";
import { HistoryItem, INITIAL_FILES } from "./types";
import { ASCII_ART, WELCOME_MESSAGE } from "./ascii";
import { experiences, projects, contactLinks, quickFacts } from "../../lib/siteData";

export const useTerminal = () => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const bootSequence = async () => {
      // Simulate boot delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const initialOutput = (
        <div className="whitespace-pre font-bold text-green-500">
          {ASCII_ART}
          <br />
          {WELCOME_MESSAGE.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          <br />
        </div>
      );

      setHistory([
        {
          id: "boot",
          command: "",
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
      if (!trimmedCmd) return;

      const parts = trimmedCmd.split(" ");
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      let output: ReactNode;

      switch (command) {
        case "help":
          output = (
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-yellow-400">about</span>
              <span>Who is Tyler?</span>
              <span className="text-yellow-400">projects</span>
              <span>View my work</span>
              <span className="text-yellow-400">experience</span>
              <span>View my career history</span>
              <span className="text-yellow-400">contact</span>
              <span>Get in touch</span>
              <span className="text-yellow-400">ls</span>
              <span>List files</span>
              <span className="text-yellow-400">cat &lt;file&gt;</span>
              <span>Read a file</span>
              <span className="text-yellow-400">clear</span>
              <span>Clear terminal</span>
            </div>
          );
          break;

        case "about":
        case "whoami":
          output = (
            <div className="space-y-2">
              <p>Hello! I'm Tyler Xiao.</p>
              <ul className="list-disc pl-4">
                {quickFacts.map((fact, i) => (
                  <li key={i}>
                    <span className="text-blue-400 font-bold">{fact.label}:</span>{" "}
                    {fact.value}
                  </li>
                ))}
              </ul>
            </div>
          );
          break;

        case "projects":
          output = (
            <div className="space-y-4">
              <p className="text-gray-400">Here are some things I've built:</p>
              {projects.map((project, i) => (
                <div key={i} className="pl-2 border-l-2 border-blue-500">
                  <div className="flex items-baseline gap-2">
                    <a
                      href={project.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 font-bold hover:underline"
                    >
                      {project.title}
                    </a>
                    <span className="text-xs text-gray-500">({project.role})</span>
                  </div>
                  <p className="text-sm">{project.description}</p>
                  <div className="flex gap-2 mt-1">
                    {project.tech.map((t, j) => (
                      <span key={j} className="text-xs text-yellow-600 bg-yellow-900/20 px-1 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
          break;

        case "experience":
          output = (
            <div className="space-y-4">
              <p className="text-gray-400">My professional journey:</p>
              {experiences.map((exp, i) => (
                <div key={i} className="pl-2 border-l-2 border-green-500">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between">
                    <span className="font-bold text-green-400">{exp.company}</span>
                    <span className="text-xs text-gray-500">{exp.start} - {exp.end}</span>
                  </div>
                  <p className="text-sm text-gray-300">{exp.role}</p>
                  <p className="text-sm italic mt-1">{exp.summary}</p>
                </div>
              ))}
            </div>
          );
          break;

        case "contact":
          output = (
            <div className="space-y-2">
              <p>Let's connect!</p>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                {contactLinks.map((link, i) => (
                  <div key={i} className="contents">
                    <span className="text-purple-400">{link.label}:</span>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-blue-300"
                    >
                      {link.href.replace("mailto:", "")}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          );
          break;

        case "ls":
          output = (
            <div className="flex gap-4">
              {Object.keys(INITIAL_FILES).map((file) => (
                <span key={file} className="text-blue-400">
                  {file}
                </span>
              ))}
            </div>
          );
          break;

        case "cat":
          const fileName = args[0];
          if (!fileName) {
            output = <span className="text-red-400">Usage: cat &lt;filename&gt;</span>;
          } else if (INITIAL_FILES[fileName]) {
            output = (
              <div className="whitespace-pre-wrap text-gray-300">
                {INITIAL_FILES[fileName].content}
              </div>
            );
            // Easter egg for resume
            if (fileName === "resume.pdf") {
              // In a real app, this might link to the actual PDF
               // window.open("/path/to/resume.pdf", "_blank");
               output = <div className="text-yellow-400">Opening resume... (simulated)</div>;
            }
          } else {
            output = <span className="text-red-400">cat: {fileName}: No such file or directory</span>;
          }
          break;

        case "clear":
          setHistory([]);
          return; // Return early to avoid adding 'clear' to history

        case "pwd":
          output = <span>/home/guest</span>;
          break;

        default:
          output = (
            <span className="text-red-400">
              Command not found: {command}. Type <span className="text-yellow-400">help</span> for list.
            </span>
          );
      }

      addToHistory(trimmedCmd, output);
    },
    [addToHistory]
  );

  return {
    input,
    setInput,
    history,
    handleCommand,
    isBooting,
  };
};

