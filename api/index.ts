/**
 * West-Coast AI CRM — Cloud API (Vercel Function)
 * Data  : Supabase (Postgres + Storage)  -> har PC / laptop / mobile par same data
 * AI    : Gemini (card reading)          -> API key server par hi rehti hai
 * Auth  : Signed token (Remember me = 30 din, warna 12 ghante)
 */
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type, ThinkingLevel, MediaResolution } from "@google/genai";
import crypto from "node:crypto";


// ---------- ENV ----------
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "785978";
const AUTH_SECRET = process.env.AUTH_SECRET || (SUPABASE_KEY ? "wc-" + SUPABASE_KEY.slice(-32) : "");
const DEFAULT_EMP_PASSWORD = "12345";
const BUCKET = "card-images";

const db = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;

// ---------- HELPERS ----------
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
const fail = (msg: string, status = 500) => json({ error: msg }, status);

type User = { name: string; role: "Admin" | "Employee"; exp: number };

const b64url = (s: Buffer | string) => Buffer.from(s).toString("base64url");
function signToken(u: User) {
  const body = b64url(JSON.stringify(u));
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyToken(token?: string | null): User | null {
  if (!token || !AUTH_SECRET) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const u = JSON.parse(Buffer.from(body, "base64url").toString()) as User;
    return u.exp > Date.now() ? u : null;
  } catch { return null; }
}
function getUser(req: Request, url: URL) {
  const h = req.headers.get("authorization") || "";
  return verifyToken(h.startsWith("Bearer ") ? h.slice(7) : url.searchParams.get("t"));
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await db!.from("wc_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? fallback;
}
async function setSetting(key: string, value: unknown) {
  const { error } = await db!.from("wc_settings").upsert({ key, value });
  if (error) throw error;
}

function employeePassword(name: string, employees: string[], pwds: Record<string, string>) {
  const reg = employees.find((e) => e.toLowerCase() === name.toLowerCase());
  if (!reg) return null; // registered nahi hai -> login nahi
  return pwds[reg] || pwds[reg.toLowerCase()] || DEFAULT_EMP_PASSWORD;
}

// ---------- DATA CLEANING (perfect data) ----------
const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};
const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function gstValid(g: string) {
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = GST_CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36] === g[14];
}
function cleanPhone(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  // pehla number hi rakho agar "/" ya "," se do number likhe ho
  const first = s.split(/[,;/|]| or /i)[0].trim();
  const plus = first.startsWith("+");
  const d = first.replace(/\D/g, "");
  // Landline pehchano: country code hata ke pehla group 2-4 digit ka (079-2658..., +91 79 2658 ...)
  const rest = first.replace(/^\s*(\+?91|0091)[\s-]*/, "").replace(/^\(?0/, "0");
  const groups = rest.split(/\D+/).filter(Boolean);
  const local = d.replace(/^(0091|91(?=\d{10}$))/, "").replace(/^0/, "");
  if (groups.length > 1 && groups[0].replace(/^0/, "").length >= 2 && groups[0].replace(/^0/, "").length <= 4 && local.length === 10) {
    const std = groups[0].replace(/^0/, "");
    return "0" + std + "-" + local.slice(std.length); // landline: 079-26584411
  }
  if (d.length === 12 && d.startsWith("91") && /^[6-9]/.test(d.slice(2))) return "+91 " + d.slice(2);
  if (d.length === 11 && d.startsWith("0") && /^[6-9]/.test(d.slice(1))) return "+91 " + d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return "+91 " + d;
  return plus ? "+" + d : first.replace(/\s+/g, " ");
}
const digits10 = (p: string) => (p || "").replace(/\D/g, "").slice(-10);
const titleCase = (s: string) =>
  s && s === s.toUpperCase() && s.length > 3
    ? s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Dr|Mr|Mrs|Ms)\b\.?/g, "$1.")
    : s;

function normalize(f: Record<string, string>) {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(f || {})) o[k] = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : (v as any) ?? "";
  const issues: string[] = [];

  o.name = titleCase(o.name || "");
  o.mobile = cleanPhone(o.mobile);
  o.whatsapp = cleanPhone(o.whatsapp);
  o.altPhone = cleanPhone(o.altPhone);
  if (o.altPhone && digits10(o.altPhone) === digits10(o.mobile)) o.altPhone = "";

  if (o.email) {
    o.email = o.email.toLowerCase().replace(/\s/g, "").replace(/^mailto:/, "").replace(/[.,;]+$/, "");
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(o.email)) issues.push("email");
  }
  if (o.website) {
    o.website = o.website.toLowerCase().replace(/\s/g, "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  if (o.gst) {
    o.gst = o.gst.toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (!gstValid(o.gst)) issues.push("gst");
    else if (!o.state && GST_STATES[o.gst.slice(0, 2)]) o.state = GST_STATES[o.gst.slice(0, 2)];
  }
  if (o.pin) {
    const p = o.pin.replace(/\D/g, "");
    if (p.length === 6) o.pin = p;
    else if (/india/i.test(o.country || "") || !o.country) issues.push("pin");
  }
  if (!o.country && (o.gst || /^\+91/.test(o.mobile) || /^\d{6}$/.test(o.pin))) o.country = "India";
  const m = digits10(o.mobile);
  if (o.mobile && m.length < 10 && !o.mobile.startsWith("0")) issues.push("mobile");
  if (!o.name && !o.company) issues.push("name/company");
  return { fields: o, issues };
}

// ---------- GEMINI ----------
let ai: GoogleGenAI | null = null;
const getAi = () => (ai ||= new GoogleGenAI({ apiKey: GEMINI_KEY }));

const FIELD_KEYS = ["name","designation","department","company","businessType","gst","mobile","whatsapp","altPhone",
  "email","website","address","city","state","country","pin","linkedin","facebook","instagram","twitter","qrData",
  "notes","category","suggestions"];
const schema = {
  type: Type.OBJECT,
  properties: Object.fromEntries(FIELD_KEYS.map((k) => [k, { type: Type.STRING }])),
  required: FIELD_KEYS,
};

const PROMPT = `You are an expert data-entry operator reading an Indian business / visiting card (photo or PDF).
The photo may be tilted, rotated, upside-down, blurred, dark, glossy, have shadows, or show both sides of the card. Read it anyway, character by character.

STRICT RULES:
- Copy text EXACTLY as printed. Never invent, guess or "complete" anything. If a field is not printed, return "".
- name: the person's name only (keep Dr./CA prefix). designation: job title only. company: firm name exactly as printed.
- mobile: the main mobile number. whatsapp: only if a WhatsApp icon/label is next to a number (else ""). altPhone: one other number (landline/office).
  Keep every digit; include country/STD code if printed. Double-check confusable digits (1/7, 3/8, 5/6, 0/8).
- email: exact, lowercase. website: domain as printed.
- gst: 15-character GSTIN only (format 24ABCDE1234F1Z5). Check O vs 0, I vs 1, S vs 5, B vs 8.
- address: street/building/area line. city, state, pin (6-digit Indian PIN), country separately.
- If multiple people are on the card use the most prominent one; put other people/numbers in notes.
- linkedin/facebook/instagram/twitter: handles or URLs if printed. qrData: "" unless QR text is visible as text.
- category: exactly one of "Doctor","Hospital","Pharmacy","Distributor","Retailer","Supplier","Vendor","Manufacturer","Corporate","Export Customer","Import Customer","Government","Other".
- businessType: short description of the business (e.g. "Pharma Distributor", "API Manufacturer").
- suggestions: one short sentence only if some text was unreadable or doubtful, else "".`;

async function geminiExtract(base64: string, mimeType: string, extra?: string) {
  const res = await getAi().models.generateContent({
    model: GEMINI_MODEL,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: extra ? PROMPT + "\n\n" + extra : PROMPT },
      ],
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
      thinkingConfig: { thinkingLevel: extra ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW },
    },
  });
  const txt = (res.text || "").replace(/```json|```/g, "").trim();
  if (!txt) throw new Error("AI se khali jawab aaya. Dobara try karein.");
  return JSON.parse(txt);
}

function niceAiError(e: any) {
  const s = (() => { try { return JSON.stringify(e) + " " + (e?.message || ""); } catch { return String(e); } })();
  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(s)) return "Gemini API key galat hai. Vercel > Settings > Environment Variables me GEMINI_API_KEY check karein.";
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(s)) return "Gemini quota/limit khatam. Thodi der baad Retry dabayein.";
  if (/UNAVAILABLE|503|overloaded/i.test(s)) return "Gemini server busy hai. Retry dabayein.";
  return e?.message || "Card read nahi ho paya.";
}

// ---------- ROUTER ----------
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // vercel.json rewrite: /api/xyz -> /api?route=xyz
  const route = (url.searchParams.get("route") || url.pathname.replace(/^\/api\/?/, "")).replace(/^\/|\/$/g, "");
  const method = req.method;

  if (!db) return fail("Server setup adhoora hai: Vercel me SUPABASE_URL aur SUPABASE_SERVICE_ROLE_KEY set karein.", 500);

  try {
           // ----- HEALTH CHECK (test ke baad hata dena) -----
       if (route === "health") {
         let keyType = "unknown";
         if (SUPABASE_KEY.startsWith("sb_secret_")) keyType = "secret key (SAHI)";
         else if (SUPABASE_KEY.startsWith("sb_publishable_")) keyType = "publishable key (GALAT)";
         else if (SUPABASE_KEY.startsWith("eyJ")) {
           try { keyType = "legacy key, role = " + JSON.parse(Buffer.from(SUPABASE_KEY.split(".")[1], "base64").toString()).role; }
           catch { keyType = "legacy key (unreadable)"; }
         }
         const read = await db.from("wc_settings").select("key").limit(1);
         const write = await db.from("wc_activity").insert({ by_user: "health-check", msg: "test" });
         const bucket = await db.storage.getBucket(BUCKET);
         return json({
           supabaseUrl: SUPABASE_URL,
           keyType,
           keyLength: SUPABASE_KEY.length,
           geminiKey: !!GEMINI_KEY,
           authSecret: !!process.env.AUTH_SECRET,
           readError: read.error?.message || "OK",
           writeError: write.error?.message || "OK",
           bucketError: bucket.error?.message || "OK",
         });
       }
    // ----- LOGIN (public) -----
    if (route === "login" && method === "POST") {
      const { name = "", password = "", remember = false } = await req.json();
      const n = String(name).trim();
      if (!n || !password) return fail("Naam aur password dono daalein.", 400);
      let role: User["role"] = "Employee";
      let finalName = n;
      if (n.toLowerCase() === "admin") {
        if (password !== ADMIN_PASSWORD) return fail("Admin password galat hai.", 401);
        role = "Admin"; finalName = "Admin";
      } else {
        const employees = await getSetting<string[]>("employees", []);
        const pwds = await getSetting<Record<string, string>>("employeePasswords", {});
        const expected = employeePassword(n, employees, pwds);
        if (expected === null) return fail("Ye naam registered nahi hai. Admin se 'Manage Employees' me add karwayein.", 401);
        if (password !== expected) return fail("Password galat hai.", 401);
        finalName = employees.find((e) => e.toLowerCase() === n.toLowerCase())!;
      }
      const exp = Date.now() + (remember ? 30 * 24 : 12) * 3600 * 1000;
      const user: User = { name: finalName, role, exp };
      await db.from("wc_activity").insert({ by_user: finalName, msg: `${finalName} signed in as ${role === "Admin" ? "Administrator" : "Employee"}` });
      return json({ token: signToken(user), user });
    }

    const user = getUser(req, url);
    if (!user) return fail("Session expire ho gaya. Dobara login karein.", 401);
    const isAdmin = user.role === "Admin";

    // ----- LOAD EVERYTHING -----
    if (route === "db" && method === "GET") {
      const records: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from("wc_contacts").select("data").order("record_id").range(from, from + 999);
        if (error) throw error;
        records.push(...(data || []).map((r) => r.data));
        if (!data || data.length < 1000) break;
      }
      records.sort((a, b) => String(b.scanDate || "").localeCompare(String(a.scanDate || "")));
      const { data: act, error: actErr } = await db.from("wc_activity").select("at,by_user,msg").order("at", { ascending: false }).limit(300);
      if (actErr) throw actErr;
      const employees = await getSetting<string[]>("employees", []);
      const out: any = {
        me: { name: user.name, role: user.role },
        records,
        activity: (act || []).map((a) => ({ at: a.at, by: a.by_user, msg: a.msg })),
        employees,
      };
      if (isAdmin) out.employeePasswords = await getSetting("employeePasswords", {});
      return json(out);
    }

    // ----- SAVE RECORD(S) (auto-save) -----
    if (route === "records" && method === "POST") {
      const body = await req.json();
      const list: any[] = Array.isArray(body.records) ? body.records : [body.record];
      const rows = list.filter((r) => r && r.recordId).map((r) => ({ record_id: r.recordId, data: r, updated_at: new Date().toISOString() }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from("wc_contacts").upsert(rows.slice(i, i + 500));
        if (error) throw error;
      }
      return json({ success: true, count: rows.length });
    }

    // ----- DELETE RECORD -----
    if (route.startsWith("records/") && method === "DELETE") {
      const id = decodeURIComponent(route.slice(8));
      if (!isAdmin) {
        const { password = "" } = await req.json().catch(() => ({}));
        const employees = await getSetting<string[]>("employees", []);
        const pwds = await getSetting<Record<string, string>>("employeePasswords", {});
        const own = employeePassword(user.name, employees, pwds);
        if (password !== own && password !== ADMIN_PASSWORD) return fail("Password galat hai. Delete ke liye sahi password chahiye.", 403);
      }
      const { error } = await db.from("wc_contacts").delete().eq("record_id", id);
      if (error) throw error;
      await db.storage.from(BUCKET).remove([`${id}.jpg`, `${id}.png`, `${id}.pdf`]);
      return json({ success: true });
    }

    // ----- ACTIVITY LOG -----
    if (route === "activity" && method === "POST") {
      const { msg } = await req.json();
      if (msg) await db.from("wc_activity").insert({ by_user: user.name, msg: String(msg).slice(0, 500) });
      return json({ success: true });
    }

    // ----- EMPLOYEES (admin) -----
    if (route === "employees" && method === "POST") {
      if (!isAdmin) return fail("Sirf Admin ye kar sakta hai.", 403);
      const { employees = [], employeePasswords = {} } = await req.json();
      await setSetting("employees", employees);
      await setSetting("employeePasswords", employeePasswords);
      return json({ success: true });
    }

    // ----- SCAN CARD (AI + image archive) -----
    if (route === "scan" && method === "POST") {
      if (!GEMINI_KEY) return fail("Vercel me GEMINI_API_KEY set nahi hai.", 500);
      const started = Date.now();
      const { id, base64Data, mimeType = "image/jpeg" } = await req.json();
      if (!base64Data) return fail("Image nahi mili.", 400);
      const clean = String(base64Data).replace(/^data:[^;]+;base64,/, "");

      // 1) image cloud me archive (AI ke saath-saath)
      const ext = mimeType.includes("pdf") ? "pdf" : mimeType.includes("png") ? "png" : "jpg";
      const upload = id
        ? db.storage.from(BUCKET).upload(`${id}.${ext}`, Buffer.from(clean, "base64"), { contentType: mimeType, upsert: true })
        : Promise.resolve(null);

      // 2) AI read
      let raw: any;
      try { raw = await geminiExtract(clean, mimeType); }
      catch (e) { await upload; return fail(niceAiError(e), 502); }
      let { fields, issues } = normalize(raw);

      // 3) Doubt ho to dusri baar dhyaan se padhwao (verification pass)
      if (issues.length && Date.now() - started < 12000) {
        try {
          const hint = `A first reading gave this JSON:\n${JSON.stringify(raw)}\nThese fields look WRONG or incomplete: ${issues.join(", ")}. ` +
            `Look at the card again very carefully, zoom into those fields, and return the full corrected JSON. Keep fields that were correct.`;
          const raw2 = await geminiExtract(clean, mimeType, hint);
          const second = normalize(raw2);
          if (second.issues.length <= issues.length) ({ fields, issues } = second);
        } catch { /* pehla result hi rakho */ }
      }
      const up: any = await upload;
      const doubt: string[] = [];
      if (issues.includes("gst")) doubt.push("GST number verify karein (checksum match nahi hua)");
      if (issues.includes("email")) doubt.push("email format check karein");
      if (issues.includes("mobile")) doubt.push("mobile number adhoora lag raha hai");
      if (issues.includes("pin")) doubt.push("PIN code check karein");
      fields.suggestions = [fields.suggestions, ...doubt].filter(Boolean).join(" • ");
      return json({ fields, issues, imageExt: up?.error ? "" : ext });
    }

    // ----- IMAGE VIEW -----
    if (route.startsWith("images/") && method === "GET") {
      const id = decodeURIComponent(route.slice(7));
      for (const ext of ["jpg", "png", "pdf"]) {
        const { data } = await db.storage.from(BUCKET).download(`${id}.${ext}`);
        if (data) {
          return new Response(await data.arrayBuffer(), {
            headers: {
              "Content-Type": ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : "png"}`,
              "Cache-Control": "private, max-age=86400",
            },
          });
        }
      }
      return new Response("Not found", { status: 404 });
    }

    return fail("Route nahi mila: " + route, 404);
  } catch (e: any) {
    console.error(e);
    return fail(e?.message || "Server error", 500);
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
