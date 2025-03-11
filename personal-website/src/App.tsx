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
    <div className="font-sans bg-gray-100 text-gray-900">
      <nav className="bg-white py-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center px-4">
          <div className="flex items-center">
            
            <a href="/resume" className="text-gray-700 hover:text-blue-600 px-4 cursor-pointer no-underline">Resume</a>
            <button
              onClick={() => setCalendlyLoaded(true)}
              className="btn btn-primary font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Coffee Chat
            </button>
          </div>
          <button 
              onClick={toggleDarkMode} 
              className="theme-toggle mr-4"
              aria-label="Toggle dark mode"
            >
              {darkMode ? '🌞' : '🌙'}
            </button>
        </div>
      </nav>

      <main className="container mx-auto my-10 px-4">
        {/* Hero Section */}
        <section className="py-12">
          <center>
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Hi, I'm Tyler Xiao</h1>
            <p className="text-xl text-gray-700 mb-8">Software Developer | Building cool things with code.</p>
            <div className="bg-gray-200 border-2 border-dashed rounded-full w-32 h-32 mx-auto mb-4" />
            <p className="text-gray-600">Passionate developer with a knack for creating efficient and user-friendly applications. I love learning new technologies and solving complex problems.</p>
          </div>
          </center>
        </section>

        {/* Skills Section */}
        <section className="py-8">
          <h2 className="text-2xl font-bold text-center mb-6">Skills</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {skills.map((skill) => (
              <span key={skill} className="bg-blue-100 text-blue-800 text-sm font-medium px-4 py-1 rounded-full">
                {skill}
              </span>
            ))}
          </div>
        </section>

        {/* Projects Section */}
        <section className="py-8">
          <h2 className="text-2xl font-bold text-center mb-6">Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div key={project.title} className="card p-6">
                <div className="card-image-container mb-4">
                  {project.imageUrl ? (
                    <img src={project.imageUrl} alt={project.title} className="w-full h-40 object-cover rounded-md" />
                  ) : (
                    <div className="bg-gray-200 border-2 border-dashed border-gray-500 rounded-xl w-full h-40 flex items-center justify-center">
                      <span className="text-gray-500 font-medium">Project Image</span>
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-semibold mb-2">{project.title}</h3>
                <p className="text-gray-700 mb-4">{project.description}</p>
                <a href={project.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary no-underline">
                  View Project
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Calendly Section */}
        <section className="py-8">
          <center>
            <h2 className="text-2xl font-bold text-center mb-6">Schedule a Coffee Chat</h2>
          
          <div className="flex justify-center">
            {calendlyLoaded ? (
              <div className="btn btn-primary font-bold py-2 px-4 rounded inline-block cursor-pointer">
                Click here to schedule!
              </div>
            ) : (
              <p className="text-gray-700 text-center">Click the "Coffee Chat" button in the navigation to schedule.</p>
            )}
          </div>
          </center>
        </section>
      </main>

      <footer className="bg-gray-200 py-6 mt-10">
        <br></br>
        <center>
        <div className="container mx-auto text-center text-gray-700">
          <p>&copy; {new Date().getFullYear()} Tyler Xiao. All rights reserved.</p>
          <div className="mt-2">
            <a href="https://www.linkedin.com/in/tyler-xiao" className="mx-2 hover:text-blue-600 no-underline">LinkedIn | </a>
            <a href="https://github.com/lordboba/" className="mx-2 hover:text-blue-600 no-underline">GitHub | </a>
            <a href="https://bsky.app/profile/txiaotech.bsky.social" className="mx-2 hover:text-blue-600 no-underline">Bluesky</a>
          </div>
        </div>
        </center>
        <br></br>
        <br></br>
      </footer>
    </div>
  );
}

export default App;
