import "./css/HomeButton.css";

interface Props {
  onHome: () => void;
}

export default function HomeButton({ onHome }: Props) {
  return (
    <button className="home-btn" onClick={onHome} title="Back to Home">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 6.5L8 2l6 4.5V14a.5.5 0 01-.5.5h-4V10h-3v4.5h-4A.5.5 0 012 14V6.5z"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </button>
  );
}