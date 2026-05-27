interface Props {
  icon: string;
  title: string;
  message: string;
  onBack?: () => void;
}

export default function MobileGate({ icon, title, message, onBack }: Props) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "1.25rem",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
      padding: "2rem",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>{icon}</div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "0.03em", color: "#fff" }}>
        {title}
      </h1>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem", maxWidth: "260px", lineHeight: 1.7 }}>
        {message}
      </p>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            marginTop: "0.5rem",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "10px",
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.875rem",
            padding: "0.6rem 1.5rem",
            cursor: "pointer",
          }}
        >
          ← Back to Home
        </button>
      )}
    </div>
  );
}
