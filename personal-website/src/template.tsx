import React, { useState } from 'react';
import { PopupWidget } from 'react-calendly';
import Link from 'next/link';

const skills = [
  'React',
  'Next.js',
  'TypeScript',
  'Tailwind CSS',
  'Node.js',
  'GraphQL',
  'PostgreSQL',
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

const HomePage = () => {
  const [calendlyLoaded, setCalendlyLoaded] = useState(false);

  return (
    <div className="font-sans bg-gray-100 text-gray-900">
      <nav className="bg-white py-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center px-4">
          <Link href="/">
            <span className="font-bold text-xl cursor-pointer">Dev Portfolio</span>
          </Link>
          <div>
            <Link href="/resume">
              <span className="text-gray-700 hover:text-blue-600 px-4 cursor-pointer">Resume</span>
            </Link>
            <button
              onClick={() => setCalendlyLoaded(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Coffee Chat
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto my-10 px-4">
        {/* Hero Section */}
        <section className="py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Hi, I'm [Your Name]</h1>
            <p className="text-xl text-gray-700 mb-8">Software Developer | Building cool things with code.</p>
            <div className="bg-gray-200 border-2 border-dashed rounded-full w-32 h-32 mx-auto mb-4" />
            <p className="text-gray-600">Passionate developer with a knack for creating efficient and user-friendly applications. I love learning new technologies and solving complex problems.</p>
          </div>
        </section>

        {/* Skills Section */}
        <section className="py-8">
          <h2 className="text-2xl font-bold text-center mb-6">Skills</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {skills.map((skill) => (
              <span key={skill} className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
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
              <div key={project.title} className="bg-white rounded-lg shadow-md p-6">
                {project.imageUrl ? (
                  <img src={project.imageUrl} alt={project.title} className="w-full h-40 object-cover rounded-md mb-4" />
                ) : (
                  <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-40 mb-4 flex items-center justify-center">
                    <span className="text-gray-500">Placeholder</span>
                  </div>
                )}
                <h3 className="text-xl font-semibold mb-2">{project.title}</h3>
                <p className="text-gray-700 mb-4">{project.description}</p>
                <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  View Project
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Calendly Section */}
        <section className="py-8">
          <h2 className="text-2xl font-bold text-center mb-6">Schedule a Coffee Chat</h2>
          <div className="flex justify-center">
            {calendlyLoaded && (
              <PopupWidget
                url="https://calendly.com/your-calendly-link"
                rootElement={document.getElementById('__next')!}
                text="Click here to schedule!"
                textColor="#ffffff"
                color="#00a2ff"
              />
            )}
            {!calendlyLoaded && (
                <p className="text-gray-700 text-center">Click the "Coffee Chat" button in the navigation to schedule.</p>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-gray-200 py-6 mt-10">
        <div className="container mx-auto text-center text-gray-700">
          <p>&copy; {new Date().getFullYear()} [Your Name]. All rights reserved.</p>
          <div className="mt-2">
            <a href="#" className="mx-2 hover:text-blue-600">LinkedIn</a>
            <a href="#" className="mx-2 hover:text-blue-600">GitHub</a>
            <a href="#" className="mx-2 hover:text-blue-600">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
