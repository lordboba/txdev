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

  return (
    <div className="orb-axis-panel" role="group" aria-label="Orbital axis">
      <div className="orb-axis-panel-head">
        <span className="orb-axis-kicker">Axis</span>
        <button
          type="button"
          className="orb-axis-reset"
          onClick={onReset}
          disabled={isDefault}
          aria-label="Reset orbital axis"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5.5 12a6.5 6.5 0 1 0 2.02-4.71" />
            <path d="M5.5 5.5v5h5" />
          </svg>
        </button>
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
