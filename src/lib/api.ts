import { ContactRecord, ActivityLog } from "../types";

/* ============ Session (Remember me) ============ */
const TOKEN_KEY = "wc_crm_token";
const NAME_KEY = "wc_crm_last_name";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(token: string, remember: boolean) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {}
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}
export const getLastName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } };
const setLastName = (n: string) => { try { localStorage.setItem(NAME_KEY, n); } catch {} };

export class AuthError extends Error {}

/* ============ Save status (auto-save indicator) ============ */
export type SaveState = "idle" | "saving" | "saved" | "error";
let pending = 0;
let listeners: ((s: SaveState) => void)[] = [];
export const onSaveState = (fn: (s: SaveState) => void) => {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
};
const emit = (s: SaveState) => listeners.forEach((l) => l(s));

/* ============ Core request ============ */
async function request(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new AuthError(data.error || "Session expired");
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data;
}

/** Write with automatic retry (internet slow/band ho to bhi data na jaye) */
async function write(path: string, opts: RequestInit) {
  pending++;
  emit("saving");
  let lastErr: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const out = await request(path, opts);
      pending--;
      if (pending === 0) emit("saved");
      return out;
    } catch (e) {
      lastErr = e;
      if (e instanceof AuthError || (e as Error).message?.includes("Password")) break;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  pending--;
  emit("error");
  throw lastErr;
}

/* ============ API ============ */
export interface Me { name: string; role: string }
export interface DbState {
  me: Me;
  records: ContactRecord[];
  activity: ActivityLog[];
  employees: string[];
  employeePasswords?: Record<string, string>;
}

export async function login(name: string, password: string, remember: boolean): Promise<Me> {
  const data = await request("/api/login", { method: "POST", body: JSON.stringify({ name, password, remember }) });
  setToken(data.token, remember);
  setLastName(data.user.name);
  return { name: data.user.name, role: data.user.role };
}

export const fetchDb = (): Promise<DbState> => request("/api/db");

export const saveRecord = (record: ContactRecord) =>
  write("/api/records", { method: "POST", body: JSON.stringify({ record }) });

export const saveRecords = (records: ContactRecord[]) =>
  write("/api/records", { method: "POST", body: JSON.stringify({ records }) });

export const deleteRecord = (id: string, password?: string) =>
  write(`/api/records/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({ password }) });

export const logActivity = (msg: string) =>
  request("/api/activity", { method: "POST", body: JSON.stringify({ msg }) }).catch(() => {});

export const saveEmployees = (employees: string[], employeePasswords: Record<string, string>) =>
  write("/api/employees", { method: "POST", body: JSON.stringify({ employees, employeePasswords }) });

export async function scanCard(id: string, base64Data: string, mimeType: string) {
  const data = await request("/api/scan", { method: "POST", body: JSON.stringify({ id, base64Data, mimeType }) });
  return data.fields as Partial<ContactRecord> & { suggestions?: string };
}

export const imageUrl = (id: string) => `/api/images/${encodeURIComponent(id)}?t=${encodeURIComponent(getToken() || "")}`;
