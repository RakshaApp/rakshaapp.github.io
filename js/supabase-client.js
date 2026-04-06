// ============================================================
// SUPABASE CONFIGURATION
// Replace these with your actual Supabase project details.
// Find them at: https://supabase.com/dashboard → Your Project → Settings → API
// ============================================================
const SUPABASE_URL = 'https://zwfaiukdshzmiiwpyebo.supabase.co'; // ← REPLACE
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZmFpdWtkc2h6bWlpd3B5ZWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzcwMzYsImV4cCI6MjA5MDk1MzAzNn0.yJ2g95xqcNC6S9XUiRB9kvqJ78XR-fwPu4D5FvNFQfc'; // ← REPLACE

// ============================================================
// Supabase Client (CDN version, loaded in index.html)
// ============================================================
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        storageKey: 'raksha_session',
        storage: {
            // Secure-ish localStorage wrapper (not fully secure but reasonable for web PWA)
            getItem: (key) => {
                try {
                    return localStorage.getItem(key);
                } catch {
                    return null;
                }
            },
            setItem: (key, val) => {
                try {
                    localStorage.setItem(key, val);
                } catch {}
            },
            removeItem: (key) => {
                try {
                    localStorage.removeItem(key);
                } catch {}
            },
        },
    },
});

// ============================================================
// Auth helpers
// ============================================================
async function signUp(name, email, password) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name },
            // The email redirect URL: user clicks this link → lands back in your app
            // For GitHub Pages deployment set this to: https://yourusername.github.io/your-repo/
            // For PWA: deep-link back into app. Supabase will add #access_token=... to the URL.
            emailRedirectTo: window.location.origin + window.location.pathname,
        },
    });
    if (error) throw error;
    if (data.user) {
        // Insert profile row (RLS: user can only insert their own row)
        await supabaseClient.from('profiles').upsert({
            id: data.user.id,
            full_name: name,
            email: email,
        });
    }
    return data;
}

async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function signOut() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('raksha_session');
    localStorage.removeItem('raksha_user');
}

async function getSession() {
    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    return session;
}

async function getUser() {
    const {
        data: { user },
    } = await supabaseClient.auth.getUser();
    return user;
}

// ============================================================
// Progress helpers
// ============================================================
async function loadProgress(userId) {
    const { data, error } = await supabaseClient.from('pose_progress').select('*').eq('user_id', userId);
    if (error) return [];
    return data;
}

async function saveProgress(userId, poseId, accuracy, completed, holdAccuracy) {
    // Upsert: one row per user+pose
    const { error } = await supabaseClient.from('pose_progress').upsert(
        {
            user_id: userId,
            pose_id: poseId,
            best_accuracy: accuracy,
            completed: completed,
            completed_accuracy: holdAccuracy || null,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,pose_id' },
    );
    if (error) console.warn('Progress save error:', error);
}
