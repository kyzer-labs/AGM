# AGM Voting Site — Setup Guide

This is a Next.js 15 (App Router) + Convex + Firebase Auth app, run with **Bun**. The frontend is in `app/`, `components/`, `lib/`. The backend is in `convex/`.

You only need to do the steps in this file once. They cover:

1. Install local dependencies.
2. Create a Firebase project and enable **Microsoft** sign-in.
3. Create a Convex project and link it to this repo.
4. Wire the two together with environment variables.
5. Bootstrap the first super admin.

When you finish, both `bunx convex dev` and `bun dev` will run cleanly and you can sign in with your `@student.usm.my` account.

---

## 0. Prerequisites

- **Bun** ≥ 1.3 (you already have `1.3.13`).
- **Node** ≥ 20 (you have `22.x`). Required by `firebase-tools` CLI.
- A Microsoft / Azure AD account that can create an **App registration** (this is what backs `signInWithMicrosoft`). For USM-restricted sign-in this should ideally be in the USM Microsoft 365 tenant, but `common` works fine for development.

---

## 1. Install dependencies

```bash
bun install
```

This installs `next`, `react`, `convex`, `firebase`, `react-hook-form`, `zod`, `papaparse`, `tailwindcss`, etc.

Do **not** run `bun dev` yet — we need env vars first.

---

## 2. Firebase: project, web app, Microsoft sign-in

### 2.1 Create the Firebase project

You can use either the Firebase CLI or the console. CLI is faster:

```bash
# log in once
bunx firebase-tools login --no-localhost   # use --no-localhost on remote shells

# create the project (pick any unique id, e.g. usm-css-agm-2026)
bunx firebase-tools projects:create usm-css-agm-2026 \
  --display-name "USM CSS AGM 2026"

# select it as the active project for this repo
bunx firebase-tools use --add usm-css-agm-2026
```

If you prefer the console: [https://console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it → disable Analytics for simplicity.

### 2.2 Add a Web app to the project

```bash
bunx firebase-tools apps:create WEB "AGM Web"
```

Then read its config:

```bash
bunx firebase-tools apps:list WEB
# pick the appId of "AGM Web" from the output, then:
bunx firebase-tools apps:sdkconfig WEB <appId>
```

Save the values from `firebaseConfig` — you'll paste them into `.env.local` in step 4.

### 2.3 Enable Microsoft sign-in

Microsoft OAuth must be enabled in the Firebase console (the CLI doesn't yet support enabling it):

1. Open **Firebase console → Authentication → Sign-in method**.
2. Enable **Microsoft**. You'll be asked for an **Application (client) ID** and **Application secret** from Azure AD.
3. In a new tab, open the [Azure portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) and **New registration**:
   - **Name**: `USM CSS AGM`.
   - **Supported account types**: **important** — you must pick a **multi-tenant** option, because Firebase calls Microsoft's `/common/` endpoint by default. Pick either:
     - **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts** — recommended; accepts USM student accounts plus any other Microsoft account. The app's USM domain check rejects non-USM emails after sign-in anyway.
     - **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)** — org/school accounts only (still includes `@student.usm.my`).
   - If you accidentally created it as single-tenant, you'll see Firebase error **AADSTS50194** at sign-in. Open the app's **Authentication** page and change **Supported account types** to one of the multi-tenant options, then save.
   - **Redirect URI**: set platform `Web`, value
     `https://<your-firebase-project-id>.firebaseapp.com/__/auth/handler`
     (the Firebase console shows you the exact URL).
4. After creation, copy the **Application (client) ID** into Firebase Microsoft provider config.
5. Under **Certificates & secrets** in Azure, **New client secret**, copy the value (not the secret ID), and paste it into Firebase Microsoft provider config.
6. Save in Firebase. Microsoft sign-in is now enabled.

### 2.4 Add localhost to authorized domains

Still in Firebase **Authentication → Settings → Authorized domains**, ensure `localhost` is listed. Add your eventual production domain later (e.g. Firebase App Hosting URL).

### 2.5 Decide the Microsoft tenant

In `.env.local` you'll set `NEXT_PUBLIC_MICROSOFT_TENANT`. Options:

- `common` — accepts any Microsoft account (good for early testing).
- `organizations` — any work/school account.
- `<USM tenant id>` — restrict to USM only. Find this from your USM IT admin or from any USM Azure AD URL like `https://login.microsoftonline.com/<tenant-id>/...`.

The app **always** rejects sign-ins whose email doesn't end in `@student.usm.my`, regardless of tenant. The tenant id just adds a second filter at Microsoft's end.

---

## 3. Convex: project, dev deployment, env vars

### 3.1 Create / link the project

From the repo root:

```bash
bunx convex dev
```

The very first run will ask you to:

1. Sign in to Convex (browser opens).
2. Create a new project (e.g. `usm-css-agm`) and pick "**dev**" deployment.

It writes:

- `.env.local` with `CONVEX_DEPLOYMENT=...` and `NEXT_PUBLIC_CONVEX_URL=...`.
- `convex/_generated/` — typed client/server bindings used by the app.

Leave `bunx convex dev` running in this terminal — it watches `convex/*.ts` and pushes changes live.

### 3.2 Configure Convex deployment env vars

In a **second** terminal, tell the Convex deployment two things.

**a) Trust Firebase ID tokens for your project:**

```bash
bunx convex env set FIREBASE_PROJECT_ID <your-firebase-project-id>
```

**b) Generate and set the one-time super-admin bootstrap token:**

Generate it first into a shell variable so you can see and save the value, *then* push it to Convex:

```bash
# 1. Generate and display the token (save this somewhere — password manager, notes, etc.)
SUPER_ADMIN_TOKEN="$(openssl rand -hex 32)"
echo "Save this token: $SUPER_ADMIN_TOKEN"

# 2. Push it to the Convex deployment env
bunx convex env set SUPER_ADMIN_BOOTSTRAP_TOKEN "$SUPER_ADMIN_TOKEN"
```

You'll paste this token once in step 6 to claim super admin. After that it becomes inert.

> If you already ran `bunx convex env set SUPER_ADMIN_BOOTSTRAP_TOKEN "$(openssl rand -hex 32)"` and didn't capture the value, retrieve it with:
>
> ```bash
> bunx convex env get SUPER_ADMIN_BOOTSTRAP_TOKEN
> ```
>
> Or just overwrite it with a fresh, captured value:
>
> ```bash
> SUPER_ADMIN_TOKEN="$(openssl rand -hex 32)"
> echo "Save this token: $SUPER_ADMIN_TOKEN"
> bunx convex env set SUPER_ADMIN_BOOTSTRAP_TOKEN "$SUPER_ADMIN_TOKEN"
> ```

> The Convex auth bridge in `convex/auth.config.ts` reads `FIREBASE_PROJECT_ID` and configures the deployment to accept Firebase ID tokens with issuer `https://securetoken.google.com/<projectId>` and audience `<projectId>`. After you set this env var, `bunx convex dev` will hot-reload and the deployment will start trusting Firebase tokens.

---

## 4. Frontend env vars

Copy the example and fill it in:

```bash
cp .env.example .env.local
```

Open `.env.local` and set:


| Variable                                   | Where to find it                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | `firebaseConfig.apiKey` from step 2.2                                          |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | `firebaseConfig.authDomain`                                                    |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | `firebaseConfig.projectId`                                                     |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | `firebaseConfig.appId`                                                         |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | `firebaseConfig.storageBucket` (optional)                                      |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `firebaseConfig.messagingSenderId` (optional)                                  |
| `NEXT_PUBLIC_MICROSOFT_TENANT`             | `common` for dev, the USM tenant id later                                      |
| `NEXT_PUBLIC_CONVEX_URL`                   | Already written by `bunx convex dev` into your `.env.local` — keep that value  |
| `SUPER_ADMIN_BOOTSTRAP_TOKEN`              | Same value you set in Convex env. Used only by the first super admin in step 6 |


`NEXT_PUBLIC_CONVEX_URL` should already be present — `bunx convex dev` writes it for you.

---

## 5. Run the app

In two terminals:

```bash
# terminal 1 — Convex backend (keep running)
bunx convex dev

# terminal 2 — Next.js frontend (keep running)
bun dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the landing page with a **Sign in with Microsoft** button.

---

## 6. Bootstrap the first super admin

1. Click **Sign in with Microsoft** and sign in with **your own** `@student.usm.my` account.
2. You'll be redirected to `/profile/complete`. Fill in full name, matric, year of study. Save.
3. You land on `/dashboard`. Click **Admin console** (the tile only shows for admins, but you can navigate to `/admin` directly).
4. On `/admin`, the page detects "no super admin yet" and shows a **First-time setup** card.
5. Paste the `SUPER_ADMIN_BOOTSTRAP_TOKEN` value, click **Become super admin**.
6. The page reloads — you now have super-admin access. The bootstrap card disappears forever.

From this point on, additional admins are added by you via the (forthcoming) `/admin/admins` page using `grantAdmin`/`revokeAdmin` Convex mutations — no shared password needed.

---

## 7. What's implemented today vs. coming next

This first slice (Phases 0–2 from the plan) is in place:

- USM-domain-locked Microsoft sign-in.
- Convex/Firebase auth bridge.
- `voters` profile flow with full validation server-side.
- `admins` allowlist with super-admin bootstrap.
- `auditLog` populated by every privileged mutation.
- Landing, dashboard, profile, admin landing, and placeholders for internal/vote/results.

Everything below is scaffolded in the schema and will be wired up next:

- Phase 3: election cycle config, position hierarchy, candidate CRUD with photos, internal whitelist CSV import.
- Phase 4: rubric evaluation grid + window controls.
- Phase 5: live AGM voting with cascade rules and live admin counts.
- Phase 6: 75/25 normalization, ties, publishing.
- Phase 7: CSV exports, restricted emergency audit, error states, runbook.

---

## 8. Troubleshooting

- `**Firebase environment variables are missing`** — `.env.local` not created or app not restarted after edit. Stop `bun dev`, re-check the file, restart.
- `**NEXT_PUBLIC_CONVEX_URL is not set**` — run `bunx convex dev` once first; it writes the URL.
- `**FIREBASE_PROJECT_ID is not set**` — you set it on the *Convex* deployment, not in `.env.local`. Use `bunx convex env set FIREBASE_PROJECT_ID <id>`.
- `**Sign-in rejected — Only @student.usm.my accounts can use this site*`* — expected: any other email is signed out automatically.
- **Microsoft popup says `AADSTS50194`** — Azure app was registered as single-tenant but `NEXT_PUBLIC_MICROSOFT_TENANT=common`. Fix: open the Azure app → **Authentication** → set **Supported account types** to one of the multi-tenant options (see step 2.3 above) and save.
- **Microsoft popup says `AADSTS50020`** — your account isn't in the tenant the app targets. Either change the Azure app to multi-tenant, or set `NEXT_PUBLIC_MICROSOFT_TENANT` to the tenant id where your account lives.
- **Microsoft popup says `AADSTS50011`** — redirect URI mismatch. The Azure app's redirect URI must be exactly `https://<firebase-project-id>.firebaseapp.com/__/auth/handler`.
- **Firebase says `auth/operation-not-allowed`** — Microsoft sign-in isn't enabled in Firebase console → Authentication → Sign-in method.
- **Convex says `Provider not found` or `aud mismatch`** — check `FIREBASE_PROJECT_ID` matches exactly the project that issued the Firebase ID token. Decode the token at [https://jwt.io](https://jwt.io) and verify `iss` and `aud`.
- **Type errors about `convex/_generated/api`** — run `bunx convex dev` once, the codegen creates these files.

