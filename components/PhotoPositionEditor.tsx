
import React, { useState, useRef } from 'react';
import { Check, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface PhotoPositionEditorProps {
  imageSrc: string;
  initialZoom?: number;
  initialOffsetX?: number;
  initialOffsetY?: number;
  onCancel: () => void;
  onSave: (settings: { zoom: number; offsetX: number; offsetY: number }) => void;
}

const PhotoPositionEditor: React.FC<PhotoPositionEditorProps> = ({
  imageSrc,
  initialZoom = 1,
  initialOffsetX = 0,
  initialOffsetY = 0,
  onCancel,
  onSave,
}) => {
  const [zoom, setZoom] = useState(initialZoom);
  const [offset, setOffset] = useState({ x: initialOffsetX, y: initialOffsetY });
  const [isDragging, setIsDragging] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    // Convert pixels to percentage of container dimensions
    const rect = containerRef.current.getBoundingClientRect();
    const percentX = (dx / rect.width) * 100;
    const percentY = (dy / rect.height) * 100;

    // Apply translation relative to zoom to make dragging feel natural
    // (Dividing by zoom is optional depending on desired feel, but raw % is usually robust enough)
    setOffset({
      x: offsetStart.current.x + percentX,
      y: offsetStart.current.y + percentY
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-6 shadow-2xl">
        <h3 className="text-xl font-bold text-text-main">Adjust Photo</h3>
        
        <p className="text-xs text-text-muted -mt-2">Drag to reposition • Use slider to zoom</p>

        <div className="relative group cursor-move touch-none" style={{ width: 240, height: 240 }}>
           {/* Mask / Frame */}
           <div 
             ref={containerRef}
             className="w-full h-full rounded-full border-4 border-white/20 overflow-hidden relative bg-black shadow-inner"
             onPointerDown={handlePointerDown}
             onPointerMove={handlePointerMove}
             onPointerUp={handlePointerUp}
             onPointerLeave={handlePointerUp}
           >
             <img 
               src={imageSrc} 
               alt="Preview" 
               className="w-full h-full object-cover origin-center select-none pointer-events-none"
               style={{ 
                 transform: `translate(${offset.x}%, ${offset.y}%) scale(${zoom})`,
                 transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                 willChange: 'transform'
               }} 
               draggable={false}
             />
             
             <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <Move className="text-white/80 drop-shadow-md" size={32} />
             </div>
           </div>
        </div>

        <div className="w-full space-y-2">
           <div className="flex justify-between text-xs text-text-muted px-1">
              <div className="flex items-center gap-1"><ZoomOut size={14} /> 1x</div>
              <div className="flex items-center gap-1"><ZoomIn size={14} /> 3x</div>
           </div>
           <input 
             type="range" 
             min="1" 
             max="3" 
             step="0.05" 
             value={zoom} 
             onChange={(e) => setZoom(parseFloat(e.target.value))}
             className="w-full accent-primary h-2 bg-white/10 rounded-lg appearance-none cursor-pointer hover:bg-white/20 transition-colors"
           />
        </div>

        <div className="flex gap-3 w-full mt-2">
           <button 
             onClick={onCancel}
             className="flex-1 py-3 rounded-xl border border-white/10 text-text-muted font-bold hover:bg-white/5 transition-colors"
           >
             Cancel
           </button>
           <button 
             onClick={() => onSave({ zoom, offsetX: offset.x, offsetY: offset.y })}
             className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shadow-lg"
           >
             <Check size={18} /> Apply
           </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoPositionEditor;
