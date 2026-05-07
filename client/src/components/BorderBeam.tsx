import "./css/BorderBeam.css";

interface Props {
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
}

export default function BorderBeam({
  size = 80,
  duration = 3,
  colorFrom = "#6366f1",
  colorTo = "#06b6d4",
  className = "",
}: Props) {
  return (
    <div
      className={`border-beam ${className}`}
      style={{
        "--beam-size": `${size}px`,
        "--beam-duration": `${duration}s`,
        "--beam-color-from": colorFrom,
        "--beam-color-to": colorTo,
      } as React.CSSProperties}
    />
  );
}