import { useState } from "react";
import axios from "axios";
import "./css/LoginPage.css";

interface Props {
  onLogin: (user: { id: number; email: string; username: string }) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "auth/login" : "auth/register";
      const payload = mode === "login" ? { email, password } : { email, username, password };
      const { data } = await axios.post(`/api/${endpoint}`, payload);
      localStorage.setItem("orbit_token", data.accessToken);
      localStorage.setItem("orbit_refresh", data.refreshToken);
      localStorage.setItem("orbit_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || (mode === "login" ? "Login failed" : "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => (m === "login" ? "register" : "login"));
    setError("");
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
          {mode === "register" && (
            <div className="login-field">
              <label>Username</label>
              <input
                type="text"
                placeholder="yourname"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
          )}
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
            {loading
              ? (mode === "login" ? "Signing in…" : "Creating account…")
              : (mode === "login" ? "Sign in" : "Create account")}
          </button>
        </form>

        <p className="login-switch">
          {mode === "login" ? "No account? " : "Already registered? "}
          <button className="login-switch-btn" type="button" onClick={switchMode}>
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>

        <p className="login-footer">Orbit V2 · Personal Space</p>
      </div>
    </div>
  );
}
