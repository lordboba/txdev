'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { HomeTerminal } from '@/components/Terminal/HomeTerminal';
import { TetrahedronField } from '@/components/TetrahedronField';

type HeroMode = 'headline' | 'terminal';

export function HomeHero() {
  const [heroMode, setHeroMode] = useState<HeroMode>('headline');
  const showHeadline = heroMode === 'headline';

  return (
    <section className="hero-section relative flex flex-col items-start gap-8 overflow-hidden sm:gap-12">
      <div className="hero-mode-bar hero-stage hero-stage-1">
        <span className="hero-mode-label">hero mode</span>
        <div
          className="hero-mode-pill"
          role="tablist"
          aria-label="Hero view mode"
        >
          <button
            id="hero-mode-headline"
            role="tab"
            type="button"
            aria-selected={showHeadline}
            aria-controls="hero-view-headline"
            className={`hero-mode-btn ${showHeadline ? 'is-active' : ''}`}
            onClick={() => setHeroMode('headline')}
          >
            Headline
          </button>
          <button
            id="hero-mode-terminal"
            role="tab"
            type="button"
            aria-selected={!showHeadline}
            aria-controls="hero-view-terminal"
            className={`hero-mode-btn ${showHeadline ? '' : 'is-active'}`}
            onClick={() => setHeroMode('terminal')}
          >
            ???
          </button>
        </div>
      </div>

      {showHeadline ? (
        <div
          id="hero-view-headline"
          role="tabpanel"
          aria-labelledby="hero-mode-headline"
          className="relative z-[1] flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-12"
        >
          <div className="flex max-w-3xl flex-col gap-6">
            <div className="space-y-4">
              <p className="hero-stage hero-stage-2 font-mono text-sm text-muted">
                {"// hi, i'm tyler"}
              </p>
              <h1 className="hero-stage hero-stage-3 font-display text-5xl font-bold tracking-tight sm:text-7xl">
                I build <span className="hero-text-highlight">Agents</span> and
                backend systems.
              </h1>
            </div>
            <p className="hero-stage hero-stage-4 max-w-2xl text-lg text-muted leading-relaxed">
              CS student at UCLA. From trust &amp; safety automations to
              multiplayer card games, I like solving challenging problems,
              building efficient backend systems, and automating repetitive
              tasks.
            </p>
            <div className="hero-stage hero-stage-4 flex flex-wrap gap-4">
              <Link
                href="#contact"
                className="btn-shimmer accent-action inline-flex items-center justify-center gap-2 rounded-sm px-7 py-3 font-mono text-sm font-semibold shadow-[0_2px_12px_rgba(232,196,104,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(232,196,104,0.3)]"
              >
                <span>&#9654;</span> Contact
              </Link>
              <Link
                href="/past-experience"
                className="inline-flex items-center justify-center rounded-sm border border-dashed border-divider px-7 py-3 font-mono text-sm font-semibold text-muted transition hover:border-accent hover:text-foreground"
              >
                View Past Experience
              </Link>
            </div>
          </div>

          <div className="hero-visual-stack w-full max-w-[360px] lg:w-[360px]">
            <div
              data-pointer-profile
              className="hero-stage hero-stage-4 profile-halo-shell relative h-56 w-56 sm:h-72 sm:w-72 flex-shrink-0 rounded-full border-2 border-divider"
            >
              <div className="h-full w-full overflow-hidden rounded-full">
                <Image
                  src="/pfp.JPG"
                  alt="Tyler Xiao"
                  width={400}
                  height={400}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <span className="profile-badge">sidequesting</span>
            </div>
            <div className="hero-stage hero-stage-4 hero-tetra-wrap">
              <TetrahedronField />
            </div>
          </div>
        </div>
      ) : (
        <div
          id="hero-view-terminal"
          role="tabpanel"
          aria-labelledby="hero-mode-terminal"
          className="hero-terminal-panel hero-stage hero-stage-2 w-full"
        >
          <div className="hero-terminal-meta">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
              secret mode unlocked
            </p>
            <p className="font-mono text-sm text-muted">
              Explore with commands like <code>help</code>, <code>about</code>,
              and <code>projects</code>.
            </p>
          </div>
          <div className="hero-terminal-wrap w-full">
            <HomeTerminal className="h-[420px] sm:h-[470px]" />
          </div>
        </div>
      )}
    </section>
  );
}
