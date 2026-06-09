import { useState, useEffect, useCallback } from "react";
import { getFinanceStatus, setupFinancePin, verifyFinancePin, getPendingRecurring, getFinanceSettings } from "../financeAPI";
import FinanceDashboard from "./FinanceDashboard";
import FinanceTransactions from "./FinanceTransactions";
import FinanceBudget from "./FinanceBudget";
import FinanceGoals from "./FinanceGoals";
import FinanceNotifications from "./FinanceNotifications";
import FinanceSettings from "./FinanceSettings";
import BorderBeam from "./BorderBeam";
import "./css/FinancePage.css";

type FinanceSection = "dashboard" | "transactions" | "budget" | "goals" | "notifications";
type GateState = "loading" | "setup" | "locked" | "unlocked";

interface Props {
  initialSection?: string;
  onGoHome?: () => void;
}

const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 6.5L8 2l6 4.5V14a.5.5 0 01-.5.5h-4V10h-3v4.5h-4A.5.5 0 012 14V6.5z"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export default function FinancePage({ initialSection, onGoHome }: Props) {
  const [gate, setGate] = useState<GateState>("loading");
  const [section, setSection] = useState<FinanceSection>((initialSection as FinanceSection) || "dashboard");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [currency, setCurrency] = useState("EUR");
  const [showSettings, setShowSettings] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    getFinanceStatus().then(({ configured }) => setGate(configured ? "locked" : "setup"));
  }, []);

  useEffect(() => {
    if (gate === "unlocked") {
      fetchPendingCount();
      getFinanceSettings().then(s => setCurrency(s.currency)).catch(() => {});
    }
  }, [gate, currentMonth]);

  const fetchPendingCount = async () => {
    try {
      const data = await getPendingRecurring(currentMonth);
      setPendingCount(data.length);
    } catch { setPendingCount(0); }
  };

  const handlePinInput = useCallback((digit: string) => {
    setPin(p => p.length < 6 ? p + digit : p);
  }, []);

  const handlePinDelete = useCallback(() => setPin(p => p.slice(0, -1)), []);

  const handleSetup = async (currentPin: string) => {
    if (currentPin.length < 4) { setError("At least 4 digits"); return; }
    await setupFinancePin(currentPin);
    setPin(""); setGate("unlocked");
  };

  const handleVerify = async (currentPin: string) => {
    const res = await verifyFinancePin(currentPin);
    if (res.success) { setPin(""); setGate("unlocked"); }
    else {
      setError("Wrong PIN"); setShake(true);
      setTimeout(() => { setShake(false); setError(""); }, 600);
      setPin("");
    }
  };

  useEffect(() => {
    if (gate !== "setup" && gate !== "locked") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handlePinInput(e.key);
      else if (e.key === "Backspace") handlePinDelete();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gate, handlePinInput, handlePinDelete]);

  useEffect(() => {
    if (gate === "locked" && pin.length === 4) handleVerify(pin);
  }, [pin, gate]);

  const monthLabel = () => {
    const [y, m] = currentMonth.split("-");
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
  };

  if (gate === "loading") return <div className="finance-gate"><div className="finance-gate-dots">···</div></div>;

  if (gate === "setup" || gate === "locked") {
    const isSetup = gate === "setup";
    return (
      <div className="finance-gate">
        <div className={`finance-gate-box ${shake ? "shake" : ""}`} style={{ position: "relative", overflow: "hidden" }}>
          <BorderBeam duration={4} colorFrom="#6366f1" colorTo="#06b6d4" />
          <div className="finance-gate-icon">💳</div>
          <h2>{isSetup ? "Set up Finance PIN" : "Finance"}</h2>
          <p className="finance-gate-sub">{isSetup ? "Choose a 4–6 digit PIN" : "Enter your PIN"}</p>
          <div className="finance-pin-dots">
            {[...Array(isSetup ? Math.max(4, pin.length) : 4)].map((_, i) => (
              <div key={i} className={`finance-pin-dot ${i < pin.length ? "filled" : ""}`} />
            ))}
          </div>
          {error && <p className="finance-gate-error">{error}</p>}
          <div className="finance-numpad">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} className="finance-numpad-btn" onClick={() => handlePinInput(String(n))}>{n}</button>
            ))}
            <button className="finance-numpad-btn empty" />
            <button className="finance-numpad-btn" onClick={() => handlePinInput("0")}>0</button>
            <button className="finance-numpad-btn delete" onClick={handlePinDelete}>⌫</button>
          </div>
          {isSetup && pin.length >= 4 && (
            <button className="finance-gate-confirm" onClick={() => handleSetup(pin)}>Confirm PIN</button>
          )}
        </div>
      </div>
    );
  }

  const navItems: { key: FinanceSection; icon: string; label: string }[] = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "transactions", icon: "💸", label: "Transactions" },
    { key: "budget", icon: "🗂", label: "Budget" },
    { key: "goals", icon: "🎯", label: "Goals" },
    { key: "notifications", icon: "🔔", label: "Notifications" },
  ];

  return (
    <div className="finance-layout">
      <div className="finance-mobile-topbar">
        <button className="finance-home-btn" onClick={onGoHome} title="Back to Home"><HomeIcon /></button>
        <div className="finance-mobile-month-nav">
          <button onClick={() => {
            const [y, m] = currentMonth.split("-").map(Number);
            const d = new Date(y, m - 2, 1);
            setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
          }}>‹</button>
          <span>{monthLabel()}</span>
          <button onClick={() => {
            const [y, m] = currentMonth.split("-").map(Number);
            const d = new Date(y, m, 1);
            setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
          }}>›</button>
        </div>
        <button className="finance-settings-btn" onClick={() => setShowSettings(true)} title="Settings">⚙</button>
      </div>
      <aside className="finance-sidebar">
        <div className="finance-sidebar-header">
          <button className="finance-home-btn" onClick={onGoHome} title="Back to Home"><HomeIcon /></button>
          <button className="finance-settings-btn" onClick={() => setShowSettings(true)} title="Settings">⚙</button>
        </div>
        <div className="finance-month-nav">
          <button onClick={() => {
            const [y, m] = currentMonth.split("-").map(Number);
            const d = new Date(y, m - 2, 1);
            setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
          }}>‹</button>
          <span>{monthLabel()}</span>
          <button onClick={() => {
            const [y, m] = currentMonth.split("-").map(Number);
            const d = new Date(y, m, 1);
            setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
          }}>›</button>
        </div>
        <nav className="finance-nav">
          {navItems.map(item => (
            <button key={item.key} className={`finance-nav-item ${section === item.key ? "active" : ""}`} onClick={() => setSection(item.key)}>
              <span>{item.icon}</span>
              {item.label}
              {item.key === "notifications" && pendingCount > 0 && (
                <span className="finance-nav-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <div className="finance-main">
        {section === "dashboard" && <FinanceDashboard currentMonth={currentMonth} currency={currency} />}
        {section === "transactions" && <FinanceTransactions currentMonth={currentMonth} currency={currency} />}
        {section === "budget" && <FinanceBudget currentMonth={currentMonth} currency={currency} />}
        {section === "goals" && <FinanceGoals currency={currency} />}
        {section === "notifications" && <FinanceNotifications currentMonth={currentMonth} onConfirmed={fetchPendingCount} currency={currency} />}
      </div>
      <nav className="finance-bottom-nav">
        {navItems.map(item => (
          <button
            key={item.key}
            className={`finance-bottom-nav-item ${section === item.key ? "active" : ""}`}
            onClick={() => setSection(item.key)}
          >
            <span className="finance-bottom-nav-icon">{item.icon}</span>
            <span className="finance-bottom-nav-label">{item.label}</span>
            {item.key === "notifications" && pendingCount > 0 && (
              <span className="finance-nav-badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </nav>

      {showSettings && (
        <FinanceSettings
          currency={currency}
          onClose={() => setShowSettings(false)}
          onCurrencyChange={setCurrency}
        />
      )}
    </div>
  );
}