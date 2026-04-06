// ═══════════════════════════════════════════════════════════════
// POSE TRAINER — MediaPipe Pose via CDN + accuracy logic
// Uses @mediapipe/pose loaded via <script> tags in index.html
// ═══════════════════════════════════════════════════════════════

class PoseTrainer {
    constructor({ videoEl, overlayCanvasEl, onFrame }) {
        this.video = videoEl;
        this.canvas = overlayCanvasEl;
        this.onFrame = onFrame;
        this.pose = null;
        this.stream = null;
        this.raf = null;
        this.running = false;
        this.currentPose = null;
        this._lastFrameTime = 0;
    }

    async init() {
        if (!window.Pose) {
            console.error('MediaPipe Pose not available');
            return false;
        }
        this.pose = new window.Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
        });
        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.55,
            minTrackingConfidence: 0.55,
        });
        this.pose.onResults((r) => this._onResults(r));

        try {
            await this.pose.initialize();
        } catch (e) {
            console.warn('Pose init warning (often harmless):', e);
        }
        return true;
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            });
            this.video.srcObject = this.stream;
            await new Promise((res, rej) => {
                this.video.onloadedmetadata = res;
                setTimeout(rej, 8000); // timeout
            });
            await this.video.play();
            this.running = true;
            this._loop();
            return true;
        } catch (err) {
            console.error('Camera error:', err);
            return false;
        }
    }

    _loop() {
        if (!this.running) return;
        const now = performance.now();
        // ~20fps to keep things smooth but not overload
        if (now - this._lastFrameTime > 50) {
            this._lastFrameTime = now;
            if (this.video.readyState >= 2 && this.pose) {
                this.pose.send({ image: this.video }).catch(() => {});
            }
        }
        this.raf = requestAnimationFrame(() => this._loop());
    }

    stopCamera() {
        this.running = false;
        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }
        this.video.srcObject = null;
    }

    setPose(poseDef) {
        this.currentPose = poseDef;
    }

    // Converts relative pose targets {rx, ry} into absolute {x, y} normalised coords
    // based on the user's own detected body landmarks.
    _resolveTargets(lms, poseTargets) {
        // Need at least shoulders and hips to compute reference frame
        const ls = lms[LM.LEFT_SHOULDER],
            rs = lms[LM.RIGHT_SHOULDER];
        const lh = lms[LM.LEFT_HIP],
            rh = lms[LM.RIGHT_HIP];
        if (!ls || !rs || !lh || !rh) return null;

        const smx = (ls.x + rs.x) / 2; // shoulder midpoint x
        const smy = (ls.y + rs.y) / 2; // shoulder midpoint y
        const hmx = (lh.x + rh.x) / 2;
        const hmy = (lh.y + rh.y) / 2;

        const halfSW = Math.abs(rs.x - ls.x) / 2; // half shoulder width (x unit)
        const torsoH = Math.abs(hmy - smy); // torso height (y unit)

        if (halfSW < 0.01 || torsoH < 0.01) return null; // person not visible enough

        const resolved = {};
        for (const [idxStr, rel] of Object.entries(poseTargets)) {
            const idx = parseInt(idxStr);
            resolved[idx] = {
                x: smx + rel.rx * halfSW,
                y: smy + rel.ry * torsoH,
            };
        }
        return resolved;
    }

    _onResults(results) {
        if (!this.canvas) return;
        const ctx = this.canvas.getContext('2d');
        const w = this.video.videoWidth || this.canvas.offsetWidth || 640;
        const h = this.video.videoHeight || this.canvas.offsetHeight || 480;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        ctx.clearRect(0, 0, w, h);

        const lms = results.poseLandmarks;
        if (!lms || !this.currentPose) return;

        const targets = this.currentPose.targets;

        // Resolve relative targets to absolute coords using user's body proportions
        const resolved = this._resolveTargets(lms, this.currentPose.targets);
        if (!resolved) return; // can't see enough of the person yet

        // Per-landmark accuracy based on distance to resolved target
        const accuracies = {};
        let totalAcc = 0,
            count = 0;

        for (const [idxStr, target] of Object.entries(resolved)) {
            const idx = parseInt(idxStr);
            const lm = lms[idx];
            if (!lm) continue;
            const dist = Math.sqrt((lm.x - target.x) ** 2 + (lm.y - target.y) ** 2);
            // Tolerance scaled to body size: 20% of half-shoulder-width
            const ls = lms[LM.LEFT_SHOULDER],
                rs = lms[LM.RIGHT_SHOULDER];
            const halfSW = ls && rs ? Math.abs(rs.x - ls.x) / 2 : 0.08;
            const tol = halfSW * 1.4; // generous tolerance
            accuracies[idx] = Math.max(0, 1 - dist / tol);
        }

        // Overall accuracy from key landmarks only
        const keyLms = this.currentPose.keyLandmarks || Object.keys(resolved).map(Number);
        for (const idx of keyLms) {
            if (accuracies[idx] !== undefined) {
                totalAcc += accuracies[idx];
                count++;
            }
        }
        const overallAccuracy = count > 0 ? (totalAcc / count) * 100 : 0;

        const feedbackMessages = this._buildFeedback(lms, resolved);

        // Draw the user's actual detected skeleton coloured by accuracy
        drawDynamicOverlay(ctx, lms, w, h, accuracies);

        this.onFrame && this.onFrame({ accuracy: overallAccuracy, feedbackMessages, accuracies });
    }

    _buildFeedback(lms, targets) {
        const rules = this.currentPose.feedback;
        if (!rules) return [];
        const msgs = [];
        const THRESHOLD = 0.07; // normalized distance to trigger feedback

        for (const [idxStr, ruleset] of Object.entries(rules)) {
            const idx = parseInt(idxStr);
            const lm = lms[idx];
            const target = targets[idx];
            if (!lm || !target) continue;

            // Note: MediaPipe y increases downward (0=top, 1=bottom)
            // lm.y > target.y → user landmark is BELOW target → user needs to raise it → use 'low' rule
            // lm.y < target.y → user landmark is ABOVE target → too high → use 'high' rule
            const dy = lm.y - target.y;
            const dx = lm.x - target.x; // positive = landmark is to right in un-mirrored coords
            // in mirrored view: right in camera = user's left

            if (dy > THRESHOLD && ruleset.low) msgs.push({ lm: idx, msg: ruleset.low, dir: 'low' });
            else if (dy < -THRESHOLD && ruleset.high) msgs.push({ lm: idx, msg: ruleset.high, dir: 'high' });
            if (dx > THRESHOLD && ruleset.left) msgs.push({ lm: idx, msg: ruleset.left, dir: 'left' });
            else if (dx < -THRESHOLD && ruleset.right) msgs.push({ lm: idx, msg: ruleset.right, dir: 'right' });
        }

        // Deduplicate messages
        const seen = new Set();
        return msgs
            .filter((m) => {
                if (seen.has(m.msg)) return false;
                seen.add(m.msg);
                return true;
            })
            .slice(0, 4);
    }
}
