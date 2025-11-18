import { ReactNode } from "react";

export type CommandType =
  | "help"
  | "about"
  | "projects"
  | "experience"
  | "contact"
  | "clear"
  | "ls"
  | "cat"
  | "pwd"
  | "whoami"
  | "echo";

export interface HistoryItem {
  id: string;
  command: string;
  output: ReactNode;
}

export interface FileSystem {
  [key: string]: {
    type: "file" | "directory";
    content?: string;
  };
}

export const INITIAL_FILES: FileSystem = {
  "resume.pdf": {
    type: "file",
    content: "Redirecting to resume...",
  },
  "README.md": {
    type: "file",
    content: "# Tyler Xiao\nWelcome to my terminal portfolio!\nFeel free to explore.",
  },
  "secret.txt": {
    type: "file",
    content: "You found the secret file! Here's a cookie: 🍪",
  },
};

