import { useState, useEffect } from 'react';
import './App.css';

const skills = [
  'C++',
  'Python',
  'Java',
  'Swift',
  'React',
  'TypeScript',
  'CSS',
  'Flask',
  'Node.js',
  'PostgreSQL',
  'MongoDB'
];

const projects = [
  {
    title: 'Project 1',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    link: '#',
    imageUrl: '',
  },
  {
    title: 'Project 2',
    description: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    link: '#',
    imageUrl: '',
  },
  {
    title: 'Project 3',
    description: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
    link: '#',
    imageUrl: '',
  },
];

// This is a test to ensure Tailwind is working
function App() {
  const [calendlyLoaded, setCalendlyLoaded] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Check for saved theme preference or use system preference
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    // Update data-theme attribute when darkMode changes
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="font-sans bg-theme-primary text-theme-primary app-container">
      <nav className="app-navbar bg-theme-secondary shadow-md">
        <div className="container mx-auto flex justify-between items-center px-4 py-3">
          <div className="flex items-center space-x-4">
            <a href="/resume" className="nav-link text-theme-secondary hover:text-theme-accent px-3 py-2 no-underline rounded-md">Resume</a>
            <button
              onClick={() => setCalendlyLoaded(true)}
              className="app-button app-button-primary"
            >
              Coffee Chat
            </button>
          </div>
          <button 
              onClick={toggleDarkMode} 
              className="theme-toggle text-theme-secondary hover:text-theme-accent p-2 rounded-md"
              aria-label="Toggle dark mode"
            >
              {darkMode ? '🌞' : '🌙'}
            </button>
        </div>
      </nav>

      <main className="container mx-auto my-10 px-4 space-y-16">
        {/* Hero Section */}
        <section className="hero-section text-center py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Hi, I'm Tyler Xiao</h1>
          <p className="text-xl text-theme-secondary mb-8">Software Developer | Building cool things with code.</p>
          <div className="profile-image-placeholder bg-theme-accent w-32 h-32 md:w-40 md:h-40 mx-auto mb-6 rounded-full" />
          <p className="text-lg text-theme-muted max-w-2xl mx-auto">Passionate developer with a knack for creating efficient and user-friendly applications. I love learning new technologies and solving complex problems.</p>
        </section>

        {/* Skills Section */}
        <section className="skills-section py-8">
          <h2 className="section-title text-3xl font-bold text-center mb-8">Skills</h2>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {skills.map((skill) => (
              <span key={skill} className="skill-tag bg-theme-accent-subtle text-theme-accent-strong text-sm font-medium px-4 py-2 rounded-full">
                {skill}
              </span>
            ))}
          </div>
        </section>

        {/* Projects Section */}
        <section className="projects-section py-8">
          <h2 className="section-title text-3xl font-bold text-center mb-8">Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div key={project.title} className="project-card bg-theme-secondary p-6 rounded-lg shadow-card">
                <div className="project-image-placeholder bg-theme-accent w-full h-48 mb-4 rounded-md flex items-center justify-center">
                  {project.imageUrl ? (
                    <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover rounded-md" />
                  ) : (
                    <span className="text-theme-muted font-medium">Project Image</span>
                  )}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-theme-primary">{project.title}</h3>
                <p className="text-theme-secondary mb-4 text-sm">{project.description}</p>
                <a href={project.link} target="_blank" rel="noopener noreferrer" className="app-button app-button-secondary no-underline">
                  View Project
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Calendly Section */}
        <section className="calendly-section text-center py-8">
          <h2 className="section-title text-3xl font-bold mb-6">Schedule a Coffee Chat</h2>
          <div className="flex justify-center">
            {calendlyLoaded ? (
              <div className="app-button app-button-primary inline-block cursor-pointer">
                Click here to schedule!
              </div>
            ) : (
              <p className="text-theme-secondary">Click the "Coffee Chat" button in the navigation to schedule.</p>
            )}
          </div>
        </section>
      </main>

      <footer className="app-footer bg-theme-accent py-8 mt-12">
        <div className="container mx-auto text-center text-theme-muted">
          <p className="text-sm">&copy; {new Date().getFullYear()} Tyler Xiao. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <a href="https://www.linkedin.com/in/tyler-xiao" className="footer-link hover:text-theme-accent no-underline">LinkedIn</a>
            <a href="https://github.com/lordboba/" className="footer-link hover:text-theme-accent no-underline">GitHub</a>
            <a href="https://bsky.app/profile/txiaotech.bsky.social" className="footer-link hover:text-theme-accent no-underline">Bluesky</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
