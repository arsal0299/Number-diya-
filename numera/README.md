# Numera — Premium Virtual Numbers, OTP & Temporary Mail

A modern reseller platform for virtual phone numbers, instant OTP delivery and
disposable email inboxes — rebuilt from the original PHP/MySQL app into a
**React + TypeScript + Supabase + Netlify** stack with a premium, animated UI.

> Same features as the original, a brand-new premium design, English throughout,
> professional SEO, a secure serverless backend, and a Rs 50 minimum top-up.

---

## ✨ What's inside

**User features**
- Animated marketing landing page (SEO-optimised, dark/light theme)
- Email + password auth (Supabase Auth)
- Dashboard — request virtual numbers, live OTP polling, 20-min countdown, auto-refund
- Temp mail — generate disposable inboxes, read messages
- Top up — upload payment proof (min **Rs 50**), track approval status
- History — full wallet ledger + number requests

**Admin features** (`/admin`)
- Overview dashboard with platform stats
- User management — search, add/deduct credit, block/unblock, per-user detail
- Payment review — approve (auto-credits wallet) / reject with a note
- Settings — site & API config, branding (logo URL), payment details,
  per-service pricing, change password

**Security**
- API key & service-role key live only in server-side Netlify Functions — never in the browser
- Wallet operations are atomic Postgres functions (hold → finalize → refund)
- Row Level Security on every table
- Auto-refund of held balances when no OTP arrives

---

## 🧱 Tech stack

| Layer      | Tech |
|------------|------|
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS v4 |
| Animation  | Motion (Framer Motion), Lucide icons |
| Backend    | Netlify Functions (serverless, Node) |
| Database   | Supabase (Postgres + Auth + Storage) |
| Hosting    | Netlify (works on Vercel too) |

---

## 🚀 Setup (≈ 10 minutes)

### 1) Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Open **SQL Editor → New query**, paste the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and **Run**. This creates all
   tables, the wallet functions, triggers, RLS policies and the storage bucket.
3. In **Project Settings → API**, copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (keep secret!)

### 2) Configure environment variables
Copy `.env.example` to `.env` and fill in:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NP_API_KEY=your-numberpanel-tech-key      # optional, or set it from Admin → Settings
NP_BASE_URL=https://numberpanel.tech
CRON_SECRET=any-random-string              # for the auto-refund scheduler
```

> On Netlify, add the same variables under **Site settings → Environment variables**.

### 3) Install & run locally

```bash
npm install
npm run dev            # SPA on http://localhost:5173
```

To exercise the serverless functions locally, run Netlify Dev in a second terminal:

```bash
npm install -g netlify-cli
netlify dev            # functions on http://localhost:8888 (proxied by Vite)
```

### 4) Make yourself admin
1. Register an account on the site (`/register`).
2. Back in Supabase **SQL Editor**, run:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

3. Visit `/admin` — you're in.

### 5) Configure the platform
In **Admin → Settings**:
- Paste your **Number Panel API key** (from numberpanel.tech).
- Set your **price per number** and **minimum top-up** (default Rs 50).
- Add **payment details** (JazzCash / Easypaisa / bank) shown on the Top Up page.
- Optionally add a **logo URL** for branding.

---

## ☁️ Deploy to Netlify

1. Push this `numera/` folder to a GitHub repo (or set it as the repo root).
2. Netlify → **Add new site → Import from Git** → pick the repo.
3. Set:
   - **Base directory:** `numera` (if it's a subfolder) or leave blank if it's the repo root
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Add all the environment variables from step 2.
5. Deploy. 🎉

### Auto-refund scheduler (recommended)
Add a **Scheduled Function** in `netlify.toml` so expired numbers are refunded
even when no one is online:

```toml
[functions."expire-numbers"]
  schedule = "*/5 * * * *"   # every 5 minutes
```

Then in the Netlify dashboard set the same `CRON_SECRET` and call
`/api/expire-numbers?key=YOUR_CRON_SECRET`.

---

## 📁 Project structure

```
numera/
├── netlify/functions/     # serverless API (numberpanel proxy + admin)
│   └── _lib/shared.js     # auth, supabase service role, numberpanel wrapper
├── src/
│   ├── components/        # UI + layout (navbar, sidebar, cards, modal…)
│   ├── context/           # Auth, Theme, Toast, Settings providers
│   ├── lib/               # supabase client, api wrapper, utils, types
│   ├── pages/             # Home, Login, Register, app/*, admin/*
│   └── index.css          # "Aurora" design system (Tailwind v4)
├── supabase/schema.sql    # the whole database setup (run once)
├── index.html             # SEO meta + fonts
└── netlify.toml
```

---

## 🔁 Migrating from the old PHP app

All original features are preserved and mapped to the new stack:

| Original (PHP/MySQL) | New (React/Supabase) |
|---|---|
| `users` / `admins` tables | `profiles` (Supabase Auth + `is_admin`) |
| MySQL wallet SQL | Postgres RPC (`hold_wallet`, `finalize_hold`, …) |
| `numberpanel_api.php` | `netlify/functions/_lib/shared.js` → `NP.*` |
| `cron/expire_numbers.php` | `netlify/functions/expire-numbers.js` (scheduled) |
| File uploads to disk | Supabase Storage (`payments` bucket) |
| `.htaccess` security | RLS + server-side service role |

---

## 🛡️ Notes & limits

- The numberpanel API key is read from `NP_API_KEY` env first, then from the
  `settings` table — your choice where to store it (env is more secure).
- Passwords are managed by Supabase Auth (bcrypt-hashed); the old admin password
  is **not** reused — register a fresh account and promote it.
- The public landing page is fully SEO-indexable; app/admin routes are excluded
  in `robots.txt`.

Built with care. Adjust the brand colors in `src/index.css` (the `@theme` block)
to make it yours.
