import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ResizableSplitProps {
  direction?: 'horizontal' | 'vertical';
  initialPercent?: number; // 0 to 100
  minPercent?: number;
  maxPercent?: number;
  storageKey?: string;
  first: React.ReactNode;
  second: React.ReactNode;
  className?: string;
}

export const ResizableSplit: React.FC<ResizableSplitProps> = ({
  direction = 'horizontal',
  initialPercent = 50,
  minPercent = 15,
  maxPercent = 85,
  storageKey,
  first,
  second,
  className = '',
}) => {
  const [percent, setPercent] = useState<number>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`split_${storageKey}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= minPercent && parsed <= maxPercent) {
          return parsed;
        }
      }
    }
    return initialPercent;
  });

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      let newPercent = percent;
      if (direction === 'horizontal') {
        const offsetX = e.clientX - rect.left;
        newPercent = (offsetX / rect.width) * 100;
      } else {
        const offsetY = e.clientY - rect.top;
        newPercent = (offsetY / rect.height) * 100;
      }

      newPercent = Math.max(minPercent, Math.min(maxPercent, newPercent));
      setPercent(newPercent);
      if (storageKey) {
        localStorage.setItem(`split_${storageKey}`, newPercent.toString());
      }
    },
    [isDragging, direction, minPercent, maxPercent, storageKey, percent]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, direction]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full min-h-0 min-w-0 overflow-hidden ${
        direction === 'horizontal' ? 'flex-row' : 'flex-col'
      } ${className}`}
    >
      {/* First Pane */}
      <div
        style={{
          [direction === 'horizontal' ? 'width' : 'height']: `${percent}%`,
        }}
        className="min-h-0 min-w-0 overflow-hidden flex flex-col"
      >
        {first}
      </div>

      {/* Draggable Divider Bar */}
      <div
        onMouseDown={handleMouseDown}
        className={`group relative shrink-0 z-20 flex items-center justify-center transition-colors ${
          direction === 'horizontal'
            ? 'w-1 cursor-col-resize hover:w-1.5 hover:bg-blue-500/50 bg-[#1e2530]'
            : 'h-1 cursor-row-resize hover:h-1.5 hover:bg-blue-500/50 bg-[#1e2530]'
        } ${isDragging ? '!bg-blue-500' : ''}`}
      >
        {/* Subtle hover grab indicator */}
        <div
          className={`rounded-full bg-gray-500/50 group-hover:bg-blue-400 ${
            direction === 'horizontal' ? 'h-6 w-0.5' : 'w-6 h-0.5'
          }`}
        />
      </div>

      {/* Second Pane */}
      <div
        style={{
          [direction === 'horizontal' ? 'width' : 'height']: `${100 - percent}%`,
        }}
        className="min-h-0 min-w-0 overflow-hidden flex flex-col flex-1"
      >
        {second}
      </div>
    </div>
  );
};
