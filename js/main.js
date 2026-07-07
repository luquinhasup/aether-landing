/* ============ AETHER — motor de scroll e cenas ============ */
"use strict";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

const VIOLET = "#8b6bff";
const WHITE = "#ece9f8";

/* ---------- progresso de uma seção "pinned" ---------- */
function sectionProgress(section) {
  const rect = section.getBoundingClientRect();
  const total = section.offsetHeight - window.innerHeight;
  if (total <= 0) return 0;
  return clamp(-rect.top / total, 0, 1);
}

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/* ============================================================
   HERO — partículas que se montam num painel conforme o scroll
   ============================================================ */
const hero = {
  section: document.querySelector(".hero"),
  canvas: document.getElementById("heroCanvas"),
  copy: document.getElementById("heroCopy"),
  caption: document.getElementById("heroCaption"),
  hint: document.getElementById("heroHint"),
  particles: [],
  line: [],
  size: { w: 0, h: 0 },
  progress: 0,

  buildTargets(w, h) {
    const pts = [];
    const line = [];
    const push = (x, y, kind, a) => pts.push({ tx: x, ty: y, kind, ta: a });

    const W = Math.min(w * 0.68, 1020);
    const H = Math.min(W * 0.55, h * 0.58);
    const cx = w / 2, cy = h * 0.55;
    const x0 = cx - W / 2, y0 = cy - H / 2;

    // moldura do painel
    const per = 2 * (W + H);
    for (let i = 0; i < 380; i++) {
      const d = (i / 380) * per;
      let x, y;
      if (d < W) { x = x0 + d; y = y0; }
      else if (d < W + H) { x = x0 + W; y = y0 + (d - W); }
      else if (d < 2 * W + H) { x = x0 + W - (d - W - H); y = y0 + H; }
      else { x = x0; y = y0 + H - (d - 2 * W - H); }
      push(x, y, "w", 0.75);
    }

    // divisória do cabeçalho + "botões"
    const hy = y0 + H * 0.12;
    for (let i = 0; i < 70; i++) push(x0 + (i / 69) * W, hy, "w", 0.45);
    for (let d = 0; d < 3; d++) {
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        push(x0 + 24 + d * 17 + Math.cos(ang) * 3.6, y0 + H * 0.06 + Math.sin(ang) * 3.6, d === 0 ? "v" : "w", 0.9);
      }
    }

    // divisória lateral + cartões de estatística
    const sx = x0 + W * 0.24;
    for (let i = 0; i < 56; i++) push(sx, hy + (i / 55) * (H * 0.88), "w", 0.45);
    for (let r = 0; r < 4; r++) {
      const rx = x0 + W * 0.045, ry = hy + H * 0.09 + r * H * 0.195;
      const rw = W * 0.15, rh = H * 0.105;
      const perim = 2 * (rw + rh);
      for (let i = 0; i < 36; i++) {
        const d = (i / 36) * perim;
        let x, y;
        if (d < rw) { x = rx + d; y = ry; }
        else if (d < rw + rh) { x = rx + rw; y = ry + (d - rw); }
        else if (d < 2 * rw + rh) { x = rx + rw - (d - rw - rh); y = ry + rh; }
        else { x = rx; y = ry + rh - (d - 2 * rw - rh); }
        push(x, y, i % 8 === 0 ? "v" : "w", 0.5);
      }
    }

    // área do gráfico: eixo, candles e linha ascendente
    const chX = sx + W * 0.05;
    const chW = x0 + W * 0.96 - chX;
    const chY = hy + H * 0.09, chH = H * 0.66;
    for (let i = 0; i < 60; i++) push(chX + (i / 59) * chW, chY + chH, "w", 0.3);

    let base = 0.74;
    for (let c = 0; c < 16; c++) {
      base = clamp(base - 0.033 + Math.sin(c * 2.7) * 0.05, 0.1, 0.85);
      const px = chX + (0.03 + (c / 15) * 0.94) * chW;
      const top = chY + base * chH;
      const bodyH = chH * (0.1 + Math.abs(Math.sin(c * 1.3)) * 0.1);
      const up = Math.sin(c * 2.1) > -0.45;
      for (let i = 0; i < 12; i++) push(px, top + (i / 11) * bodyH, up ? "v" : "w", up ? 0.95 : 0.45);
      for (let i = 0; i < 4; i++) push(px, top - 5 - i * 3.4, "w", 0.35);
    }

    for (let i = 0; i < 210; i++) {
      const t = i / 209;
      const x = chX + t * chW;
      const y = chY + chH * (0.86 - 0.68 * t + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.018);
      push(x, y, "v", 0.95);
      line.push({ x, y });
    }
    return { pts, line };
  },

  setup() {
    const { w, h } = fitCanvas(this.canvas);
    this.size = { w, h };
    const { pts, line } = this.buildTargets(w, h);
    this.line = line;
    const R = Math.min(w, h) * 0.52;
    this.particles = pts.map((p, i) => ({
      ...p,
      a0: Math.random() * Math.PI * 2,
      r: R * (0.25 + Math.pow(Math.random(), 0.7) * 0.95),
      sp: (Math.random() * 0.5 + 0.12) * (Math.random() > 0.5 ? 1 : -1),
      bob: Math.random() * Math.PI * 2,
      delay: Math.random(),
      sz: Math.random() < 0.12 ? 2.6 : 1.7,
    }));
    // poeira sem destino — some conforme o painel se monta
    for (let i = 0; i < 260; i++) {
      this.particles.push({
        tx: null, ty: null, kind: Math.random() < 0.3 ? "v" : "w", ta: 0,
        a0: Math.random() * Math.PI * 2,
        r: R * (0.3 + Math.random() * 1.15),
        sp: (Math.random() * 0.6 + 0.1) * (Math.random() > 0.5 ? 1 : -1),
        bob: Math.random() * Math.PI * 2,
        delay: Math.random(), sz: 1.4,
      });
    }
  },

  render(t) {
    const { ctx, w, h } = fitCanvas(this.canvas);
    if (w !== this.size.w || h !== this.size.h) this.setup();
    const p = sectionProgress(this.section);
    this.progress = p;
    window.__heroProgress = p; // exposto para verificação

    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.55;
    const assemble = smooth((p - 0.06) / 0.72);

    for (const pt of this.particles) {
      const e = pt.tx === null ? 0 : smooth((p * 1.35 - pt.delay * 0.38) / 0.9);
      const shrink = 1 - assemble * 0.35;
      const sx = cx + Math.cos(pt.a0 + t * pt.sp) * pt.r * shrink;
      const sy = cy + Math.sin(pt.a0 + t * pt.sp) * pt.r * 0.62 * shrink + Math.sin(t * 0.9 + pt.bob) * 14;
      const x = pt.tx === null ? sx : lerp(sx, pt.tx, e);
      const y = pt.ty === null ? sy : lerp(sy, pt.ty, e);
      let alpha = pt.tx === null
        ? 0.35 * (1 - assemble)
        : lerp(0.3, pt.ta, e);
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.kind === "v" ? VIOLET : WHITE;
      ctx.fillRect(x, y, pt.sz, pt.sz);
    }

    // batimento: a linha do gráfico pulsa quando o painel está montado
    const lineIn = smooth((p - 0.62) / 0.22);
    if (lineIn > 0.01 && this.line.length) {
      const ph = (t % 1.7) / 1.7;
      const beat = Math.exp(-Math.pow((ph - 0.18) / 0.055, 2)) + 0.55 * Math.exp(-Math.pow((ph - 0.36) / 0.06, 2));
      ctx.globalAlpha = lineIn * (0.45 + 0.55 * beat);
      ctx.strokeStyle = VIOLET;
      ctx.lineWidth = 1.6 + beat * 2.2;
      ctx.shadowColor = VIOLET;
      ctx.shadowBlur = 10 + beat * 34;
      ctx.beginPath();
      this.line.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // texto: título sai de cena enquanto o painel se monta
    const fade = 1 - smooth((p - 0.12) / 0.3);
    this.copy.style.opacity = fade;
    this.copy.style.transform = `translateY(${-smooth((p - 0.12) / 0.3) * 120}px)`;
    this.copy.style.pointerEvents = fade < 0.3 ? "none" : "auto";
    this.caption.style.opacity = smooth((p - 0.74) / 0.2);
    this.hint.style.opacity = 1 - smooth(p / 0.1);
  },
};

/* ============================================================
   O MÉTODO — travelling macro sobre gráficos holográficos
   ============================================================ */
const signal = {
  section: document.querySelector(".signal"),
  canvas: document.getElementById("signalCanvas"),
  words: [...document.querySelectorAll(".signal__word")],
  cols: [],
  charts: [],
  size: { w: 0, h: 0 },

  setup() {
    const { w, h } = fitCanvas(this.canvas);
    this.size = { w, h };
    this.cols = [];
    const digits = "0123456789";
    for (let i = 0; i < 54; i++) {
      const chars = [];
      for (let j = 0; j < 16; j++) chars.push(digits[(Math.random() * 10) | 0] + digits[(Math.random() * 10) | 0] + "." + digits[(Math.random() * 10) | 0]);
      this.cols.push({
        x: -w * 0.1 + Math.random() * w * 1.7,
        y: Math.random() * h,
        sp: 8 + Math.random() * 26,
        chars,
        v: Math.random() < 0.16,
        a: 0.05 + Math.random() * 0.1,
      });
    }
    this.charts = [];
    for (let g = 0; g < 3; g++) {
      const candles = [];
      let base = 0.5 + Math.random() * 0.15;
      for (let c = 0; c < 15; c++) {
        base = clamp(base + (Math.random() - 0.48) * 0.09, 0.2, 0.8);
        candles.push({ o: base, h: 0.05 + Math.random() * 0.12, up: Math.random() > 0.42, flick: Math.random() * Math.PI * 2 });
      }
      this.charts.push({ gx: w * (0.12 + g * 0.55), gy: h * (0.28 + (g % 2) * 0.18), gw: w * 0.4, gh: h * 0.42, candles });
    }
    // candle destacado: meio do segundo grupo
    this.hl = { chart: 1, idx: 9 };
  },

  render(t) {
    const { ctx, w, h } = fitCanvas(this.canvas);
    if (w !== this.size.w || h !== this.size.h) this.setup();
    const p = sectionProgress(this.section);
    window.__signalProgress = p;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-p * w * 0.5, 0);

    // linhas de grade
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = (i / 7) * h;
      ctx.beginPath(); ctx.moveTo(-w * 0.2, y); ctx.lineTo(w * 1.8, y); ctx.stroke();
    }

    // colunas de números
    ctx.font = "12px 'SF Mono', ui-monospace, monospace";
    for (const c of this.cols) {
      ctx.fillStyle = c.v ? "rgba(139,107,255,0.5)" : "rgba(236,233,248,0.5)";
      for (let j = 0; j < c.chars.length; j++) {
        const y = (c.y + j * 26 + t * c.sp) % (h + 60) - 30;
        ctx.globalAlpha = c.a * (0.4 + 0.6 * Math.abs(Math.sin(j + t * 0.6)));
        ctx.fillText(c.chars[j], c.x, y);
      }
    }
    ctx.globalAlpha = 1;

    // gráficos de candles holográficos
    this.charts.forEach((ch, gi) => {
      const cw = ch.gw / ch.candles.length;
      ch.candles.forEach((cd, ci) => {
        const x = ch.gx + ci * cw;
        const top = ch.gy + cd.o * ch.gh;
        const bh = cd.h * ch.gh;
        const isHL = gi === this.hl.chart && ci === this.hl.idx;
        const flicker = 0.55 + 0.45 * Math.sin(t * 1.4 + cd.flick);
        ctx.globalAlpha = isHL ? 0.9 : 0.28 * flicker;
        ctx.strokeStyle = ctx.fillStyle = isHL ? VIOLET : cd.up ? "rgba(236,233,248,0.9)" : "rgba(150,146,170,0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + cw * 0.3, top - bh * 0.5); ctx.lineTo(x + cw * 0.3, top + bh * 1.4); ctx.stroke();
        ctx.fillRect(x + cw * 0.3 - 2.5, top, 5, bh);

        if (isHL) {
          const hp = smooth((p - 0.45) / 0.2);
          if (hp > 0.01) {
            const pulse = 1 + Math.sin(t * 3) * 0.12;
            ctx.globalAlpha = hp * 0.9;
            ctx.strokeStyle = VIOLET;
            ctx.lineWidth = 1.6;
            ctx.shadowColor = VIOLET;
            ctx.shadowBlur = 26 * hp;
            ctx.beginPath();
            ctx.arc(x + cw * 0.3, top + bh * 0.5, (26 + bh * 0.5) * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      });
    });
    ctx.restore();
    ctx.globalAlpha = 1;

    // palavras: Filtrar / Confirmar / Entregar
    const seg = p * 3;
    this.words.forEach((el, i) => {
      const d = seg - i;
      let op = 0, ty = 44;
      if (d >= 0 && (d < 1 || i === 2)) {
        const inT = smooth(d / 0.3);
        const outT = i === 2 ? 0 : smooth((d - 0.72) / 0.28);
        op = inT * (1 - outT);
        ty = (1 - inT) * 44 - outT * 30;
      }
      el.style.opacity = op;
      el.style.transform = `translateY(${ty}px)`;
    });
  },
};

/* ============================================================
   loop principal — só renderiza cenas visíveis
   ============================================================ */
hero.setup();
signal.setup();

function loop(ms) {
  const t = ms / 1000;
  const hr = hero.section.getBoundingClientRect();
  if (hr.bottom > 0 && hr.top < window.innerHeight) hero.render(t);
  const sr = signal.section.getBoundingClientRect();
  if (sr.bottom > 0 && sr.top < window.innerHeight) signal.render(t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- nav sólida após o hero ---------- */
const nav = document.getElementById("nav");
const darkSections = [signal.section, document.querySelector(".news"), document.querySelector(".footer")];
window.addEventListener("scroll", () => {
  const heroEnd = hero.section.offsetHeight + window.innerHeight * 0.1;
  const past = window.scrollY > heroEnd;
  const overDark = darkSections.some((s) => {
    const r = s.getBoundingClientRect();
    return r.top < 70 && r.bottom > 70;
  });
  nav.classList.toggle("nav--solid", past && !overDark);
  nav.classList.toggle("nav--dark", past && overDark);
}, { passive: true });

/* ---------- revelação de elementos ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { threshold: 0.15 });
document.querySelectorAll(".fx").forEach((el) => io.observe(el));

/* ---------- contadores ---------- */
const cio = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    cio.unobserve(e.target);
    const el = e.target;
    const to = +el.dataset.target, from = +el.dataset.from;
    const t0 = performance.now(), dur = 1600;
    (function tick(now) {
      const k = smooth(clamp((now - t0) / dur, 0, 1));
      el.textContent = Math.round(lerp(from, to, k));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
}, { threshold: 0.6 });
document.querySelectorAll(".counter").forEach((el) => cio.observe(el));

/* ---------- FAQ ---------- */
document.querySelectorAll(".faq__item").forEach((item) => {
  const q = item.querySelector(".faq__q");
  const a = item.querySelector(".faq__a");
  q.addEventListener("click", () => {
    const open = item.classList.contains("open");
    document.querySelectorAll(".faq__item.open").forEach((o) => {
      o.classList.remove("open");
      o.querySelector(".faq__a").style.maxHeight = "0px";
    });
    if (!open) {
      item.classList.add("open");
      a.style.maxHeight = a.scrollHeight + "px";
    }
  });
});
