import { useEffect, useState } from "react";
import "./css/AnimatedList.css";

interface Props {
  children: React.ReactNode[];
  delay?: number;
  className?: string;
}

export default function AnimatedList({ children, delay = 80, className = "" }: Props) {
  const [visible, setVisible] = useState<number[]>([]);

  useEffect(() => {
    setVisible([]);
    children.forEach((_, i) => {
      setTimeout(() => {
        setVisible(prev => [...prev, i]);
      }, i * delay);
    });
  }, [children.length]);

  return (
    <div className={`animated-list ${className}`}>
      {children.map((child, i) => (
        <div
          key={i}
          className={`animated-list-item ${visible.includes(i) ? "animated-list-item--visible" : ""}`}
        >
          {child}
        </div>
      ))}
    </div>
  );
}