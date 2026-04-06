# Raksha — Self-Defense Training PWA

A mobile-first Progressive Web App for self-defense training with real-time pose detection.

---

## 🚀 Quick Setup

### 1. Supabase Configuration

**A. Create a Supabase project** at https://supabase.com

**B. Run the schema:**
- Go to your project → SQL Editor → New Query
- Paste the contents of `supabase-schema.sql` and run it

**C. Set your redirect URL:**
- Authentication → URL Configuration
- **Site URL:** `https://yourusername.github.io/your-repo/`
- **Redirect URLs:** Add the same URL

**D. Get your project credentials:**
- Settings → API
- Copy "Project URL" and "anon public" key

### 2. Add Your Supabase Credentials

Open `js/supabase-client.js` and replace:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';   // ← your URL
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';             // ← your anon key
```

### 3. Generate PWA Icons

The app needs 192×192 and 512×512 PNG icons. Generate them from `icons/logo.png`:

```bash
# Using ImageMagick (if installed):
convert icons/logo.png -resize 192x192 icons/icon-192.png
convert icons/logo.png -resize 512x512 icons/icon-512.png
```

Or use an online tool like https://realfavicongenerator.net

### 4. Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Initial Raksha deployment"
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

Then in GitHub repo → Settings → Pages → Source: Deploy from branch `main`, folder `/`.

---

## 📁 File Structure

```
raksha/
├── index.html              # Main app (single page)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── favicon.ico             # App icon
├── css/
│   └── main.css            # All styles (rose-gold luxury theme)
├── js/
│   ├── supabase-client.js  # ← ADD YOUR CREDENTIALS HERE
│   ├── poses.js            # Pose definitions + landmark targets
│   ├── stickman.js         # Canvas stickman renderer
│   ├── tts.js              # Text-to-speech wrapper
│   ├── trainer.js          # MediaPipe pose trainer + accuracy logic
│   └── app.js              # Main app logic + screen management
├── icons/
│   ├── logo.png            # App logo
│   ├── icon-192.png        # PWA icon (generate this)
│   └── icon-512.png        # PWA icon (generate this)
└── supabase-schema.sql     # Database schema + RLS policies
```

---

## 🔐 Credential Storage

Credentials are stored in `localStorage` with XOR obfuscation (not cryptographic encryption). This is standard practice for web PWAs — the session token from Supabase is what's primarily used for auth, with the stored credentials only used to re-authenticate if the session expires.

For additional security, consider:
- Enabling Supabase's "Refresh token rotation"
- Setting shorter JWT expiry in Supabase Auth settings

---

## 🎯 Poses Included

**Defense:** Guard Stance, Palm Block, Wrist Escape, Low Guard  
**Attack:** Straight Jab, Palm Strike, Knee Strike, Elbow Strike

---

## 🛠 Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES2020+)
- **Pose Detection:** MediaPipe Pose (via CDN)
- **Stickman Rendering:** Canvas 2D API
- **Audio Feedback:** Web Speech API (SpeechSynthesis)
- **Database & Auth:** Supabase (free tier)
- **PWA:** Service Worker + Web App Manifest
- **Hosting:** GitHub Pages (free)
