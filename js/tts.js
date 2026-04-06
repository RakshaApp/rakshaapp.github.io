// ═══════════════════════════════════════════════════════════════
// TEXT-TO-SPEECH — Web Speech API with proper voice init
// ═══════════════════════════════════════════════════════════════
class TTS {
  constructor() {
    this.synth   = window.speechSynthesis || null;
    this.enabled = true;
    this.voices  = [];
    this.lastMsg = '';
    this.lastAt  = 0;
    this.cooldown = 3500; // ms between same message repeats
    this.globalCooldown = 1800; // ms minimum between any messages

    if (this.synth) {
      // Voices load async in most browsers
      const load = () => { this.voices = this.synth.getVoices(); };
      load();
      this.synth.addEventListener('voiceschanged', load);
    }
  }

  _pickVoice() {
    // Prefer a clear English female voice
    const prefs = ['Samantha','Karen','Moira','Tessa','Victoria','Fiona','Alex'];
    for (const name of prefs) {
      const v = this.voices.find(v => v.name === name);
      if (v) return v;
    }
    // Fallback: any en-US or en-GB voice
    return this.voices.find(v => v.lang === 'en-US') ||
           this.voices.find(v => v.lang === 'en-GB') ||
           this.voices.find(v => v.lang.startsWith('en')) ||
           null;
  }

  speak(text, opts = {}) {
    if (!this.enabled || !this.synth || !text) return;
    const now = Date.now();
    if (now - this.lastAt < this.globalCooldown) return;
    if (text === this.lastMsg && now - this.lastAt < this.cooldown) return;

    this.synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate   = opts.rate   ?? 0.92;
    utt.pitch  = opts.pitch  ?? 1.0;
    utt.volume = opts.volume ?? 1.0;
    const v = this._pickVoice();
    if (v) utt.voice = v;
    this.synth.speak(utt);
    this.lastMsg = text;
    this.lastAt  = now;
  }

  stop() { this.synth?.cancel(); }
  setEnabled(v) { this.enabled = v; if (!v) this.stop(); }
}

const tts = new TTS();
