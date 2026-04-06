// ═══════════════════════════════════════════════════════════════
// RAKSHA — MAIN APP
// ═══════════════════════════════════════════════════════════════

// ── State ────────────────────────────────────────────────────
const App = {
    user: null,
    progress: {}, // { poseId: { best_accuracy, completed, completed_accuracy } }
    mode: null, // 'defense' | 'attack'
    poseIndex: 0,
    trainer: null,
    trainerReady: false,
    // Training state
    accuracy: 0,
    holdStart: null,
    poseCompleted: false,
    feedbackLog: [], // { timestamp, msg } for summary
    // Demo renderers
    demoRenderers: {},
    // PWA
    pwaPrompt: null,
    // Feedback throttle
    lastFeedbackTime: 0,
    lastFeedbackMsg: '',
};

// ── DOM helpers ───────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(id) {
    $$('.screen').forEach((s) => s.classList.add('hidden'));
    const el = document.getElementById(id + '-screen');
    if (el) {
        el.classList.remove('hidden');
        el.scrollTop = 0;
    }
}

function showToast(msg, type = '') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => el.classList.remove('show'), 3400);
}

// ── PWA ───────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    App.pwaPrompt = e;
    setTimeout(() => {
        if (!window.matchMedia('(display-mode: standalone)').matches) $('#pwa-banner')?.classList.add('show');
    }, 9000);
});
window.installPWA = async () => {
    if (!App.pwaPrompt) return;
    App.pwaPrompt.prompt();
    const { outcome } = await App.pwaPrompt.userChoice;
    if (outcome === 'accepted') {
        $('#pwa-banner')?.classList.remove('show');
        App.pwaPrompt = null;
    }
};
window.dismissPWA = () => $('#pwa-banner')?.classList.remove('show');

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Handle email verification redirect
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
        await handleEmailRedirect();
        return;
    }

    await runSplash();

    // Try restoring session
    const session = await getSession();
    if (session?.user) {
        App.user = session.user;
        await loadUserProgress();
        afterAuth();
        return;
    }

    // Try stored credentials
    const stored = getStoredAuth();
    if (stored) {
        try {
            const data = await signIn(stored.email, stored.password);
            App.user = data.user;
            await loadUserProgress();
            afterAuth();
            return;
        } catch {
            clearStoredAuth();
        }
    }

    // Show onboarding or auth
    if (!localStorage.getItem('raksha_onboarded')) {
        showOnboarding();
    } else {
        showAuthScreen('signup');
    }
});

function afterAuth() {
    if (!localStorage.getItem('raksha_calibrated')) {
        showScreen('calibration');
    } else {
        showDashboard();
    }
}

// ── SPLASH ────────────────────────────────────────────────────
function runSplash() {
    return new Promise((res) => {
        showScreen('splash');
        setTimeout(() => {
            const el = $('#splash-screen');
            el.style.transition = 'opacity .6s ease';
            el.style.opacity = '0';
            setTimeout(() => {
                el.classList.add('hidden');
                el.style.opacity = '';
                res();
            }, 650);
        }, 2000);
    });
}

// ── EMAIL REDIRECT ────────────────────────────────────────────
async function handleEmailRedirect() {
    showScreen('loading');
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) throw error || new Error('No session');
        App.user = data.session.user;
        window.location.hash = '';
        await loadUserProgress();
        showToast('Email verified! Welcome to Raksha.', 'success');
        afterAuth();
    } catch {
        showToast('Verification failed — please sign in.', 'error');
        showAuthScreen('login');
    }
}

// ── STORED AUTH ───────────────────────────────────────────────
function storeAuth(email, pw) {
    const k = 'raksha_xor';
    const obf = (s) =>
        btoa(
            s
                .split('')
                .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ k.charCodeAt(i % k.length)))
                .join(''),
        );
    localStorage.setItem('raksha_auth', JSON.stringify({ e: obf(email), p: obf(pw) }));
}
function getStoredAuth() {
    try {
        const raw = localStorage.getItem('raksha_auth');
        if (!raw) return null;
        const { e, p } = JSON.parse(raw);
        const k = 'raksha_xor';
        const dob = (s) =>
            atob(s)
                .split('')
                .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ k.charCodeAt(i % k.length)))
                .join('');
        return { email: dob(e), password: dob(p) };
    } catch {
        return null;
    }
}
function clearStoredAuth() {
    localStorage.removeItem('raksha_auth');
}

// ── ONBOARDING ────────────────────────────────────────────────
let obSlide = 0;

function showOnboarding() {
    showScreen('onboarding');
    obSlide = 0;
    updateObSlide();
    // Mini stickmen
    const poses = [DEFENSE_POSES[0], ATTACK_POSES[0], DEFENSE_POSES[2]];
    ['ob-canvas-0', 'ob-canvas-1', 'ob-canvas-2'].forEach((id, i) => {
        const c = document.getElementById(id);
        if (!c) return;
        c.width = 150;
        c.height = 150;
        const r = new DemoRenderer(c);
        r.start(poses[i]?.targets);
        App.demoRenderers['ob' + i] = r;
    });
}

function updateObSlide() {
    $$('.ob-slide').forEach((s, i) => {
        s.classList.remove('active', 'exit');
        if (i === obSlide) s.classList.add('active');
        else if (i < obSlide) s.classList.add('exit');
    });
    $$('.dot').forEach((d, i) => d.classList.toggle('active', i === obSlide));
    const total = $$('.ob-slide').length;
    const btn = $('#ob-next-btn');
    if (btn) btn.textContent = obSlide === total - 1 ? 'Get Started' : 'Next';
}

window.obNext = () => {
    const total = $$('.ob-slide').length;
    if (obSlide < total - 1) {
        obSlide++;
        updateObSlide();
    } else {
        localStorage.setItem('raksha_onboarded', '1');
        stopObRenderers();
        showAuthScreen('signup');
    }
};
window.obSkip = () => {
    localStorage.setItem('raksha_onboarded', '1');
    stopObRenderers();
    showAuthScreen('signup');
};

function stopObRenderers() {
    Object.values(App.demoRenderers).forEach((r) => r.stop?.());
    App.demoRenderers = {};
}

// ── AUTH ──────────────────────────────────────────────────────
let authMode = 'signup';

function showAuthScreen(mode) {
    authMode = mode || 'signup';
    showScreen('auth');
    renderAuthForm();
}

function renderAuthForm() {
    const card = $('#auth-card');
    const title = $('#auth-title');
    if (!card) return;
    if (title) title.textContent = authMode === 'signup' ? 'Join Raksha' : 'Welcome Back';

    if (authMode === 'signup') {
        card.innerHTML = `
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="form-input" id="f-name" type="text" placeholder="Your name" autocomplete="name">
        <div class="form-err" id="e-name"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="f-email" type="email" placeholder="you@email.com" autocomplete="email">
        <div class="form-err" id="e-email"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" id="f-pw" type="password" placeholder="At least 6 characters" autocomplete="new-password">
        <div class="form-err" id="e-pw"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Confirm Password</label>
        <input class="form-input" id="f-pw2" type="password" placeholder="Repeat password" autocomplete="new-password">
        <div class="form-err" id="e-pw2"></div>
      </div>
      <button class="btn btn-primary btn-w" onclick="doSignUp()">Create Account</button>
      <div class="auth-switch">Already have an account? <a href="#" onclick="showAuthScreen('login');return false">Sign In</a></div>`;
    } else {
        card.innerHTML = `
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="f-email" type="email" placeholder="you@email.com" autocomplete="email">
        <div class="form-err" id="e-email"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" id="f-pw" type="password" placeholder="Your password" autocomplete="current-password">
        <div class="form-err" id="e-pw"></div>
      </div>
      <button class="btn btn-primary btn-w" style="margin-bottom:10px" onclick="doSignIn()">Sign In</button>
      <div class="auth-switch">New here? <a href="#" onclick="showAuthScreen('signup');return false">Create Account</a></div>`;
    }
}

function fieldErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('show', !!msg);
}

window.doSignUp = async () => {
    const name = document.getElementById('f-name')?.value.trim();
    const email = document.getElementById('f-email')?.value.trim();
    const pw = document.getElementById('f-pw')?.value;
    const pw2 = document.getElementById('f-pw2')?.value;
    let ok = true;
    if (!name) {
        fieldErr('e-name', 'Name is required');
        ok = false;
    } else fieldErr('e-name', '');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        fieldErr('e-email', 'Valid email required');
        ok = false;
    } else fieldErr('e-email', '');
    if (!pw || pw.length < 6) {
        fieldErr('e-pw', 'Minimum 6 characters');
        ok = false;
    } else fieldErr('e-pw', '');
    if (pw !== pw2) {
        fieldErr('e-pw2', 'Passwords do not match');
        ok = false;
    } else fieldErr('e-pw2', '');
    if (!ok) return;

    const btn = card_btn();
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Creating…';
    }
    try {
        storeAuth(email, pw);
        await signUp(name, email, pw);
        showScreen('verify');
    } catch (err) {
        fieldErr('e-email', err.message || 'Sign up failed');
        clearStoredAuth();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    }
};

window.doSignIn = async () => {
    const email = document.getElementById('f-email')?.value.trim();
    const pw = document.getElementById('f-pw')?.value;
    let ok = true;
    if (!email) {
        fieldErr('e-email', 'Email required');
        ok = false;
    } else fieldErr('e-email', '');
    if (!pw) {
        fieldErr('e-pw', 'Password required');
        ok = false;
    } else fieldErr('e-pw', '');
    if (!ok) return;

    const btn = card_btn();
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Signing in…';
    }
    try {
        const data = await signIn(email, pw);
        App.user = data.user;
        storeAuth(email, pw);
        await loadUserProgress();
        afterAuth();
    } catch (err) {
        fieldErr('e-pw', err.message || 'Invalid credentials');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    }
};

function card_btn() {
    return $('#auth-card .btn-primary');
}

// ── CALIBRATION ───────────────────────────────────────────────
window.finishCalibration = () => {
    localStorage.setItem('raksha_calibrated', '1');
    showDashboard();
};

// ── PROGRESS ──────────────────────────────────────────────────
async function loadUserProgress() {
    if (!App.user) return;
    const rows = await loadProgress(App.user.id);
    App.progress = {};
    rows.forEach((r) => (App.progress[r.pose_id] = r));
}

// ── DASHBOARD ─────────────────────────────────────────────────
function showDashboard() {
    stopTrainer();
    showScreen('dashboard');
    renderDashboard();
}

function renderDashboard() {
    const u = App.user;
    if (!u) return;
    const name = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Warrior';
    const first = name.split(' ')[0];
    setText('dash-name', first);
    setText('dash-av', first[0].toUpperCase());

    const all = [...DEFENSE_POSES, ...ATTACK_POSES];
    const done = all.filter((p) => App.progress[p.id]?.completed).length;
    setText('stat-done', done);
    setText('stat-total', all.length);

    const defDone = DEFENSE_POSES.filter((p) => App.progress[p.id]?.completed).length;
    const atkDone = ATTACK_POSES.filter((p) => App.progress[p.id]?.completed).length;
    setBar('def-bar', defDone, DEFENSE_POSES.length);
    setBar('atk-bar', atkDone, ATTACK_POSES.length);
    setText('def-label', `${defDone}/${DEFENSE_POSES.length}`);
    setText('atk-label', `${atkDone}/${ATTACK_POSES.length}`);

    // Mode card demo stickmen
    const cards = [
        { id: 'def-card-canvas', poses: DEFENSE_POSES, key: 'def-demo' },
        { id: 'atk-card-canvas', poses: ATTACK_POSES, key: 'atk-demo' },
    ];
    cards.forEach(({ id, poses, key }) => {
        const c = document.getElementById(id);
        if (!c) return;
        c.width = c.offsetWidth || 200;
        c.height = c.offsetHeight || 250;
        App.demoRenderers[key]?.stop();
        const r = new DemoRenderer(c);
        r.start(poses[0]?.targets);
        App.demoRenderers[key] = r;
    });
}

function setText(id, val) {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
}
function setBar(id, done, total) {
    const e = document.getElementById(id);
    if (e) e.style.width = (total > 0 ? Math.round((done / total) * 100) : 0) + '%';
}

window.startMode = (mode) => {
    stopDashRenderers();
    App.mode = mode;
    App.poseIndex = 0;
    showPoseTutorial();
};

function stopDashRenderers() {
    ['def-demo', 'atk-demo'].forEach((k) => {
        App.demoRenderers[k]?.stop();
        delete App.demoRenderers[k];
    });
}

// ── POSE TUTORIAL (full-screen animated demo) ─────────────────
function showPoseTutorial() {
    const poses = currentPoses();
    const pose = poses[App.poseIndex];
    if (!pose) return;
    showScreen('pose-tutorial');

    setText('tut-badge', App.mode === 'defense' ? 'Defense' : 'Attack');
    setText('tut-name', pose.name);
    setText('tut-desc', pose.description);
    setText('tut-footer-desc', pose.description);

    // Full-screen animated stickman
    const c = $('#tut-canvas');
    if (c) {
        c.width = c.offsetWidth || 400;
        c.height = c.offsetHeight || 600;
        App.demoRenderers['tut']?.stop();
        const r = new DemoRenderer(c);
        r.start(pose.targets);
        App.demoRenderers['tut'] = r;
    }
}

window.goToTraining = async () => {
    App.demoRenderers['tut']?.stop();
    delete App.demoRenderers['tut'];
    await startTrainingScreen();
};

// ── TRAINING SCREEN ───────────────────────────────────────────
async function startTrainingScreen() {
    const poses = currentPoses();
    const pose = poses[App.poseIndex];
    if (!pose) return;

    showScreen('training');
    setText('train-mode', App.mode === 'defense' ? 'Defense' : 'Attack');
    setText('train-name', pose.name);

    resetTrainingState();
    renderPoseList();

    // Init trainer once
    if (!App.trainerReady) {
        const video = $('#cam-video');
        const overlay = $('#cam-overlay');
        App.trainer = new PoseTrainer({
            videoEl: video,
            overlayCanvasEl: overlay,
            onFrame: handleFrame,
        });
        const ok = await App.trainer.init();
        App.trainerReady = ok;
        if (!ok) {
            showToast('Pose detection unavailable', 'error');
            return;
        }
    }

    App.trainer.setPose(pose);

    if (!App.trainer.stream) {
        const ok = await App.trainer.startCamera();
        if (!ok) {
            showToast('Camera access denied — please allow camera access', 'error');
            return;
        }
    }
}

function resetTrainingState() {
    App.accuracy = 0;
    App.holdStart = null;
    App.poseCompleted = false;
    App.feedbackLog = [];
    App.lastFeedbackTime = 0;
    App.lastFeedbackMsg = '';
    $('#hold-bar')?.classList.remove('show');
    $('#summary-overlay')?.classList.remove('show');
    updateAccRing(0);
    setText('feedback-text', 'Step into frame and face the camera');

    // Immediately draw the static overlay for the current pose
    // so it's visible before MediaPipe fires its first result
    const overlay = $('#cam-overlay');
    const pose = currentPoses()[App.poseIndex];
    if (overlay && pose) {
        const cw = overlay.offsetWidth || 640;
        const ch = overlay.offsetHeight || 480;
        overlay.width = cw;
        overlay.height = ch;
        const ctx = overlay.getContext('2d');
        drawOverlayHuman(ctx, pose.targets, cw, ch, {});
    }
}

function stopTrainer() {
    App.trainer?.stopCamera();
    App.trainerReady = false;
    App.trainer = null;
}

function currentPoses() {
    return App.mode === 'defense' ? DEFENSE_POSES : ATTACK_POSES;
}

// ── FRAME HANDLER ─────────────────────────────────────────────
function handleFrame({ accuracy, feedbackMessages, accuracies }) {
    if (App.poseCompleted) return;
    App.accuracy = accuracy;
    updateAccRing(accuracy);

    // Hold logic
    const now = Date.now();
    if (accuracy >= ACCURACY_THRESHOLD) {
        if (!App.holdStart) App.holdStart = now;
        const elapsed = now - App.holdStart;
        const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
        const secsLeft = Math.max(0, (HOLD_DURATION_MS - elapsed) / 1000).toFixed(1);
        showHoldBar(pct, secsLeft);
        if (elapsed >= HOLD_DURATION_MS) {
            onPoseCompleted(accuracy);
            return;
        }
    } else {
        App.holdStart = null;
        hideHoldBar();
    }

    // Feedback
    if (feedbackMessages.length > 0) {
        const msg = feedbackMessages[0].msg || feedbackMessages[0];
        const timeSinceLast = now - App.lastFeedbackTime;
        if (msg !== App.lastFeedbackMsg || timeSinceLast > 5000) {
            if (timeSinceLast > 2000) {
                tts.speak(msg);
                setText('feedback-text', msg);
                App.lastFeedbackMsg = msg;
                App.lastFeedbackTime = now;
                // Log for summary
                App.feedbackLog.push({ timestamp: now, msg });
            }
        }
    } else if (accuracy >= ACCURACY_THRESHOLD) {
        const holdMsg = 'Great! Keep holding…';
        setText('feedback-text', holdMsg);
        if (now - App.lastFeedbackTime > 4000) {
            tts.speak(holdMsg);
            App.lastFeedbackTime = now;
        }
    } else if (accuracy < 25) {
        setText('feedback-text', 'Step back — make sure your full body is in frame');
    } else if (accuracy < 50) {
        setText('feedback-text', 'Adjust your position to match the pose');
    } else {
        setText('feedback-text', 'Looking good — fine-tune your form');
    }

    // Save best progress
    const pose = currentPoses()[App.poseIndex];
    if (pose) {
        const prev = App.progress[pose.id];
        if (!prev?.completed && accuracy > (prev?.best_accuracy || 0)) {
            App.progress[pose.id] = { ...(prev || {}), best_accuracy: accuracy };
            clearTimeout(App._saveDebounce);
            App._saveDebounce = setTimeout(() => saveProgress(App.user?.id, pose.id, accuracy, false, null), 2500);
        }
    }
}

// ── ACCURACY RING ─────────────────────────────────────────────
function updateAccRing(pct) {
    const fill = $('#acc-ring-fill');
    const text = $('#acc-ring-val');
    if (!fill || !text) return;
    const r = 26;
    const circ = 2 * Math.PI * r;
    fill.setAttribute('stroke-dasharray', circ);
    fill.setAttribute('stroke-dashoffset', circ * (1 - pct / 100));
    const col = pct >= ACCURACY_THRESHOLD ? '#5aaa72' : pct >= 50 ? '#d4924a' : '#c05050';
    fill.setAttribute('stroke', col);
    text.textContent = Math.round(pct) + '%';
}

// ── HOLD INDICATOR ────────────────────────────────────────────
function showHoldBar(pct, secsLeft) {
    const el = $('#hold-bar');
    if (!el) return;
    el.classList.add('show');
    el.querySelector('.hold-bar-fill').style.width = pct + '%';
    el.querySelector('.hold-bar-secs').textContent = secsLeft + 's remaining';
    el.querySelector('.hold-bar-label').textContent = '🔒 Hold it!';
}
function hideHoldBar() {
    $('#hold-bar')?.classList.remove('show');
}

// ── POSE COMPLETED ────────────────────────────────────────────
function onPoseCompleted(accuracy) {
    App.poseCompleted = true;
    hideHoldBar();
    tts.stop();
    tts.speak('Excellent! Pose complete!');

    const pose = currentPoses()[App.poseIndex];
    if (pose) {
        const prev = App.progress[pose.id] || {};
        const newBest = Math.max(accuracy, prev.best_accuracy || 0);
        App.progress[pose.id] = { best_accuracy: newBest, completed: true, completed_accuracy: accuracy };
        saveProgress(App.user?.id, pose.id, newBest, true, accuracy);
        renderPoseList();
    }

    showSummary(accuracy);
}

function showSummary(accuracy) {
    const overlay = $('#summary-overlay');
    if (!overlay) return;

    // Build feedback log table
    const logRows =
        App.feedbackLog.length > 0
            ? App.feedbackLog
                  .map((entry, i) => {
                      const elapsed = ((entry.timestamp - App.feedbackLog[0].timestamp) / 1000).toFixed(1);
                      return `<tr>
          <td>${i + 1}</td>
          <td>${elapsed}s</td>
          <td>${entry.msg}</td>
          <td class="ok">✓ Corrected</td>
        </tr>`;
                  })
                  .join('')
            : `<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,.5);font-style:italic">No corrections needed — perfect form!</td></tr>`;

    overlay.querySelector('.sum-acc').textContent = `Held with ${Math.round(accuracy)}% accuracy`;
    overlay.querySelector('#sum-log-body').innerHTML = logRows;
    overlay.classList.add('show');
}

// ── POSE LIST ─────────────────────────────────────────────────
function renderPoseList() {
    const list = $('#pose-list');
    if (!list) return;
    const poses = currentPoses();
    list.innerHTML = poses
        .map((p, i) => {
            const prog = App.progress[p.id];
            const acc = prog?.completed
                ? Math.round(prog.completed_accuracy || 0)
                : prog?.best_accuracy
                  ? Math.round(prog.best_accuracy)
                  : null;
            const isActive = i === App.poseIndex;
            const isDone = !!prog?.completed;
            return `<div class="pose-chip ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}"
      onclick="selectPose(${i})">
      <div class="pose-chip-name">${p.name}</div>
      <div class="pose-chip-acc">${isDone ? '✓ ' : ''}${acc !== null ? acc + '%' : '—'}</div>
    </div>`;
        })
        .join('');
}

window.selectPose = (idx) => {
    if (idx === App.poseIndex && !App.poseCompleted) return;
    App.poseIndex = idx;
    const pose = currentPoses()[idx];
    if (!pose) return;
    setText('train-name', pose.name);
    App.trainer?.setPose(pose);
    resetTrainingState();
    renderPoseList();
};

// ── SUMMARY ACTIONS ───────────────────────────────────────────
window.nextPoseFromSummary = () => {
    const poses = currentPoses();
    $('#summary-overlay')?.classList.remove('show');
    if (App.poseIndex < poses.length - 1) {
        App.poseIndex++;
        const pose = poses[App.poseIndex];
        setText('train-name', pose.name);
        App.trainer?.setPose(pose);
        resetTrainingState();
        renderPoseList();
        // Show tutorial for next pose
        App.trainer?.stopCamera();
        App.trainerReady = false;
        App.trainer = null;
        showPoseTutorial();
    } else {
        tts.speak('You have completed all poses! Amazing work!');
        setTimeout(() => showDashboard(), 1500);
    }
};

window.retryPose = () => {
    $('#summary-overlay')?.classList.remove('show');
    const pose = currentPoses()[App.poseIndex];
    App.trainer?.setPose(pose);
    resetTrainingState();
};

window.backToDash = () => {
    stopTrainer();
    showDashboard();
};

window.goBackFromTutorial = () => {
    App.demoRenderers['tut']?.stop();
    delete App.demoRenderers['tut'];
    showDashboard();
};

// ── PROFILE ───────────────────────────────────────────────────
window.showProfile = () => {
    showScreen('profile');
    renderProfile();
};

function renderProfile() {
    const u = App.user;
    if (!u) return;
    const name = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Warrior';
    setText('prof-name', name);
    setText('prof-email', u.email);
    setText('prof-av', name[0].toUpperCase());

    const all = [...DEFENSE_POSES, ...ATTACK_POSES];
    const done = all.filter((p) => App.progress[p.id]?.completed).length;
    const defD = DEFENSE_POSES.filter((p) => App.progress[p.id]?.completed).length;
    const atkD = ATTACK_POSES.filter((p) => App.progress[p.id]?.completed).length;
    const tried = all.filter((p) => App.progress[p.id]);
    const avgAcc = tried.length
        ? Math.round(tried.reduce((s, p) => s + (App.progress[p.id].best_accuracy || 0), 0) / tried.length)
        : 0;

    setText('ps-completed', done);
    setText('ps-avg', avgAcc + '%');
    setText('ps-def', defD);
    setText('ps-atk', atkD);
}

window.doSignOut = async () => {
    if (!confirm('Sign out of Raksha?')) return;
    await signOut();
    clearStoredAuth();
    Object.assign(App, { user: null, progress: {} });
    showAuthScreen('login');
};

// ── NAV helpers ───────────────────────────────────────────────
window.navHome = () => {
    stopDashRenderers();
    showDashboard();
};
window.navTrain = () => {
    if (App.mode) showPoseTutorial();
    else showDashboard();
};
window.navProfile = () => showProfile();
