// ═══════════════════════════════════════════════════════════════
// STICKMAN — static overlay + animated demo
// ═══════════════════════════════════════════════════════════════

const ROSE_GOLD = '#c9956c';

const LM = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32,
};

// The bones that matter visually for a recognisable stickman
const BONES = [
    // Torso
    [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
    [LM.LEFT_SHOULDER, LM.LEFT_HIP],
    [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
    [LM.LEFT_HIP, LM.RIGHT_HIP],
    // Arms
    [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
    [LM.LEFT_ELBOW, LM.LEFT_WRIST],
    [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
    [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
    // Legs
    [LM.LEFT_HIP, LM.LEFT_KNEE],
    [LM.LEFT_KNEE, LM.LEFT_ANKLE],
    [LM.RIGHT_HIP, LM.RIGHT_KNEE],
    [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
    // Feet
    [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],
    [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],
];

// Bone thickness scale factors (relative to canvas width / 500)
const BONE_W = {
    [`${LM.LEFT_SHOULDER}-${LM.RIGHT_SHOULDER}`]: 7,
    [`${LM.LEFT_HIP}-${LM.RIGHT_HIP}`]: 6,
    [`${LM.LEFT_SHOULDER}-${LM.LEFT_HIP}`]: 5,
    [`${LM.RIGHT_SHOULDER}-${LM.RIGHT_HIP}`]: 5,
    [`${LM.LEFT_SHOULDER}-${LM.LEFT_ELBOW}`]: 5,
    [`${LM.LEFT_ELBOW}-${LM.LEFT_WRIST}`]: 4,
    [`${LM.RIGHT_SHOULDER}-${LM.RIGHT_ELBOW}`]: 5,
    [`${LM.RIGHT_ELBOW}-${LM.RIGHT_WRIST}`]: 4,
    [`${LM.LEFT_HIP}-${LM.LEFT_KNEE}`]: 6,
    [`${LM.LEFT_KNEE}-${LM.LEFT_ANKLE}`]: 5,
    [`${LM.RIGHT_HIP}-${LM.RIGHT_KNEE}`]: 6,
    [`${LM.RIGHT_KNEE}-${LM.RIGHT_ANKLE}`]: 5,
};

function boneWidth(a, b, cw) {
    const w = BONE_W[`${a}-${b}`] || BONE_W[`${b}-${a}`] || 3;
    return Math.max(2, w * (cw / 500));
}

// ── colour helpers ────────────────────────────────────────────
function accuracyColor(acc) {
    // 0 = red, 0.5 = orange/yellow, 1 = green
    acc = Math.max(0, Math.min(1, acc));
    let r, g, b;
    if (acc < 0.5) {
        const t = acc / 0.5;
        r = 210;
        g = Math.round(60 + t * 130);
        b = 50;
    } else {
        const t = (acc - 0.5) / 0.5;
        r = Math.round(210 - t * 170);
        g = Math.round(190 + t * 45);
        b = Math.round(50 + t * 70);
    }
    return `rgb(${r},${g},${b})`;
}

// ── core draw ─────────────────────────────────────────────────
// lms: array of {x,y} in 0-1 normalised space
// colorFn: (lmIndex) => css color string
// alpha: global canvas alpha (0-1)
function drawSkeleton(ctx, lms, cw, ch, colorFn, alpha = 1) {
    if (!lms || lms.length < 17) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const px = (idx) => (lms[idx] ? { x: lms[idx].x * cw, y: lms[idx].y * ch } : null);

    // 1 — bones
    for (const [a, b] of BONES) {
        const A = px(a),
            B = px(b);
        if (!A || !B) continue;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        // colour is average of the two endpoints
        const ca = colorFn(a),
            cb = colorFn(b);
        ctx.strokeStyle = ca; // simple: use start-joint colour
        ctx.lineWidth = boneWidth(a, b, cw);
        ctx.stroke();
    }

    // 2 — joint dots
    const JOINTS = [
        LM.LEFT_SHOULDER,
        LM.RIGHT_SHOULDER,
        LM.LEFT_ELBOW,
        LM.RIGHT_ELBOW,
        LM.LEFT_WRIST,
        LM.RIGHT_WRIST,
        LM.LEFT_HIP,
        LM.RIGHT_HIP,
        LM.LEFT_KNEE,
        LM.RIGHT_KNEE,
        LM.LEFT_ANKLE,
        LM.RIGHT_ANKLE,
    ];
    const jr = Math.max(3, 5 * (cw / 500));
    for (const idx of JOINTS) {
        const p = px(idx);
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, jr, 0, Math.PI * 2);
        ctx.fillStyle = colorFn(idx);
        ctx.fill();
    }

    // 3 — head circle (around nose position)
    const nose = px(LM.NOSE);
    if (nose) {
        const hr = Math.max(12, 20 * (cw / 500));
        ctx.beginPath();
        ctx.arc(nose.x, nose.y, hr, 0, Math.PI * 2);
        ctx.strokeStyle = colorFn(LM.NOSE);
        ctx.lineWidth = Math.max(2, 4 * (cw / 500));
        ctx.stroke();
    }

    ctx.restore();
}

// ── Demo renderer (rose-gold, subtle hand sway only) ──────────
class DemoRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.raf = null;
        this.t = 0;
        this.targets = null;
    }

    start(targets) {
        this.stop();
        this.targets = targets;
        if (!targets) return;
        const tick = () => {
            this.t += 0.018;
            this._draw();
            this.raf = requestAnimationFrame(tick);
        };
        tick();
    }

    stop() {
        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }
    }

    _buildLm() {
        // Start from exact targets; add ONLY very subtle hand/wrist sway
        const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
        for (const [k, pos] of Object.entries(this.targets)) {
            lms[parseInt(k)] = { x: pos.x, y: pos.y };
        }
        const sway = Math.sin(this.t) * 0.013;
        const handIds = [
            LM.LEFT_WRIST,
            LM.RIGHT_WRIST,
            LM.LEFT_PINKY,
            LM.RIGHT_PINKY,
            LM.LEFT_INDEX,
            LM.RIGHT_INDEX,
            LM.LEFT_THUMB,
            LM.RIGHT_THUMB,
        ];
        for (const id of handIds) {
            if (this.targets[id]) {
                lms[id] = { x: this.targets[id].x, y: this.targets[id].y + sway };
            }
        }
        return lms;
    }

    _draw() {
        const c = this.canvas;
        // Keep canvas resolution in sync with its display size
        if (c.width !== c.offsetWidth || c.height !== c.offsetHeight) {
            c.width = c.offsetWidth || c.width;
            c.height = c.offsetHeight || c.height;
        }
        const { width: cw, height: ch } = c;
        this.ctx.clearRect(0, 0, cw, ch);

        // Subtle background glow
        const g = this.ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw * 0.6);
        g.addColorStop(0, 'rgba(201,149,108,0.08)');
        g.addColorStop(1, 'transparent');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, cw, ch);

        drawSkeleton(this.ctx, this._buildLm(), cw, ch, () => ROSE_GOLD, 1);
    }
}

// ── Static overlay on camera feed ────────────────────────────
// Call this every frame from the trainer result handler.
// targets: the pose's target landmark map  { [lmIdx]: {x,y} }
// accuracies: { [lmIdx]: 0-1 }  (from trainer)
function drawOverlayHuman(ctx, targets, cw, ch, accuracies) {
    if (!targets) return;
    ctx.clearRect(0, 0, cw, ch);

    // Build a mirrored landmark array from targets (mirror x because video is mirrored)
    const lms = Array.from({ length: 33 }, () => null);
    for (const [k, pos] of Object.entries(targets)) {
        const idx = parseInt(k);
        lms[idx] = { x: 1 - pos.x, y: pos.y }; // mirror x to match camera
    }

    const colorFn = (idx) => {
        const acc = accuracies && accuracies[idx] !== undefined ? accuracies[idx] : 0.5;
        return accuracyColor(acc);
    };

    drawSkeleton(ctx, lms, cw, ch, colorFn, 0.82);
}
