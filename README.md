# West-Coast AI Card Scanner & CRM — v2.0 (Cloud)

## Kya badla
- **Password ek baar** — "Remember me" tick karo, 30 din tak dobara password nahi puchega.
- **Kisi bhi PC / laptop / mobile par same data** — sab Supabase cloud database me save hota hai.
- **Auto-save** — Save button hata diya. Card scan hote hi save, edit karte hi save. Upar "All saved ✓" dikhta hai.
- **Perfect data** — photo ki rotation/contrast auto-fix, Gemini high-resolution reading, phone/email/GST/PIN
  ki auto-safai, GST checksum verify, shak hone par AI dobara dhyaan se padhta hai.
- Fake "Sandbox / Simulation" data poori tarah hata diya (wahi galat data ka kaaran tha).

## Setup (ek baar) — Vercel
1. **Supabase** (supabase.com, free) → New project → SQL Editor → `supabase-setup.sql` paste → Run.
2. Supabase → Project Settings → API Keys → `Project URL` aur `service_role` (secret) key copy karo.
3. **Gemini key**: aistudio.google.com → Get API key.
4. Ye folder GitHub repo me push karo.
5. **Vercel** → Add New → Project → GitHub repo Import → Framework "Vite" (auto) → Environment Variables me ye 5 add karo:
   | Key | Value |
   |---|---|
   | GEMINI_API_KEY | Gemini key |
   | SUPABASE_URL | Supabase Project URL |
   | SUPABASE_SERVICE_ROLE_KEY | service_role key |
   | ADMIN_PASSWORD | Admin ka password |
   | AUTH_SECRET | koi bhi lamba random text (32+ akshar) |
6. Deploy dabao. Baad me env variable badlo to **Redeploy** zaroor karo.
7. `Admin` + ADMIN_PASSWORD se login → **Manage Employees** me employees add karo.

## Local chalana
`npm install` → `npm i -g vercel` → `.env` banao (`.env.example` dekho) → `vercel dev`
