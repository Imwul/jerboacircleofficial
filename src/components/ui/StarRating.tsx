
import React, { useRef, useState, useEffect } from 'react';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  readonly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({ value, onChange, readonly = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateValue = (clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, relativeX / rect.width));
    // 0.5단위 정규화 (0~5점)
    return Math.ceil(percentage * 10) / 2;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (readonly) return;
    const newValue = calculateValue(e.clientX);
    setHoverValue(newValue);
    if (isDragging) {
      onChange(newValue);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (readonly) return;
    const newValue = calculateValue(e.touches[0].clientX);
    setHoverValue(newValue);
    onChange(newValue);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readonly) return;
    setIsDragging(true);
    onChange(calculateValue(e.clientX));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className="flex flex-col items-center gap-3">
      <div 
        ref={containerRef}
        className={`relative flex items-center justify-center gap-1 cursor-pointer select-none touch-none ${readonly ? 'pointer-events-none' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverValue(null)}
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => {
          if (readonly) return;
          const newValue = calculateValue(e.touches[0].clientX);
          setHoverValue(newValue);
          onChange(newValue);
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setHoverValue(null)}
        style={{ width: '220px', height: '48px' }}
      >
        {[...Array(5)].map((_, i) => {
          const fillAmount = Math.max(0, Math.min(1, displayValue - i));
          
          return (
            <div key={i} className="relative w-10 h-10">
              {/* Empty Star */}
              <svg viewBox="0 0 24 24" className="w-full h-full text-stone-200 fill-current">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              {/* Filled Star with Clipping */}
              <div 
                className="absolute top-0 left-0 h-full overflow-hidden text-amber-400 fill-current transition-[width] duration-75"
                style={{ width: `${fillAmount * 100}%` }}
              >
                <svg viewBox="0 0 24 24" className="w-10 h-10">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
      <div className="bg-stone-100 px-4 py-1 rounded-full">
        <span className="text-xl font-black text-stone-800 tracking-tighter">
          {displayValue.toFixed(1)} <span className="text-xs text-stone-400 ml-0.5">/ 5.0</span>
        </span>
      </div>
    </div>
  );
};
