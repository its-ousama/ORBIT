import { useState } from "react";
import axios from "axios";
import "./css/LoginPage.css";

interface Props {
  onLogin: (user: { id: number; email: string; username: string }) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post("http://localhost:3001/api/auth/login", { email, password });
      localStorage.setItem("orbit_token", data.accessToken);
      localStorage.setItem("orbit_refresh", data.refreshToken);
      localStorage.setItem("orbit_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-orbit-ring">
            <div className="login-orbit-core" />
          </div>
          <h1 className="login-title">Orbit</h1>
          <p className="login-subtitle">Everything revolves around you.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="login-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="login-footer">Orbit V2 · Personal Space</p>
      </div>
    </div>
  );
}
