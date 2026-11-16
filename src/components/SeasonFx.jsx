import { useEffect, useRef } from 'react';

// Лёгкая сезонная анимация поверх экрана: снег, лепестки, блики и бабочка,
// листья. Частиц мало, они полупрозрачные и не ловят нажатия.
// Когда приложение свёрнуто или анимация выключена, ничего не рисуется.

const rnd = (a, b) => a + Math.random() * (b - a);

function makeParticles(season, w, h) {
  const fresh = (p, anywhere) => Object.assign(p, {
    x: rnd(0, w), y: anywhere ? rnd(0, h) : rnd(-60, -10),
    sway: rnd(0, Math.PI * 2), rot: rnd(0, Math.PI * 2),
  });
  const make = (n, extra) => Array.from({ length: n }, () => fresh({ ...extra() }, true));
  if (season === 'winter') return { fresh, list: make(14, () => ({ r: rnd(1.6, 3.6), vy: rnd(18, 40), amp: rnd(8, 22), sp: rnd(0.4, 1) })) };
  if (season === 'spring') return { fresh, list: make(8, () => ({ r: rnd(4, 6.5), vy: rnd(22, 38), vx: rnd(6, 16), amp: rnd(10, 26), sp: rnd(0.6, 1.2), vr: rnd(-1.2, 1.2) })) };
  if (season === 'autumn') return { fresh, list: make(9, () => ({ r: rnd(6, 9.5), vy: rnd(24, 44), vx: rnd(-8, 12), amp: rnd(14, 34), sp: rnd(0.5, 1.1), vr: rnd(-1.4, 1.4), hue: Math.random() < 0.5 ? '#E6A91F' : '#D9731F' })) };
  // лето: три мягких блика и бабочка, которая пролетает время от времени
  return {
    fresh,
    list: Array.from({ length: 3 }, (_, i) => ({ glint: true, x: rnd(0, w), y: rnd(0, h * 0.5), r: rnd(70, 130), vx: rnd(3, 8) * (i % 2 ? -1 : 1), sway: rnd(0, 6), sp: rnd(0.15, 0.3) })),
    butterfly: { next: 6, on: false },
  };
}

function drawLeaf(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.9, -r * 0.6, r * 0.8, r * 0.5, 0, r);
  ctx.bezierCurveTo(-r * 0.8, r * 0.5, -r * 0.9, -r * 0.6, 0, -r);
  ctx.fill();
}

export default function SeasonFx({ season, active }) {
  const ref = useRef();

  useEffect(() => {
    const canvas = ref.current;
    if (!active || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, raf = 0, last = 0, t = 0, scene = null;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene = makeParticles(season, w, h);
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // не чаще 30 кадров в секунду: бережём батарею
      const dt = Math.min(0.1, (now - last) / 1000 || 0.033);
      last = now; t += dt;
      ctx.clearRect(0, 0, w, h);
      for (const p of scene.list) {
        if (p.glint) {
          p.x += p.vx * dt; if (p.x < -p.r) p.x = w + p.r; if (p.x > w + p.r) p.x = -p.r;
          const a = 0.08 + 0.05 * Math.sin(t * p.sp + p.sway);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(255, 236, 150, ${a})`); g.addColorStop(1, 'rgba(255, 236, 150, 0)');
          ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          continue;
        }
        p.y += p.vy * dt;
        p.sway += p.sp * dt;
        const x = p.x + Math.sin(p.sway) * p.amp + (p.vx || 0) * (p.y / 40);
        if (p.vr) p.rot += p.vr * dt;
        if (p.y > h + 20) scene.fresh(p, false);
        if (season === 'winter') {
          ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, .92)'; ctx.fill();
          ctx.strokeStyle = 'rgba(110, 140, 175, .45)'; ctx.lineWidth = 1; ctx.stroke();
        } else {
          ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.sway * 1.7)));
          if (season === 'spring') { ctx.fillStyle = 'rgba(240, 150, 178, .6)'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.globalAlpha = 0.72; ctx.fillStyle = p.hue; drawLeaf(ctx, p.r); }
          ctx.restore();
        }
      }
      const b = scene.butterfly;
      if (b) {
        if (!b.on) {
          b.next -= dt;
          if (b.next <= 0) Object.assign(b, { on: true, x: -20, y: rnd(h * 0.15, h * 0.6), dir: 1, ph: 0 });
        } else {
          b.x += 46 * dt; b.ph += dt * 14; b.y += Math.sin(b.ph * 0.35) * 26 * dt;
          const flap = 0.25 + 0.75 * Math.abs(Math.sin(b.ph));
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(0.35); ctx.globalAlpha = 0.8; ctx.fillStyle = '#F08A24';
          for (const s of [-1, 1]) { ctx.save(); ctx.scale(s * flap, 1); ctx.beginPath(); ctx.ellipse(6, -3, 7, 5, -0.5, 0, Math.PI * 2); ctx.ellipse(5, 4, 5, 3.5, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
          ctx.fillStyle = '#3A2A1A'; ctx.fillRect(-0.8, -6, 1.6, 12);
          ctx.restore();
          if (b.x > w + 30) Object.assign(b, { on: false, next: rnd(18, 35) });
        }
      }
    };

    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => (document.hidden ? stop() : start());

    resize();
    if (!document.hidden) start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); ctx.clearRect(0, 0, w, h); };
  }, [season, active]);

  if (!active) return null;
  return <canvas ref={ref} className="season-fx" aria-hidden="true" />;
}
