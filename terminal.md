# Terminal Interface Implementation Plan

## Overview
This document outlines the plan to add an interactive "terminal" interface to the personal website. The terminal will serve as an alternative, geek-friendly way to navigate and explore Tyler Xiao's portfolio, projects, and background.

## Goals
1.  **Authentic Feel**: Use a monospace font, correct color scheme, and typing effects to mimic a real terminal.
2.  **Interactive**: Users can type commands to get information.
3.  **Informative**: specific commands will elaborate on personal projects and experience.
4.  **Visual Appeal**: Display ASCII art on "boot".

## Technical Stack
-   **Framework**: Next.js (React)
-   **Styling**: Tailwind CSS (v4)
-   **Language**: TypeScript

## Features

### 1. Boot Sequence
-   Display ASCII art of "Tyler Xiao".
-   Show "system initialization" messages (fake loading lines).
-   Display welcome message and available commands (hint: type `help`).

### 2. Core Terminal Component
-   **Input Area**: A blinking cursor command line where the user types.
-   **History**: A scrollable area showing previous commands and their outputs.
-   **Font**: Use a font like `Fira Code`, `Courier New`, or a web-safe monospace font.

### 3. Command System
The system will parse user input and respond to specific keywords.

#### Proposed Commands:
-   `help`: Lists all available commands.
-   `about`: Displays a bio (similar to `whoami`).
-   `projects`: Lists projects.
    -   Support arguments like `projects <name>` or interactive selection to see details.
-   `experience`: Lists work experience.
-   `contact`: Shows contact info (email, links).
-   `clear`: Clears the terminal screen.
-   `ls`: Fun easter egg, maybe lists "files" like `resume.pdf`.
-   `cat <file>`: Reads the content of "files".

### 4. UI/UX Details
-   **Theme**: Dark background (`#0f0f0f` or similar), bright green or amber text.
-   **Responsiveness**: Ensure the terminal is usable on mobile devices (virtual keyboard handling).
-   **Focus**: Clicking anywhere in the terminal window should focus the hidden input field.

## Implementation Roadmap

### Phase 1: Setup & Structure
1.  Create `app/terminal/page.tsx` (or a modal component if preferred).
2.  Create `components/Terminal/Terminal.tsx` main component.
3.  Define TypeScript interfaces for `Command`, `HistoryItem`.

### Phase 2: Core Logic
1.  Implement state for `input` (string) and `history` (array of lines).
2.  Create a `commandHandler` function to parse input string and return output (text or React components).
3.  Implement the "Boot" `useEffect` to load the ASCII art and welcome message.
4.  Create a tab-based autocomplete that will either autocomplete the name of the command or name of the file.

### Phase 3: Styling & Polish
1.  Apply Tailwind classes for colors and typography.
2.  Add a CSS animation for the blinking cursor.
3.  Add a "typing" effect hook so output appears character-by-character.
4.  Add 'Type "help" to get started.' in order to prompt users for help.

## ASCII Art Concept
```text
  _______      _            __   __  _                  
 |__   __|    | |           \ \ / / (_)                 
    | |  _   _| | ___ _ __   \ V /   _  __ _  ___       
    | | | | | | |/ _ \ '__|   > <   | |/ _` |/ _ \      
    | | | |_| | |  __/ |     / . \  | | (_| | (_) |     
    |_|  \__, |_|\___|_|    /_/ \_\ |_|\__,_|\___/      
          __/ |                                         
         |___/                                          
```
*(To be refined/generated)*

## File Structure
```
personal-website/
  app/
    terminal/
      page.tsx
  components/
    Terminal/
      Terminal.tsx
      TerminalInput.tsx
      TerminalOutput.tsx
      useTerminal.ts (hook for logic)
      ascii.ts (art constants)
```

