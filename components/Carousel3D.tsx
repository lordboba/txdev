'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Image from 'next/image';

export type Section = {
  id: string;
  label: string;
  icon: string;
  visual: 'photo' | 'gradient';
  bg: string;
};

const SECTIONS: Section[] = [
  { id: 'home', label: 'Home', icon: '◈', visual: 'photo', bg: '' },
  {
    id: 'about',
    label: 'About',
    icon: '◐',
    visual: 'gradient',
    bg: 'linear-gradient(135deg, rgba(var(--c-accent-rgb, 255,255,255), 0.08), transparent 60%)',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: '▣',
    visual: 'gradient',
    bg: 'linear-gradient(225deg, rgba(var(--c-accent-rgb, 255,255,255), 0.1), transparent 50%)',
  },
  {
    id: 'blog',
    label: 'Blog',
    icon: '◫',
    visual: 'gradient',
    bg: 'linear-gradient(180deg, rgba(var(--c-accent-rgb, 255,255,255), 0.06), transparent 70%)',
  },
  {
    id: 'contact',
    label: 'Contact',
    icon: '◎',
    visual: 'gradient',
    bg: 'radial-gradient(circle at 70% 30%, rgba(var(--c-accent-rgb, 255,255,255), 0.1), transparent 60%)',
  },
];

const CARD_COUNT = SECTIONS.length;
const ANGLE_STEP = 360 / CARD_COUNT;

function nearestSnap(angle: number): number {
  const normalized = ((angle % 360) + 360) % 360;
  const nearest = Math.round(normalized / ANGLE_STEP) * ANGLE_STEP;
  const diff = nearest - normalized;
  return angle + diff;
}

function activeIndex(angle: number): number {
  const normalized = ((-angle % 360) + 360) % 360;
  return Math.round(normalized / ANGLE_STEP) % CARD_COUNT;
}

export function Carousel3D({
  onSelect,
  selectedId,
}: {
  onSelect: (section: Section) => void;
  selectedId: string | null;
}) {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    startX: 0,
    startRotation: 0,
    lastX: 0,
    velocity: 0,
  });
  const animRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef<number>(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const currentActive = activeIndex(rotation);

  const startAutoRotate = useCallback(() => {
    if (autoRef.current) cancelAnimationFrame(autoRef.current);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setRotation((r) => r - dt * 14);
      autoRef.current = requestAnimationFrame(tick);
    };
    autoRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAutoRotate = useCallback(() => {
    if (autoRef.current) {
      cancelAnimationFrame(autoRef.current);
      autoRef.current = 0;
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    stopAutoRotate();
    idleTimer.current = setTimeout(() => startAutoRotate(), 4000);
  }, [startAutoRotate, stopAutoRotate]);

  useEffect(() => {
    const timer = setTimeout(() => startAutoRotate(), 2000);
    return () => {
      clearTimeout(timer);
      stopAutoRotate();
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [startAutoRotate, stopAutoRotate]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      stopAutoRotate();
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      dragRef.current = {
        startX: e.clientX,
        startRotation: rotation,
        lastX: e.clientX,
        velocity: 0,
      };
    },
    [rotation, stopAutoRotate],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      dragRef.current.velocity = e.clientX - dragRef.current.lastX;
      dragRef.current.lastX = e.clientX;
      setRotation(dragRef.current.startRotation + dx * 0.35);
    },
    [isDragging],
  );

  const onPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const vel = dragRef.current.velocity;
    let current =
      dragRef.current.startRotation +
      (dragRef.current.lastX - dragRef.current.startX) * 0.35;
    const target = nearestSnap(current + vel * 2);

    let frame = 0;
    const spring = () => {
      current += (target - current) * 0.12;
      if (Math.abs(target - current) < 0.1) {
        setRotation(target);
        resetIdleTimer();
        return;
      }
      setRotation(current);
      frame = requestAnimationFrame(spring);
    };
    animRef.current = requestAnimationFrame(spring);
  }, [isDragging, resetIdleTimer]);

  const goToSection = useCallback(
    (index: number) => {
      stopAutoRotate();
      if (animRef.current) cancelAnimationFrame(animRef.current);

      const targetAngle = -index * ANGLE_STEP;
      const currentNorm = ((rotation % 360) + 360) % 360;
      const targetNorm = ((targetAngle % 360) + 360) % 360;
      let diff = targetNorm - currentNorm;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      const finalTarget = rotation + diff;

      let current = rotation;
      const spring = () => {
        current += (finalTarget - current) * 0.1;
        if (Math.abs(finalTarget - current) < 0.1) {
          setRotation(finalTarget);
          resetIdleTimer();
          return;
        }
        setRotation(current);
        animRef.current = requestAnimationFrame(spring);
      };
      animRef.current = requestAnimationFrame(spring);
    },
    [rotation, stopAutoRotate, resetIdleTimer],
  );

  return (
    <div className="carousel-container">
      <div className="carousel-name">Tyler Xiao</div>
      <div
        ref={containerRef}
        className="carousel-scene"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        <div
          className="carousel-ring"
          style={{ transform: `rotateY(${rotation}deg)` }}
        >
          {SECTIONS.map((section, i) => {
            const isActive = i === currentActive;
            const isSelected = section.id === selectedId;
            return (
              <div
                key={section.id}
                className={`carousel-card ${isActive ? 'is-front' : ''} ${isSelected ? 'is-selected' : ''}`}
                style={{
                  transform: `rotateY(${i * ANGLE_STEP}deg) translateZ(var(--carousel-radius))`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isActive) {
                    onSelect(section);
                  } else {
                    goToSection(i);
                  }
                }}
              >
                <div className="carousel-card-visual">
                  {section.visual === 'photo' ? (
                    <Image
                      src="/pfp.JPG"
                      alt="Tyler Xiao"
                      width={120}
                      height={90}
                      className="carousel-card-img"
                    />
                  ) : (
                    <div
                      className="carousel-card-art"
                      data-section={section.id}
                      style={{ background: section.bg }}
                    >
                      <span className="carousel-card-art-icon">
                        {section.icon}
                      </span>
                    </div>
                  )}
                </div>
                <span className="carousel-card-label">{section.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="carousel-dots">
        {SECTIONS.map((section, i) => (
          <button
            key={section.id}
            className={`carousel-dot ${i === currentActive ? 'is-active' : ''} ${section.id === selectedId ? 'is-selected' : ''}`}
            onClick={() => {
              goToSection(i);
              onSelect(section);
            }}
          >
            {section.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export { SECTIONS };
