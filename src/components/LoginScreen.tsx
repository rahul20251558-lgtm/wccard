import React, { useState } from "react";
import { Shield, AlertCircle, LoaderCircle } from "lucide-react";
import { WEST_COAST_LOGO } from "../lib/logo";
import { login, getLastName, Me } from "../lib/api";

interface LoginScreenProps {
  onLogin: (me: Me) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [name, setName] = useState(getLastName());
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please enter your name.");
    if (!password) return setError("Please enter the password.");
    setBusy(true);
    try {
      const me = await login(name.trim(), password, remember);
      onLogin(me);
    } catch (err: any) {
      setError(err.message || "Login failed. Internet check karein.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wcp min-h-screen flex items-center justify-center p-4" style={{ background: "var(--side-grad)" }}>
      <div className="card pad w-full max-w-[400px] p-8 bg-[var(--panel)] shadow-[var(--shadow-lg)]">
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm flex justify-center">
          <img src={WEST_COAST_LOGO} alt="West-Coast Pharmaceutical Works Ltd." className="h-12 object-contain" />
        </div>

        <h1 className="h1 text-xl text-center mb-1 text-[var(--text)]">AI CRM Portal</h1>
        <p className="sub text-center mb-6 text-sm text-[var(--muted)]">
          Scan visiting cards, manage leads — data har device par cloud me safe.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flabel block text-xs font-bold uppercase tracking-wider text-[var(--faint)] mb-2">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Admin or Rakesh Shah"
              className="w-full"
              autoComplete="username"
              required
              autoFocus={!name}
            />
          </div>

          <div>
            <label className="flabel block text-xs font-bold uppercase tracking-wider text-[var(--faint)] mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pr-12"
                autoComplete="current-password"
                required
                autoFocus={!!name}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-[var(--blue)]"
              style={{ width: 16, height: 16 }}
            />
            <span>Remember me <span className="text-[var(--faint)] text-xs">(30 din tak password nahi puchega)</span></span>
          </label>

          <button type="submit" disabled={busy || !name.trim() || !password} className="btn primary w-full justify-center py-3 mt-2">
            {busy ? <LoaderCircle size={16} className="spin" /> : <Shield size={16} />} Enter CRM Space
          </button>
        </form>

        <div className="mt-6 border-t border-[var(--border)] pt-4 text-center">
          <p className="text-[11px] text-[var(--faint)] leading-relaxed">
            Authorized access only. Shared / public computer par "Remember me" band rakhein.
          </p>
        </div>
      </div>
    </div>
  );
}
