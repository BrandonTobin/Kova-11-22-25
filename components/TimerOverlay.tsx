import React, { useEffect, useRef, useState } from 'react';
import { Clock, X, Pause, Play, RotateCcw } from 'lucide-react';

const MAX_SECONDS = 24 * 60 * 60; // 24 hours

const TimerOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(5 * 60); // default 5 min
  const [remainingSeconds, setRemainingSeconds] = useState(5 * 60);

  // simple draggable state
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; x: number; y: number } | null>(
    null
  );

  // --- Timer logic ---
  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) return;

    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // stop at zero
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [isRunning, remainingSeconds]);

  const clampDuration = (seconds: number) => {
    if (seconds < 1) return 1;
    if (seconds > MAX_SECONDS) return MAX_SECONDS;
    return seconds;
  };

  const handleDurationChange = (value: string) => {
    const minutes = Number(value);
    if (Number.isNaN(minutes)) return;
    const totalSeconds = clampDuration(minutes * 60);
    setDurationSeconds(totalSeconds);
    setRemainingSeconds(totalSeconds);
  };

  const handleStart = () => {
    if (remainingSeconds <= 0) {
      setRemainingSeconds(durationSeconds);
    }
    setIsRunning(true);
  };

  const handlePause = () => setIsRunning(false);

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(durationSeconds);
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // --- Drag handlers ---
  const handleDragStart: React.MouseEventHandler<HTMLDivElement> = (e) => {
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: position.x,
      y: position.y,
    };
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;

    setPosition({
      x: dragStartRef.current.x + dx,
      y: dragStartRef.current.y + dy,
    });
  };

  const handleDragEnd = () => {
    dragStartRef.current = null;
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
  };

  // collapsed button
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 px-3 py-2 rounded-full bg-surface border border-white/10 text-xs text-text-main shadow-lg hover:bg-white/5"
      >
        <Clock size={16} className="text-gold" />
        <span>Open Timer</span>
      </button>
    );
  }

  return (
    <div
      className="fixed z-[90] w-64 max-w-[90vw] cursor-default select-none"
      style={{ left: position.x, top: position.y }}
    >
      <div className="bg-surface border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
        {/* draggable header */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-background/80 border-b border-white/10 cursor-move"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Clock size={14} className="text-gold" />
            <span>Focus / Break Timer</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsRunning(false);
            }}
            className="text-text-muted hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Time display */}
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-text-main">
              {formatTime(remainingSeconds)}
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              Max 24 hours. Use it for breaks, movement, or focus sprints.
            </p>
          </div>

          {/* Duration input */}
          <div className="flex items-center gap-2 text-xs">
            <label className="text-text-muted whitespace-nowrap" htmlFor="timer-minutes">
              Duration:
            </label>
            <input
              id="timer-minutes"
              type="number"
              min={1}
              max={1440}
              value={Math.round(durationSeconds / 60)}
              onChange={(e) => handleDurationChange(e.target.value)}
              className="w-16 bg-background border border-white/10 rounded-md px-2 py-1 text-xs text-text-main focus:outline-none focus:border-gold/50"
            />
            <span className="text-text-muted">min (max 1440)</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={isRunning ? handlePause : handleStart}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover"
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
              <span>{isRunning ? 'Pause' : 'Start'}</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-background border border-white/10 text-text-muted hover:bg-white/5"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerOverlay;
