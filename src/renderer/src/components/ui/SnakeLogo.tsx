import { useEffect, useState } from "react";

export type SnakeState = "idle" | "thinking" | "working" | "executing" | "chatting";

interface SnakeLogoProps {
  state?: SnakeState;
  size?: number;
}

const snakePatterns = {
  idle: [
    { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 },
    { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 },
  ],
  thinking: [
    { x: 3, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 3, y: 4 },
    { x: 2, y: 4 }, { x: 1, y: 3 }, { x: 1, y: 2 }, { x: 2, y: 1 },
  ],
  working: [
    { x: 1, y: 3 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 2 },
    { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 3 },
  ],
  executing: [
    { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 2 },
    { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 4 },
  ],
  chatting: [
    { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 },
    { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 },
  ],
};

const stateColors = {
  idle: "#4285f4",
  thinking: "#fbbc04",
  working: "#34a853",
  executing: "#ea4335",
  chatting: "#8b5cf6",
};

const stateSpeeds = {
  idle: 800,
  thinking: 400,
  working: 300,
  executing: 150,
  chatting: 500,
};

const eyeOffsets = {
  idle: { dx: 0, dy: -0.3 },
  thinking: { dx: 0.2, dy: -0.3 },
  working: { dx: -0.2, dy: -0.3 },
  executing: { dx: 0, dy: 0 },
  chatting: { dx: 0.1, dy: -0.2 },
};

export function SnakeLogo({ state = "idle", size = 34 }: SnakeLogoProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const speed = stateSpeeds[state];
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % 8);
    }, speed);
    return () => clearInterval(interval);
  }, [state]);

  const pattern = snakePatterns[state];
  const color = stateColors[state];
  const eyeOffset = eyeOffsets[state];
  const gridSize = 7;
  const cellSize = size / gridSize;

  const headIndex = frame % pattern.length;
  const headPos = pattern[headIndex];

  const segments = pattern.map((point, index) => {
    const distance = (index - headIndex + pattern.length) % pattern.length;
    const alpha = Math.max(0.3, 1 - distance * 0.1);
    const scale = Math.max(0.6, 1 - distance * 0.06);
    const x = point.x * cellSize + cellSize / 2;
    const y = point.y * cellSize + cellSize / 2;
    return {
      x,
      y,
      alpha,
      scale,
      isHead: index === headIndex,
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${gridSize} ${gridSize}`}
      className="snake-logo"
      style={{ transform: `scale(${size / gridSize})`, transformOrigin: "top left" }}
    >
      <defs>
        <linearGradient id="snakeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
        <filter id="snakeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {segments.map((segment, index) => (
        <circle
          key={index}
          cx={segment.x}
          cy={segment.y}
          r={0.4 * segment.scale}
          fill={`url(#snakeGradient)`}
          opacity={segment.alpha}
          filter={segment.isHead ? "url(#snakeGlow)" : undefined}
          style={{
            transition: "all 0.15s ease-out",
          }}
        />
      ))}
      {headPos && (
        <g transform={`translate(${headPos.x + cellSize / 2}, ${headPos.y + cellSize / 2})`}>
          <circle
            cx={eyeOffset.dx - 0.15}
            cy={eyeOffset.dy - 0.1}
            r="0.08"
            fill="white"
            opacity={0.9}
          />
          <circle
            cx={eyeOffset.dx + 0.15}
            cy={eyeOffset.dy - 0.1}
            r="0.08"
            fill="white"
            opacity={0.9}
          />
          <circle
            cx={eyeOffset.dx - 0.15}
            cy={eyeOffset.dy - 0.1}
            r="0.04"
            fill="black"
          />
          <circle
            cx={eyeOffset.dx + 0.15}
            cy={eyeOffset.dy - 0.1}
            r="0.04"
            fill="black"
          />
        </g>
      )}
    </svg>
  );
}
