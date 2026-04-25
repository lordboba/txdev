'use client';

import { useId } from 'react';
import {
  DEFAULT_ORBITAL_AXIS,
  ORBITAL_AXIS_LIMIT_DEGREES,
  degreesToRadians,
  radiansToDegrees,
  type OrbitalAxisState,
} from '@/lib/orbitalPhysics';

type OrbitalAxisControlsProps = {
  axisState: OrbitalAxisState;
  onAxisChange: (axisState: OrbitalAxisState) => void;
  onReset: () => void;
};

function formatDegrees(value: number): string {
  const degrees = Math.round(value);
  return `${degrees > 0 ? '+' : ''}${degrees}deg`;
}

function randomAxisDegrees(): number {
  return Math.round(
    Math.random() * ORBITAL_AXIS_LIMIT_DEGREES * 2 - ORBITAL_AXIS_LIMIT_DEGREES,
  );
}

export function OrbitalAxisControls({
  axisState,
  onAxisChange,
  onReset,
}: OrbitalAxisControlsProps) {
  const controlId = useId();
  const pitchId = `${controlId}-pitch`;
  const yawId = `${controlId}-yaw`;
  const pitchDegrees = Math.round(radiansToDegrees(axisState.tiltX));
  const yawDegrees = Math.round(radiansToDegrees(axisState.tiltY));
  const isDefault =
    Math.abs(axisState.tiltX - DEFAULT_ORBITAL_AXIS.tiltX) < 0.001 &&
    Math.abs(axisState.tiltY - DEFAULT_ORBITAL_AXIS.tiltY) < 0.001;

  const randomizeAxis = () => {
    onAxisChange({
      tiltX: degreesToRadians(randomAxisDegrees()),
      tiltY: degreesToRadians(randomAxisDegrees()),
    });
  };

  return (
    <div className="orb-axis-panel" role="group" aria-label="Orbital axis">
      <div className="orb-axis-panel-head">
        <span className="orb-axis-kicker">Axis</span>
        <div className="orb-axis-actions">
          <button
            type="button"
            className="orb-axis-button"
            onClick={randomizeAxis}
            aria-label="Randomize orbital axis"
            title="Randomize orbital axis"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="5" y="5" width="14" height="14" rx="3" />
              <circle cx="9" cy="9" r="0.9" />
              <circle cx="12" cy="12" r="0.9" />
              <circle cx="15" cy="15" r="0.9" />
              <circle cx="15" cy="9" r="0.9" />
              <circle cx="9" cy="15" r="0.9" />
            </svg>
          </button>
          <button
            type="button"
            className="orb-axis-button"
            onClick={onReset}
            disabled={isDefault}
            aria-label="Reset orbital axis"
            title="Reset orbital axis"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5.5 12a6.5 6.5 0 1 0 2.02-4.71" />
              <path d="M5.5 5.5v5h5" />
            </svg>
          </button>
        </div>
      </div>

      <label className="orb-axis-row" htmlFor={yawId}>
        <span className="orb-axis-label">Yaw</span>
        <input
          id={yawId}
          type="range"
          min={-ORBITAL_AXIS_LIMIT_DEGREES}
          max={ORBITAL_AXIS_LIMIT_DEGREES}
          step="1"
          value={yawDegrees}
          onChange={(event) =>
            onAxisChange({
              ...axisState,
              tiltY: degreesToRadians(Number(event.currentTarget.value)),
            })
          }
          aria-valuetext={`${yawDegrees} degrees`}
        />
        <output className="orb-axis-value" htmlFor={yawId}>
          {formatDegrees(yawDegrees)}
        </output>
      </label>

      <label className="orb-axis-row" htmlFor={pitchId}>
        <span className="orb-axis-label">Pitch</span>
        <input
          id={pitchId}
          type="range"
          min={-ORBITAL_AXIS_LIMIT_DEGREES}
          max={ORBITAL_AXIS_LIMIT_DEGREES}
          step="1"
          value={pitchDegrees}
          onChange={(event) =>
            onAxisChange({
              ...axisState,
              tiltX: degreesToRadians(Number(event.currentTarget.value)),
            })
          }
          aria-valuetext={`${pitchDegrees} degrees`}
        />
        <output className="orb-axis-value" htmlFor={pitchId}>
          {formatDegrees(pitchDegrees)}
        </output>
      </label>
    </div>
  );
}
