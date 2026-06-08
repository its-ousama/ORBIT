import { useState } from "react";
import { updateFinanceCurrency, changeFinancePin } from "../financeAPI";
import "./css/FinanceSettings.css";

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "EUR", symbol: "€",    label: "Euro (€)" },
  { code: "USD", symbol: "$",    label: "US Dollar ($)" },
  { code: "GBP", symbol: "£",    label: "British Pound (£)" },
  { code: "MAD", symbol: "MAD ", label: "Moroccan Dirham (MAD)" },
  { code: "CAD", symbol: "CA$",  label: "Canadian Dollar (CA$)" },
  { code: "CHF", symbol: "CHF ", label: "Swiss Franc (CHF)" },
  { code: "AED", symbol: "AED ", label: "UAE Dirham (AED)" },
  { code: "KWD", symbol: "KD ",  label: "Kuwaiti Dinar (KD)" },
  { code: "LBP", symbol: "LL ",  label: "Lebanese Pound (LL)" },
];

export function currencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code + " ";
}

interface Props {
  currency: string;
  onClose: () => void;
  onCurrencyChange: (code: string) => void;
}

type PinStep = "idle" | "current" | "new" | "confirm";

export default function FinanceSettings({ currency, onClose, onCurrencyChange }: Props) {
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);

  const [pinStep, setPinStep] = useState<PinStep>("idle");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);

  
  const setActivePin = pinStep === "current" ? setCurrentPin : pinStep === "new" ? setNewPin : setConfirmPin;

  const handleNumpad = (key: string) => {
    setActivePin(p => {
      if (key === "⌫") return p.slice(0, -1);
      if (p.length >= 6) return p;
      return p + key;
    });
    setPinError("");
  };

  const handlePinNext = async () => {
    if (pinStep === "current") {
      if (currentPin.length < 4) { setPinError("At least 4 digits"); return; }
      setPinStep("new");
    } else if (pinStep === "new") {
      if (newPin.length < 4) { setPinError("At least 4 digits"); return; }
      setPinStep("confirm");
    } else if (pinStep === "confirm") {
      if (confirmPin !== newPin) { setPinError("PINs don't match"); setConfirmPin(""); return; }
      try {
        const res = await changeFinancePin(currentPin, newPin);
        if (res.success) {
          setPinSuccess(true);
          setTimeout(() => { setPinStep("idle"); setPinSuccess(false); setCurrentPin(""); setNewPin(""); setConfirmPin(""); }, 1500);
        }
      } catch (e: any) {
        setPinError(e?.response?.data?.error || "Wrong current PIN");
        setPinStep("current");
        setCurrentPin(""); setNewPin(""); setConfirmPin("");
      }
    }
  };

  const handleSaveCurrency = async () => {
    if (selectedCurrency === currency) return;
    setCurrencySaving(true);
    await updateFinanceCurrency(selectedCurrency);
    onCurrencyChange(selectedCurrency);
    setCurrencySaving(false);
    setCurrencySaved(true);
    setTimeout(() => setCurrencySaved(false), 1500);
  };

  const pinLabel = pinStep === "current" ? "Enter current PIN" : pinStep === "new" ? "Enter new PIN" : "Confirm new PIN";
  const dots = pinStep === "current" ? currentPin : pinStep === "new" ? newPin : confirmPin;

  return (
    <div className="fsettings-overlay" onClick={onClose}>
      <div className="fsettings-modal" onClick={e => e.stopPropagation()}>
        <div className="fsettings-header">
          <span className="fsettings-title">Finance Settings</span>
          <button className="fsettings-close" onClick={onClose}>✕</button>
        </div>

        {/* Currency */}
        <section className="fsettings-section">
          <h3 className="fsettings-section-title">Currency</h3>
          <select
            className="fsettings-select"
            value={selectedCurrency}
            onChange={e => { setSelectedCurrency(e.target.value); setCurrencySaved(false); }}
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <button
            className="fsettings-btn primary"
            onClick={handleSaveCurrency}
            disabled={currencySaving || selectedCurrency === currency}
          >
            {currencySaved ? "Saved ✓" : currencySaving ? "Saving…" : "Save Currency"}
          </button>
        </section>

        <div className="fsettings-divider" />

        {/* Change PIN */}
        <section className="fsettings-section">
          <h3 className="fsettings-section-title">Change PIN</h3>

          {pinStep === "idle" && !pinSuccess && (
            <button className="fsettings-btn secondary" onClick={() => setPinStep("current")}>
              Change PIN
            </button>
          )}

          {pinSuccess && <p className="fsettings-pin-success">PIN updated successfully ✓</p>}

          {pinStep !== "idle" && !pinSuccess && (
            <div className="fsettings-pin-flow">
              <p className="fsettings-pin-label">{pinLabel}</p>
              <div className="fsettings-pin-dots">
                {[...Array(Math.max(4, dots.length))].map((_, i) => (
                  <div key={i} className={`fsettings-pin-dot ${i < dots.length ? "filled" : ""}`} />
                ))}
              </div>
              {pinError && <p className="fsettings-pin-error">{pinError}</p>}
              <div className="finance-numpad fsettings-numpad">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} className="finance-numpad-btn" onClick={() => handleNumpad(String(n))}>{n}</button>
                ))}
                <button className="finance-numpad-btn empty" />
                <button className="finance-numpad-btn" onClick={() => handleNumpad("0")}>0</button>
                <button className="finance-numpad-btn delete" onClick={() => handleNumpad("⌫")}>⌫</button>
              </div>
              <div className="fsettings-pin-actions">
                <button className="fsettings-btn secondary" onClick={() => { setPinStep("idle"); setCurrentPin(""); setNewPin(""); setConfirmPin(""); setPinError(""); }}>
                  Cancel
                </button>
                <button className="fsettings-btn primary" onClick={handlePinNext} disabled={dots.length < 4}>
                  {pinStep === "confirm" ? "Confirm" : "Next"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
