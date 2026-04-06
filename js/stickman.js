// ═══════════════════════════════════════════════════════════════
// STICKMAN RENDERER — full 33-landmark believable human figure
// ═══════════════════════════════════════════════════════════════

const ROSE_GOLD = '#c9956c';

// MediaPipe Pose landmark indices
const LM = {
  NOSE:0,LEFT_EYE_INNER:1,LEFT_EYE:2,LEFT_EYE_OUTER:3,
  RIGHT_EYE_INNER:4,RIGHT_EYE:5,RIGHT_EYE_OUTER:6,
  LEFT_EAR:7,RIGHT_EAR:8,
  MOUTH_LEFT:9,MOUTH_RIGHT:10,
  LEFT_SHOULDER:11,RIGHT_SHOULDER:12,
  LEFT_ELBOW:13,RIGHT_ELBOW:14,
  LEFT_WRIST:15,RIGHT_WRIST:16,
  LEFT_PINKY:17,RIGHT_PINKY:18,
  LEFT_INDEX:19,RIGHT_INDEX:20,
  LEFT_THUMB:21,RIGHT_THUMB:22,
  LEFT_HIP:23,RIGHT_HIP:24,
  LEFT_KNEE:25,RIGHT_KNEE:26,
  LEFT_ANKLE:27,RIGHT_ANKLE:28,
  LEFT_HEEL:29,RIGHT_HEEL:30,
  LEFT_FOOT_INDEX:31,RIGHT_FOOT_INDEX:32
};

// Skeleton connections — pairs of landmark indices
const BONES = [
  // Face
  [LM.LEFT_EAR, LM.LEFT_EYE], [LM.LEFT_EYE, LM.NOSE],
  [LM.RIGHT_EAR, LM.RIGHT_EYE], [LM.RIGHT_EYE, LM.NOSE],
  [LM.MOUTH_LEFT, LM.MOUTH_RIGHT],
  // Torso
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  // Left arm
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.LEFT_WRIST, LM.LEFT_PINKY],
  [LM.LEFT_WRIST, LM.LEFT_INDEX],
  [LM.LEFT_WRIST, LM.LEFT_THUMB],
  [LM.LEFT_PINKY, LM.LEFT_INDEX],
  // Right arm
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.RIGHT_WRIST, LM.RIGHT_PINKY],
  [LM.RIGHT_WRIST, LM.RIGHT_INDEX],
  [LM.RIGHT_WRIST, LM.RIGHT_THUMB],
  [LM.RIGHT_PINKY, LM.RIGHT_INDEX],
  // Left leg
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.LEFT_ANKLE, LM.LEFT_HEEL],
  [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],
  [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
  // Right leg
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
  [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],
  [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
];

// Body segment widths for thickness drawing (tubular)
const SEGMENT_WIDTHS = {
  [`${LM.LEFT_SHOULDER}-${LM.RIGHT_SHOULDER}`]: 14,
  [`${LM.LEFT_SHOULDER}-${LM.LEFT_HIP}`]: 10,
  [`${LM.RIGHT_SHOULDER}-${LM.RIGHT_HIP}`]: 10,
  [`${LM.LEFT_HIP}-${LM.RIGHT_HIP}`]: 12,
  [`${LM.LEFT_SHOULDER}-${LM.LEFT_ELBOW}`]: 8,
  [`${LM.LEFT_ELBOW}-${LM.LEFT_WRIST}`]: 6,
  [`${LM.RIGHT_SHOULDER}-${LM.RIGHT_ELBOW}`]: 8,
  [`${LM.RIGHT_ELBOW}-${LM.RIGHT_WRIST}`]: 6,
  [`${LM.LEFT_HIP}-${LM.LEFT_KNEE}`]: 9,
  [`${LM.LEFT_KNEE}-${LM.LEFT_ANKLE}`]: 7,
  [`${LM.RIGHT_HIP}-${LM.RIGHT_KNEE}`]: 9,
  [`${LM.RIGHT_KNEE}-${LM.RIGHT_ANKLE}`]: 7,
};

function getSegmentWidth(a, b, canvasW) {
  const key1 = `${a}-${b}`, key2 = `${b}-${a}`;
  const base = SEGMENT_WIDTHS[key1] || SEGMENT_WIDTHS[key2] || 3;
  return Math.max(2, base * (canvasW / 400));
}

// ── Demo renderer (rose-gold animated stickman) ───────────────
class DemoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.raf = null;
    this.t = 0;
  }

  start(targets) {
    this.stop();
    this.targets = targets;
    const draw = () => {
      this.t += 0.022;
      this._draw();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  stop() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  }

  _buildLm(t) {
    const lms = Array.from({length: 33}, () => ({x: 0.5, y: 0.5, visibility: 0}));
    if (!this.targets) return lms;
    for (const [k, pos] of Object.entries(this.targets)) {
      const i = parseInt(k);
      const breathY = Math.sin(t) * 0.008;
      const swayX = Math.cos(t * 0.6) * 0.004;
      const armY = (i === LM.LEFT_WRIST || i === LM.RIGHT_WRIST ||
                    i === LM.LEFT_ELBOW || i === LM.RIGHT_ELBOW)
                   ? Math.sin(t + 0.5) * 0.012 : 0;
      lms[i] = { x: pos.x + swayX, y: pos.y + breathY + armY, visibility: 1 };
    }
    return lms;
  }

  _draw() {
    const c = this.canvas, ctx = this.ctx;
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);

    // Glow
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w * 0.55);
    grad.addColorStop(0, 'rgba(201,149,108,0.07)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const lms = this._buildLm(this.t);
    drawHuman(ctx, lms, w, h, () => ROSE_GOLD, 'demo');
  }
}

// ── Overlay renderer (accuracy-colored stickman) ─────────────
// Draws onto the existing canvas (transparent background)
function drawOverlayHuman(ctx, rawLms, w, h, accuracies) {
  if (!rawLms || rawLms.length < 17) return;
  // Mirror x to match the mirrored video
  const lms = rawLms.map(l => ({ x: 1 - l.x, y: l.y, visibility: l.visibility || 1 }));
  const colorFn = (idx) => {
    const acc = accuracies && accuracies[idx] !== undefined ? accuracies[idx] : 0.5;
    return accuracyColor(acc);
  };
  drawHuman(ctx, lms, w, h, colorFn, 'overlay');
}

// ── Target ghost skeleton (dashed, semi-transparent) ─────────
function drawTargetSkeleton(ctx, targets, w, h) {
  if (!targets) return;
  const pt = (pos) => ({ x: (1 - pos.x) * w, y: pos.y * h });
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(201,149,108,0.28)';
  ctx.lineWidth = 2;
  for (const [a, b] of BONES) {
    const pa = targets[a], pb = targets[b];
    if (!pa || !pb) continue;
    const A = pt(pa), B = pt(pb);
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  }
  for (const [k, pos] of Object.entries(targets)) {
    const p = pt(pos);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201,149,108,0.25)';
    ctx.fill();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Core human drawing function ───────────────────────────────
function drawHuman(ctx, lms, w, h, colorFn, mode) {
  const pt = (idx) => lms[idx] ? { x: lms[idx].x * w, y: lms[idx].y * h } : null;
  const vis = (idx) => lms[idx] && (lms[idx].visibility || 1) > 0.3;

  const isDemo = mode === 'demo';
  const baseAlpha = isDemo ? 1 : 0.88;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = baseAlpha;

  // 1. Draw thick body segments (torso/limbs)
  const thickBones = [
    [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
    [LM.LEFT_SHOULDER, LM.LEFT_HIP],
    [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
    [LM.LEFT_HIP, LM.RIGHT_HIP],
    [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
    [LM.LEFT_ELBOW, LM.LEFT_WRIST],
    [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
    [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
    [LM.LEFT_HIP, LM.LEFT_KNEE],
    [LM.LEFT_KNEE, LM.LEFT_ANKLE],
    [LM.RIGHT_HIP, LM.RIGHT_KNEE],
    [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
    [LM.LEFT_ANKLE, LM.LEFT_HEEL],
    [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],
    [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
    [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
    [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],
    [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
  ];

  for (const [a, b] of thickBones) {
    if (!vis(a) || !vis(b)) continue;
    const A = pt(a), B = pt(b);
    if (!A || !B) continue;
    const lw = getSegmentWidth(a, b, w);
    const col = colorFn((a + b) / 2 | 0);
    // Outer shadow/glow
    if (isDemo) {
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = lw + 4;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  // 2. Hand fingers (thin)
  const handBones = [
    [LM.LEFT_WRIST, LM.LEFT_PINKY],
    [LM.LEFT_WRIST, LM.LEFT_INDEX],
    [LM.LEFT_WRIST, LM.LEFT_THUMB],
    [LM.LEFT_PINKY, LM.LEFT_INDEX],
    [LM.RIGHT_WRIST, LM.RIGHT_PINKY],
    [LM.RIGHT_WRIST, LM.RIGHT_INDEX],
    [LM.RIGHT_WRIST, LM.RIGHT_THUMB],
    [LM.RIGHT_PINKY, LM.RIGHT_INDEX],
  ];
  for (const [a, b] of handBones) {
    if (!vis(a) || !vis(b)) continue;
    const A = pt(a), B = pt(b);
    if (!A || !B) continue;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
    ctx.strokeStyle = colorFn(a);
    ctx.lineWidth = Math.max(1.5, 2 * (w / 400));
    ctx.stroke();
  }

  // 3. Face connections
  const faceBones = [
    [LM.LEFT_EAR, LM.LEFT_EYE], [LM.LEFT_EYE, LM.NOSE],
    [LM.RIGHT_EAR, LM.RIGHT_EYE], [LM.RIGHT_EYE, LM.NOSE],
  ];
  for (const [a, b] of faceBones) {
    const A = pt(a), B = pt(b);
    if (!A || !B) continue;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
    ctx.strokeStyle = colorFn(a);
    ctx.lineWidth = Math.max(1.5, 2 * (w / 400));
    ctx.stroke();
  }

  // 4. Joints (circles)
  const joints = [
    LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
    LM.LEFT_ELBOW, LM.RIGHT_ELBOW,
    LM.LEFT_WRIST, LM.RIGHT_WRIST,
    LM.LEFT_HIP, LM.RIGHT_HIP,
    LM.LEFT_KNEE, LM.RIGHT_KNEE,
    LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
  ];
  const jRadius = Math.max(3, 5 * (w / 400));
  for (const idx of joints) {
    if (!vis(idx)) continue;
    const p = pt(idx);
    if (!p) continue;
    if (isDemo) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, jRadius + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, jRadius, 0, Math.PI * 2);
    ctx.fillStyle = colorFn(idx);
    ctx.fill();
    if (isDemo) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // 5. Head (circle around nose/eyes centre)
  if (vis(LM.NOSE)) {
    const nose = pt(LM.NOSE);
    const headR = Math.max(14, 22 * (w / 400));
    const headCol = colorFn(LM.NOSE);
    if (isDemo) {
      ctx.beginPath();
      ctx.arc(nose.x, nose.y, headR + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(nose.x, nose.y, headR, 0, Math.PI * 2);
    ctx.strokeStyle = headCol;
    ctx.lineWidth = Math.max(2.5, 4 * (w / 400));
    ctx.stroke();
    // Eyes
    const eyeR = Math.max(2.5, 4 * (w / 400));
    if (vis(LM.LEFT_EYE)) {
      const ep = pt(LM.LEFT_EYE);
      ctx.beginPath(); ctx.arc(ep.x, ep.y, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = headCol; ctx.fill();
    }
    if (vis(LM.RIGHT_EYE)) {
      const ep = pt(LM.RIGHT_EYE);
      ctx.beginPath(); ctx.arc(ep.x, ep.y, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = headCol; ctx.fill();
    }
  }

  ctx.restore();
}

// Accuracy → color (red→orange→yellow→green)
function accuracyColor(acc) {
  acc = Math.max(0, Math.min(1, acc));
  let r, g, b;
  if (acc < 0.35) {
    const t = acc / 0.35;
    r = 210; g = Math.round(60 + t * 70); b = 50;
  } else if (acc < 0.65) {
    const t = (acc - 0.35) / 0.3;
    r = Math.round(210 - t * 10); g = Math.round(130 + t * 90); b = Math.round(50 + t * 20);
  } else {
    const t = (acc - 0.65) / 0.35;
    r = Math.round(200 - t * 160); g = Math.round(220 + t * 15); b = Math.round(70 + t * 50);
  }
  return `rgb(${r},${g},${b})`;
}
