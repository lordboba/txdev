'use client';

import { PLANETS, type OrbitalSectionId } from '@/lib/orbitalData';

type SideIndexProps = {
  activeId: OrbitalSectionId;
  onHover: (id: OrbitalSectionId | null) => void;
  onSelect: (id: OrbitalSectionId) => void;
};

export function SideIndex({ activeId, onHover, onSelect }: SideIndexProps) {
  const activePlanet =
    PLANETS.find((planet) => planet.id === activeId) ?? PLANETS[0];

  return (
    <aside className="orb-index" aria-label="Section index">
      <div className="orb-index-head">
        <span className="k">Orbit Index</span>
        <span>{PLANETS.length} regions</span>
      </div>

      <ul className="orb-index-list" role="list">
        {PLANETS.map((planet) => {
          const isOn = planet.id === activeId;

          return (
            <li key={planet.id}>
              <button
                type="button"
                className={`orb-index-item${isOn ? ' is-on' : ''}`}
                aria-label={`Switch to ${planet.label}`}
                onClick={() => onSelect(planet.id)}
                onMouseEnter={() => onHover(planet.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(planet.id)}
                onBlur={() => onHover(null)}
              >
                <span className="num">{planet.numeral}</span>
                <span className="name">{planet.label}</span>
                <span className="meta">{planet.meta}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="orb-index-note" aria-live="polite">
        {activePlanet.note}
        <em>
          Active section · {activePlanet.label}
          <span aria-hidden> · </span>
          {activePlanet.serial}
        </em>
      </p>
    </aside>
  );
}
