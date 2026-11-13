(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);

  /* Split text into letters (hero title, footer mark) */
  $$('.split, .split-foot').forEach((el) => {
    const text = el.textContent, words = text.split(' '); el.setAttribute('aria-label', text); el.textContent = '';
    let i = 0;
    words.forEach((word, wi) => {
      const w = document.createElement('span'); w.className = 'word'; w.setAttribute('aria-hidden', 'true');
      [...word].forEach((ch) => { const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--c', i++); s.textContent = ch; w.append(s); });
      el.append(w); if (wi < words.length - 1) el.append(' ');
    });
  });

  /* Sound toggle */
  const roar = document.getElementById('roar'), soundBtn = document.getElementById('sound');
  if (roar) roar.volume = 0.4;
  let soundOn = false;
  const setSound = (on) => { soundOn = on; if (soundBtn) soundBtn.setAttribute('aria-pressed', on); if (!on && roar) roar.pause(); };
  const playRoar = () => { if (!roar) return Promise.resolve(); try { roar.currentTime = 0; } catch (e) {} return roar.play().then(() => setSound(true)).catch(() => {}); };
  if (soundBtn) soundBtn.addEventListener('click', () => { if (soundOn) setSound(false); else playRoar(); });
  if (roar) { roar.addEventListener('playing', () => setSound(true)); roar.addEventListener('ended', () => setSound(false)); }

  /* Opening is run by intro.js; this is what it needs */
  const curtain = document.getElementById('curtain');
  let opened = false;
  const ready = () => { if (opened) return; opened = true; root.classList.add('ready'); setTimeout(() => { if (curtain) curtain.remove(); }, 1500); };
  window.siteReady = ready; window.playRoar = playRoar;
  if (still || !curtain) { if (curtain) curtain.remove(); root.classList.add('ready'); opened = true; }
  else {
    const skip = () => { window.introSkipped = true; ready(); };
    const skipBtn = document.getElementById('skip'); if (skipBtn) skipBtn.addEventListener('click', skip);
    ['wheel', 'touchmove', 'keydown'].forEach((ev) => addEventListener(ev, skip, { once: true, passive: true }));
  }

  /* Statement words */
  const words = document.getElementById('words'); const hot = ['zéro.', 'moins', 'un.']; let wEls = [];
  if (words) {
    const text = words.textContent; words.setAttribute('aria-label', text);
    words.innerHTML = text.split(' ').map((w) => `<span class="w${hot.includes(w) ? ' is-hot' : ''}" aria-hidden="true">${w}</span>`).join(' ');
    wEls = [...words.querySelectorAll('.w')];
  }

  /* Reveal on arrival */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.2 });
  $$('.reveal, .mask, .footer-mark').forEach((el) => io.observe(el));

  /* Flip cards: only the visible face is read aloud */
  $$('.card').forEach((c) => {
    const sync = () => { const on = c.getAttribute('aria-pressed') === 'true'; c.querySelector('.card-front').setAttribute('aria-hidden', on); c.querySelector('.card-back').setAttribute('aria-hidden', !on); };
    sync(); c.addEventListener('click', () => { c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true'); sync(); });
  });

  /* Nav: current section, and hide on scroll down (phones) */
  const links = $$('.nav-pill ul a'), band = { rootMargin: '-45% 0px -50% 0px' };
  const navObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id)); }), band);
  ['fiche', 'histoire', 'avis', 'verdict'].forEach((id) => { const el = document.getElementById(id); if (el) navObs.observe(el); });
  const clearObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', 'false')); }), band);
  $$('.hero, .portal, .close-line').forEach((el) => clearObs.observe(el));
  let lastY = scrollY; const navEl = $('.nav');
  addEventListener('scroll', () => { const y = scrollY; if (navEl) navEl.classList.toggle('nav--hidden', y > lastY && y > 200); lastY = y; }, { passive: true });

  const verdict = document.getElementById('verdict');
  if (still) { if (verdict) verdict.classList.add('in'); return; }

  /* ---------- Scroll scenes: targets are read from scroll, then eased toward every frame ---------- */
  const hero = $('.hero'), portal = document.getElementById('portal'), stage = $('.portal-stage'), holeText = document.getElementById('hole-text'), holeFull = (() => {
    const m = document.getElementById('hole'); if (!m) return null;
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); r.setAttribute('width', '100%'); r.setAttribute('height', '100%'); r.setAttribute('fill', 'white'); r.setAttribute('opacity', '0'); m.append(r); return r;
  })();
  const ride = $('.ride'), track = document.getElementById('track'), cards = $$('.ride-card'), bar = $('.progress');
  const wide = matchMedia('(min-width: 52rem)');
  const prog = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
  const sizeRide = () => { if (!ride || !track) return; ride.style.height = wide.matches ? (track.scrollWidth - innerWidth + innerHeight * 1.2) + 'px' : ''; };
  sizeRide();

  const tgt = { cover: 0, portal: 0, ride: 0, verdict: 0, page: 0 }, cur = { ...tgt };
  const read = () => {
    tgt.cover = clamp(scrollY / innerHeight);
    if (portal) tgt.portal = prog(portal);
    if (ride) tgt.ride = prog(ride);
    if (verdict) tgt.verdict = prog(verdict);
    tgt.page = clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
  };
  let origin = null;
  const apply = () => {
    if (hero) hero.style.setProperty('--cover', cur.cover.toFixed(4));
    if (bar) bar.style.setProperty('--page', cur.page.toFixed(4));

    if (stage) {
      const p = cur.portal;
      /* 0–.28 words light up · .28–.4 words leave, the "-1" grows in · .4–.72 fall through it · .78–.96 the photo becomes a frame */
      const lit = Math.round(seg(p, 0.02, 0.28) * wEls.length);
      wEls.forEach((w, i) => { const on = i < lit; w.classList.toggle('lit', on); w.classList.toggle('hot', on && w.classList.contains('is-hot')); });
      stage.style.setProperty('--wo', (1 - smooth(seg(p, 0.28, 0.35))).toFixed(3));
      if (holeText) {
        if (!origin) { try { const b = holeText.getBBox(); origin = { x: b.x + b.width * 0.8, y: b.y + b.height * 0.5 }; } catch (e) { origin = { x: innerWidth / 2, y: innerHeight / 2 }; } }
        const grow = smooth(seg(p, 0.34, 0.42)), fall = seg(p, 0.42, 0.72);
        const s = grow * Math.exp(fall * fall * Math.log(160));
        holeText.setAttribute('transform', `translate(${origin.x} ${origin.y}) scale(${s.toFixed(4)}) translate(${-origin.x} ${-origin.y})`);
        if (holeFull) holeFull.setAttribute('opacity', smooth(seg(p, 0.62, 0.72)).toFixed(3));
      }
      stage.style.setProperty('--cut', p > 0.72 ? 1 : 0);
      stage.style.setProperty('--f', smooth(seg(p, 0.78, 0.96)).toFixed(4));
      stage.style.setProperty('--cap', smooth(seg(p, 0.92, 0.99)).toFixed(3));
    }

    if (ride && track && wide.matches) {
      const max = track.scrollWidth - innerWidth;
      track.style.setProperty('--r', (cur.ride * max).toFixed(1)); ride.style.setProperty('--rp', cur.ride.toFixed(3));
      cards.forEach((c) => { const r = c.getBoundingClientRect(); const k = (r.left + r.width / 2 - innerWidth / 2) / innerWidth; c.style.setProperty('--k', k.toFixed(3)); c.style.setProperty('--far', clamp(Math.abs(k) * 1.2).toFixed(3)); });
    }

    if (verdict) { verdict.style.setProperty('--v', smooth(seg(cur.verdict, 0, 0.7)).toFixed(4)); if (cur.verdict > 0.18) verdict.classList.add('in'); }
  };

  let running = false;
  const loop = () => {
    let moving = false;
    for (const k in tgt) { const d = tgt[k] - cur[k]; if (Math.abs(d) > 0.0004) { cur[k] += d * 0.14; moving = true; } else cur[k] = tgt[k]; }
    apply();
    if (moving) requestAnimationFrame(loop); else running = false;
  };
  const kick = () => { read(); if (!running) { running = true; requestAnimationFrame(loop); } };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { origin = null; sizeRide(); kick(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { origin = null; sizeRide(); kick(); });
  read(); Object.assign(cur, tgt); apply();

  /* ---------- Presentation mode: the page scrolls itself, slowly, for a big screen ----------
     Start: the "Lecture auto" button, the P key, or ?auto in the address. Space pauses. Scrolling or Escape hands control back. */
  const autoBtn = document.getElementById('auto');
  if (autoBtn) {
    autoBtn.hidden = false;
    const top = (el) => el.getBoundingClientRect().top + scrollY;
    const plan = () => {
      const vh = innerHeight, steps = [], go = (y, travel, hold, act) => steps.push({ y: Math.max(0, Math.round(y)), travel, hold, act });
      const fiche = document.getElementById('fiche'), avis = document.getElementById('avis'), deck = $('.deck'), close = $('.close-line');
      go(0, 0.01, 3);
      if (fiche) go(top(fiche) - vh * 0.12, 5, 6);
      if (portal) { go(top(portal), 4, 0.5); go(top(portal) + (portal.offsetHeight - vh) * 0.3, 8, 1.5); go(top(portal) + (portal.offsetHeight - vh), 16, 4); }
      if (ride) { go(top(ride), 4, 2.5); go(top(ride) + (ride.offsetHeight - vh), 24, 3); }
      if (avis) go(top(avis) - vh * 0.1, 4, 12);
      if (deck) go(top(deck) - vh * 0.3, 4, 1, 'cards');
      if (verdict) go(top(verdict) + (verdict.offsetHeight - vh) * 0.9, 9, 7);
      if (close) go(top(close) - vh * 0.25, 4, 5);
      go(document.documentElement.scrollHeight - vh, 5, 0);
      return steps;
    };
    const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
    let on = false, paused = false, steps = [], idx = 0, from = 0, t0 = 0, phase = 'travel', raf = 0, last = 0;
    const label = () => { autoBtn.textContent = !on ? 'Lecture auto' : paused ? 'Reprendre' : 'Pause'; autoBtn.setAttribute('aria-pressed', on && !paused); root.classList.toggle('auto-on', on); };
    const stop = () => { on = false; paused = false; cancelAnimationFrame(raf); label(); };
    const flipCards = (done) => {
      const cs = $$('.card').filter((c) => c.getAttribute('aria-pressed') !== 'true'); let i = 0;
      const next = () => { if (!on) return; if (paused) { setTimeout(next, 300); return; } if (i >= cs.length) { setTimeout(done, 2500); return; } cs[i++].click(); setTimeout(next, 2800); };
      next();
    };
    const begin = (i) => { idx = i; if (idx >= steps.length) { stop(); return; } from = scrollY; t0 = performance.now(); phase = 'travel'; };
    const tick = (now) => {
      if (!on) return;
      if (paused) { t0 += now - last; last = now; raf = requestAnimationFrame(tick); return; }
      last = now;
      const st = steps[idx], el = (now - t0) / 1000;
      if (phase === 'travel') {
        const k = Math.min(1, el / st.travel); scrollTo(0, from + (st.y - from) * ease(k));
        if (k >= 1) { phase = 'hold'; t0 = now; if (st.act === 'cards') { phase = 'act'; flipCards(() => { if (on) begin(idx + 1); }); } }
      } else if (phase === 'hold' && el >= st.hold) begin(idx + 1);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!root.classList.contains('ready')) { window.introSkipped = true; ready(); }
      sizeRide(); steps = plan(); on = true; paused = false; label();
      let i = 0; while (i < steps.length - 1 && steps[i].y < scrollY - 4) i++;
      begin(scrollY < 4 ? 0 : i); last = performance.now(); raf = requestAnimationFrame(tick);
    };
    autoBtn.addEventListener('click', () => { if (!on) start(); else { paused = !paused; label(); } });
    addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') { if (on) stop(); else start(); }
      else if (on && e.key === ' ') { e.preventDefault(); paused = !paused; label(); }
      else if (on && e.key === 'Escape') stop();
    });
    ['wheel', 'touchmove'].forEach((ev) => addEventListener(ev, () => { if (on) stop(); }, { passive: true }));
    addEventListener('resize', () => { if (on) steps = plan(); });
    if (new URLSearchParams(location.search).has('auto')) {
      const wait = setInterval(() => { if (root.classList.contains('ready')) { clearInterval(wait); setTimeout(start, 2500); } }, 200);
    }
  }
})();
