import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, X, Pause, Play, RotateCcw, Notebook } from 'lucide-react';

const MAX_SECONDS = 24 * 60 * 60; // 24 hours max

interface TimerOverlayProps {
  onNotesClick?: () => void;
  isNotesActive?: boolean;
}

const TimerOverlay: React.FC<TimerOverlayProps> = ({ onNotesClick, isNotesActive }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(5 * 60); // default 5 min
  const [remainingSeconds, setRemainingSeconds] = useState(5 * 60);
  const [volume, setVolume] = useState(0.7); // 0–1

  const timerSound = useMemo(() => {
    const audio = new Audio('/timer-finished.mp3'); // served from public/
    audio.preload = 'auto';
    audio.volume = 0.7;
    return audio;
  }, []);

  // Sync volume
  useEffect(() => {
    if (timerSound) {
      timerSound.volume = volume;
    }
  }, [volume, timerSound]);

  // --- Timer logic ---
  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) return;

    const id = window.setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          // Stop timer
          setIsRunning(false);

          // 🔔 Play sound when we hit 0
          try {
            timerSound.currentTime = 0;
            timerSound.play().catch(() => {
              // ignore autoplay block errors
            });
          } catch (e) {
            console.warn('Timer sound failed:', e);
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [isRunning, remainingSeconds, timerSound]);

  const updateDuration = (hours: number, minutes: number) => {
    const h = Math.max(0, hours);
    const m = Math.max(0, minutes);

    let total = h * 3600 + m * 60;
    if (total > MAX_SECONDS) total = MAX_SECONDS;

    setDurationSeconds(total);
    setRemainingSeconds(total);
    setIsRunning(false);
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

    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  // --- Drag state ---
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    x: number;
    y: number;
  } | null>(null);

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

  // Helper values for inputs
  const currentHours = Math.floor(durationSeconds / 3600);
  const currentMinutes = Math.floor((durationSeconds % 3600) / 60);

  return (
    <>
      {isOpen && (
        <div
          className="fixed z-[90] w-64 max-w-[90vw] cursor-default select-none"
          style={{ left: position.x, top: position.y }}
        >
          <div className="bg-surface border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header (draggable) */}
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
                  Use it for breaks, movement, or focus sprints.
                </p>
              </div>

              {/* Duration inputs */}
              <div className="flex items-center justify-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={currentHours}
                    onChange={(e) =>
                      updateDuration(parseInt(e.target.value) || 0, currentMinutes)
                    }
                    className="w-12 bg-background border border-white/10 rounded-md px-1 py-1 text-xs text-text-main text-center focus:outline-none focus:border-gold/50"
                  />
                  <span className="text-text-muted">h</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={currentMinutes}
                    onChange={(e) =>
                      updateDuration(currentHours, parseInt(e.target.value) || 0)
                    }
                    className="w-12 bg-background border border-white/10 rounded-md px-1 py-1 text-xs text-text-main text-center focus:outline-none focus:border-gold/50"
                  />
                  <span className="text-text-muted">m</span>
                </div>
              </div>

              {/* Volume slider */}
              <div className="flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between text-text-muted mb-0.5">
                  <span>Volume</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  className="w-full accent-gold"
                />
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
      )}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-24 md:bottom-6 right-6 z-[90] flex items-center gap-3">
        {onNotesClick && (
          <button
            type="button"
            onClick={onNotesClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs text-text-main shadow-lg transition-colors ${
              isNotesActive
                ? 'bg-gold/10 border-gold text-gold'
                : 'bg-surface border-white/10 hover:bg-white/5 hover:border-gold/40 hover:text-gold'
            }`}
          >
            <Notebook size={16} />
            <span>Notes</span>
          </button>
        )}
        
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface border border-white/10 text-xs text-text-main shadow-lg hover:bg-white/5 hover:border-gold/40 hover:text-gold"
          >
            <Clock size={16} className="text-gold" />
            <span>Open Timer</span>
          </button>
        )}
      </div>
    </>
  );
};

export default TimerOverlay;