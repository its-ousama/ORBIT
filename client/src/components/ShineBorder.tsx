import "./css/ShineBorder.css";

interface Props {
  children: React.ReactNode;
  color?: string | string[];
  borderWidth?: number;
  duration?: number;
  borderRadius?: number;
  className?: string;
}

export default function ShineBorder({
  children,
  color = ["#6366f1", "#3b82f6", "#06b6d4"],
  borderWidth = 1,
  duration = 8,
  borderRadius = 12,
  className = "",
}: Props) {
  const gradient = Array.isArray(color) ? color.join(", ") : color;

  return (
    <div
      className={`shine-border ${className}`}
      style={{
        "--shine-gradient": gradient,
        "--shine-duration": `${duration}s`,
        "--shine-border-width": `${borderWidth}px`,
        "--shine-radius": `${borderRadius}px`,
      } as React.CSSProperties}
    >
      <div className="shine-border-inner" style={{ borderRadius: borderRadius - borderWidth }}>
        {children}
      </div>
    </div>
  );
}