"use client";

import { formatClock } from "@/lib/format";

const SPEEDS = [1, 2, 4];

type Props = {
  /** Length of the run's timeline in ms, or null when there is no finished run yet. */
  total: number | null;
  t: number;
  playing: boolean;
  speed: number;
  running: boolean;
  onTogglePlay: () => void;
  onSpeed: (s: number) => void;
  onSeek: (t: number) => void;
};

/** Play, speed and scrub controls for a finished run, or a short note when there is nothing to play. */
export default function PlayerControls({ total, t, playing, speed, running, onTogglePlay, onSpeed, onSeek }: Props) {
  if (total === null) {
    return (
      <div className="player">
        <p className="player-note">{running ? "Running now. You can scrub back through it once it finishes." : "Pick an idea to start."}</p>
      </div>
    );
  }
  const atEnd = t >= total - 1;
  const label = playing ? "Pause" : atEnd ? "Replay" : "Play";
  return (
    <div className="player">
      <button type="button" className="play" onClick={onTogglePlay} aria-label={playing ? "Pause" : atEnd ? "Replay from the start" : "Play"}>
        {label}
      </button>
      <div className="speeds" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button key={s} type="button" aria-pressed={speed === s} onClick={() => onSpeed(s)}>
            {s}x
          </button>
        ))}
      </div>
      <input
        className="scrub"
        type="range"
        min={0}
        max={Math.round(total)}
        value={Math.round(t)}
        aria-label="Scrub through the run"
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <span className="clock">
        {formatClock(t)} / {formatClock(total)}
      </span>
    </div>
  );
}
