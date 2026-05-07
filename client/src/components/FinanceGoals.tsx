import { useEffect, useState } from "react";
import { getGoals, createGoal, updateGoal, deleteGoal, contributeToGoal, createTransaction } from "../financeAPI";
import type { FinanceGoal } from "../types";
import Confetti from "./Confetti";
import "./css/FinanceGoals.css";

const PRESET_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#14b8a6"];
const PRESET_ICONS = ["🎯","✈️","🏠","🚗","💻","👟","📚","🎸","💍","🌍","🏖","🎓","💪","🐶"];

type ContributeMode = "add" | "withdraw";

export default function FinanceGoals() {
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [contributeId, setContributeId] = useState<number | null>(null);
  const [contributeMode, setContributeMode] = useState<ContributeMode>("add");
  const [contributeAmt, setContributeAmt] = useState("");
  const [confetti, setConfetti] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "🎯", color: "#6366f1", target_amount: "", deadline: "" });

  useEffect(() => { getGoals().then(setGoals); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.target_amount) return;
    const data = { name: form.name, icon: form.icon, color: form.color, target_amount: Number(form.target_amount), deadline: form.deadline || null };
    if (editingId) {
      const updated = await updateGoal(editingId, data);
      setGoals(prev => prev.map(g => g.id === editingId ? updated : g));
    } else {
      const created = await createGoal(data);
      setGoals(prev => [created, ...prev]);
    }
    setForm({ name: "", icon: "🎯", color: "#6366f1", target_amount: "", deadline: "" });
    setShowForm(false); setEditingId(null);
  };

  const handleContribute = async (goal: FinanceGoal) => {
    const amt = Number(contributeAmt);
    if (!contributeAmt || isNaN(amt) || amt <= 0) return;
    const isWithdrawal = contributeMode === "withdraw";
    const effectiveAmt = isWithdrawal ? Math.min(amt, Number(goal.current_amount)) : amt;
    if (effectiveAmt === 0) return;

    const updated = await contributeToGoal(goal.id, isWithdrawal ? -effectiveAmt : effectiveAmt);
    setGoals(prev => prev.map(g => g.id === goal.id ? updated : g));

    // Fire confetti if goal just hit 100%
    const newPct = (Number(updated.current_amount) / Number(updated.target_amount)) * 100;
    const oldPct = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
    if (newPct >= 100 && oldPct < 100) {
      setConfetti(true);
    }

    await createTransaction({
      amount: effectiveAmt,
      type: isWithdrawal ? "income" : "expense",
      category_id: null,
      date: new Date().toISOString().slice(0, 10),
      note: isWithdrawal ? `Withdrew €${effectiveAmt.toFixed(2)} from ${goal.name}` : `Added €${effectiveAmt.toFixed(2)} to ${goal.name}`,
      is_recurring: false,
      is_goal: true,
    });

    setContributeId(null);
    setContributeAmt("");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this goal?")) return;
    await deleteGoal(id);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const fmt = (n: number) => `€${Number(n).toFixed(2)}`;
  const daysLeft = (deadline: string | null) => {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="finance-goals">
      <Confetti trigger={confetti} onDone={() => setConfetti(false)} />

      <div className="finance-goals-header">
        <h2>Savings Goals</h2>
        <button className="finance-add-goal-btn" onClick={() => { setShowForm(true); setEditingId(null); }}>+ New Goal</button>
      </div>

      {showForm && (
        <div className="finance-goal-form">
          <h3>{editingId ? "Edit Goal" : "New Goal"}</h3>
          <div className="finance-goal-form-row">
            <div><label>Goal Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer trip" className="finance-input" /></div>
            <div><label>Target Amount (€)</label><input type="number" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="0" className="finance-input" min="0" step="0.01" /></div>
            <div><label>Deadline (optional)</label><input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="finance-input" /></div>
          </div>
          <div><label>Icon</label>
            <div className="finance-icon-picker">
              {PRESET_ICONS.map(icon => (<button key={icon} className={`finance-icon-btn ${form.icon === icon ? "selected" : ""}`} onClick={() => setForm(f => ({ ...f, icon }))}>{icon}</button>))}
            </div>
          </div>
          <div><label>Color</label>
            <div className="finance-color-picker">
              {PRESET_COLORS.map(color => (<button key={color} className={`finance-color-swatch ${form.color === color ? "selected" : ""}`} style={{ background: color }} onClick={() => setForm(f => ({ ...f, color }))} />))}
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="finance-color-custom" />
            </div>
          </div>
          <div className="finance-goal-form-actions">
            <button className="finance-save-btn" onClick={handleSave}>Save</button>
            <button className="finance-cancel-btn" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="finance-goals-empty">No savings goals yet. Create your first one!</div>
      ) : (
        <div className="finance-goals-grid">
          {goals.map(goal => {
            const pct = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
            const done = pct >= 100;
            const days = daysLeft(goal.deadline);
            const isContributing = contributeId === goal.id;
            return (
              <div key={goal.id} className={`finance-goal-card ${done ? "done" : ""}`} style={{ borderColor: goal.color + "44" }}>
                <div className="finance-goal-card-top">
                  <span className="finance-goal-icon" style={{ background: goal.color + "22", color: goal.color }}>{goal.icon}</span>
                  <div className="finance-goal-card-info">
                    <span className="finance-goal-name">{goal.name}</span>
                    {done && <span className="finance-goal-done-badge">✅ Achieved!</span>}
                    {goal.deadline && !done && days !== null && (
                      <span className={`finance-goal-deadline ${days < 30 ? "urgent" : ""}`}>
                        {days > 0 ? `${days} days left` : "Deadline passed"}
                      </span>
                    )}
                  </div>
                  <div className="finance-goal-card-actions">
                    <button onClick={() => { setEditingId(goal.id); setForm({ name: goal.name, icon: goal.icon, color: goal.color, target_amount: String(goal.target_amount), deadline: goal.deadline || "" }); setShowForm(true); }}>✏️</button>
                    <button onClick={() => handleDelete(goal.id)}>🗑</button>
                  </div>
                </div>
                <div className="finance-goal-progress-bar">
                  <div className="finance-goal-progress-fill" style={{ width: `${pct}%`, background: done ? "#10b981" : goal.color }} />
                </div>
                <div className="finance-goal-amounts">
                  <span style={{ color: goal.color }}>{fmt(goal.current_amount)}</span>
                  <span className="muted">of {fmt(goal.target_amount)} ({pct.toFixed(0)}%)</span>
                </div>
                {isContributing && (
                  <div className="finance-contribute-input-wrap">
                    <input type="number" placeholder="Amount €" value={contributeAmt} onChange={e => setContributeAmt(e.target.value)} className="finance-input finance-contribute-input" autoFocus min="0" step="0.01" onKeyDown={e => e.key === "Enter" && handleContribute(goal)} />
                    <button className="finance-contribute-confirm-btn" style={{ background: contributeMode === "add" ? goal.color : "#ef4444" }} onClick={() => handleContribute(goal)}>
                      {contributeMode === "add" ? "Confirm Add" : "Confirm Withdraw"}
                    </button>
                    <button className="finance-cancel-btn" onClick={() => { setContributeId(null); setContributeAmt(""); }}>Cancel</button>
                  </div>
                )}
                {!done && !isContributing && (
                  <div className="finance-goal-actions-row">
                    <button className="finance-contribute-btn add" style={{ color: goal.color, borderColor: goal.color + "66" }} onClick={() => { setContributeId(goal.id); setContributeMode("add"); setContributeAmt(""); }}>+ Add funds</button>
                    <button className="finance-contribute-btn withdraw" onClick={() => { setContributeId(goal.id); setContributeMode("withdraw"); setContributeAmt(""); }}>− Withdraw</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}