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
  let soundOn = false;
  const setSound = (on) => { soundOn = on; if (soundBtn) soundBtn.setAttribute('aria-pressed', on); if (!on && roar) roar.pause(); };
  const playRoar = () => { if (!roar) return Promise.resolve(); try { roar.currentTime = 0; } catch (e) {} return roar.play().then(() => setSound(true)).catch(() => {}); };
  if (soundBtn) soundBtn.addEventListener('click', () => { if (soundOn) setSound(false); else playRoar(); });
  if (roar) { roar.addEventListener('playing', () => setSound(true)); roar.addEventListener('ended', () => setSound(false)); }

  /* ---------- Start screen: the presenter sets things up, then the opening plays ---------- */
  const curtain = document.getElementById('curtain'), begin = document.getElementById('begin'), emerge = document.getElementById('emerge');
  const store = { get(k, d) { try { const v = localStorage.getItem('edm-' + k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('edm-' + k, v); } catch (e) {} } };
  const settings = { volume: clamp(+store.get('volume', 40) / 100), mode: store.get('mode', 'step'), intro: store.get('intro', '1') === '1' };
  const applyVolume = () => { if (roar) roar.volume = settings.volume; if (emerge) emerge.volume = settings.volume; };
  applyVolume();
  let opened = false; const readyHooks = [];
  const ready = () => { if (opened) return; opened = true; root.classList.add('ready'); setTimeout(() => { if (curtain) curtain.remove(); readyHooks.forEach((f) => f()); }, 1500); };
  window.site = { settings, ready, playRoar };
  if (still || !curtain || !begin) { if (curtain) curtain.remove(); root.classList.add('ready'); opened = true; settings.mode = 'free'; }
  else {
    const vol = document.getElementById('vol'), volOut = document.getElementById('vol-out'), introOn = document.getElementById('intro-on'), status = document.getElementById('intro-status'), help = document.getElementById('mode-help'), go = document.getElementById('go'), skipBtn = document.getElementById('skip');
    const HELP = { step: 'Un coup de molette, Espace ou une flèche lance la scène suivante. Elle se joue toute seule, tu avances quand tu veux.', auto: 'Tout défile tout seul, lentement (environ 3 minutes). Espace met en pause.', free: 'Défilement normal à la molette, sans rien d’automatique.' };
    vol.value = Math.round(settings.volume * 100); introOn.checked = settings.intro;
    const radio = begin.querySelector(`input[name=mode][value="${settings.mode}"]`); if (radio) radio.checked = true;
    const sync = () => {
      settings.volume = vol.value / 100; settings.intro = introOn.checked; settings.mode = begin.querySelector('input[name=mode]:checked').value;
      volOut.textContent = vol.value + ' %'; help.textContent = HELP[settings.mode]; applyVolume();
      store.set('volume', vol.value); store.set('mode', settings.mode); store.set('intro', settings.intro ? '1' : '0');
    };
    begin.addEventListener('input', sync); sync();
    document.getElementById('vol-test').addEventListener('click', () => { applyVolume(); playRoar(); });
    document.getElementById('fs').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen().catch(() => {}); });
    const intro = () => window.intro || { state: 'loading', progress: 0 };
    const showStatus = () => { const i = intro(); status.textContent = i.state === 'ready' ? 'Modèle 3D prêt.' : i.state === 'failed' ? 'Ouverture 3D indisponible ici, la page s’ouvrira directement.' : `Chargement du modèle… ${Math.round(i.progress * 100)} %`; };
    const watch = setInterval(() => { showStatus(); if (intro().state !== 'loading') clearInterval(watch); }, 200);
    const launch = () => {
      begin.classList.add('gone'); setSound(false); if (roar) roar.pause();
      const i = intro();
      if (settings.intro && i.state === 'ready' && i.play) { skipBtn.hidden = false; i.play(); }
      else { window.introSkipped = true; ready(); }
    };
    begin.addEventListener('submit', (e) => {
      e.preventDefault(); sync(); go.disabled = true;
      if (settings.intro && intro().state === 'loading') { go.textContent = 'Chargement…'; const t0 = Date.now(); const w = setInterval(() => { if (intro().state !== 'loading' || Date.now() - t0 > 20000) { clearInterval(w); launch(); } }, 150); }
      else launch();
    });
    const skip = () => { if (!begin.classList.contains('gone') || opened) return; window.introSkipped = true; ready(); };
    skipBtn.addEventListener('click', skip);
    addEventListener('keydown', (e) => { if (e.key === 'Escape') skip(); });
    go.focus();
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

  /* ---------- Scenes on cue ----------
     The page is a list of cues. In "pas à pas" one input (wheel, Space, arrow, swipe) fires the next cue and the scene
     plays out by itself; in "automatique" the cues fire on a timer. "Libre" leaves normal scrolling alone. */
  const autoBtn = document.getElementById('auto'), stepper = document.getElementById('stepper'), stepN = document.getElementById('step-n'), stepTip = document.getElementById('step-tip');
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const cardsAll = $$('.card');
  const flip = (c, on) => { if ((c.getAttribute('aria-pressed') === 'true') !== on) c.click(); };
  const cues = () => {
    const vh = innerHeight, list = [], cue = (id, path, hold, act) => list.push({ id, path: path.map(([y, t]) => [Math.max(0, Math.round(y)), t]), hold, act });
    const fiche = document.getElementById('fiche'), avis = document.getElementById('avis'), deck = $('.deck'), close = $('.close-line');
    cue('top', [[0, 1.6]], 4);
    if (fiche) cue('fiche', [[top(fiche) - vh * 0.12, 2.4]], 7);
    if (portal) { const p0 = top(portal), span = portal.offsetHeight - vh;
      cue('portal', [[p0, 1.8], [p0 + span * 0.3, 6.5]], 3);
      cue('fall', [[p0 + span * 0.74, 5.5]], 2.5);
      cue('frame', [[p0 + span, 3.6]], 5); }
    if (ride) { const r0 = top(ride), span = ride.offsetHeight - vh, n = cards.length;
      cue('histoire', [[r0, 2.2]], 6);
      for (let i = 1; i < n; i++) cue('histoire', [[r0 + span * (i / (n - 1)), 2.8]], 6); }
    if (avis) cue('avis', [[top(avis) - vh * 0.1, 2.4]], 14);
    if (deck) { cue('deck', [[top(deck) - vh * 0.3, 2]], 1.5); cardsAll.forEach((c, i) => cue('deck', [], 3.5, i)); }
    if (verdict) { const v0 = top(verdict), span = verdict.offsetHeight - vh; cue('verdict', [[v0, 1.8], [v0 + span * 0.9, 4.5]], 8); }
    if (close) cue('fin', [[top(close) - vh * 0.25, 2.4]], 6);
    cue('fin', [[document.documentElement.scrollHeight - vh, 2.2]], 0);
    return list;
  };
  const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
  let list = [], idx = 0, busy = false, auto = false, paused = false, holdTimer = 0, raf2 = 0, quietUntil = 0;
  const stepping = () => settings.mode === 'step' || auto;
  const paint = () => {
    if (autoBtn) { autoBtn.textContent = !auto ? 'Lecture auto' : paused ? 'Reprendre' : 'Pause'; autoBtn.setAttribute('aria-pressed', auto && !paused); }
    if (stepper) { stepper.hidden = !stepping(); stepN.textContent = `${idx + 1} / ${list.length}`; stepTip.textContent = auto ? (paused ? 'En pause · Espace pour reprendre' : 'Lecture auto · Espace pour mettre en pause') : 'Espace ou molette pour avancer'; }
    root.classList.toggle('stepped', stepping());
  };
  const travel = (path, speed, done) => {
    let leg = 0, from = scrollY, t0 = performance.now();
    const run = (now) => {
      if (leg >= path.length) { done(); return; }
      const [y, secs] = path[leg], k = Math.min(1, (now - t0) / (secs * 1000 / speed));
      scrollTo(0, from + (y - from) * ease(k));
      if (k >= 1) { leg++; from = scrollY; t0 = now; }
      raf2 = requestAnimationFrame(run);
    };
    raf2 = requestAnimationFrame(run);
  };
  const goTo = (i, back) => {
    if (busy || i < 0 || i >= list.length) return;
    clearTimeout(holdTimer); busy = true; const c = list[i], prev = list[idx]; idx = i; paint();
    if (!back && typeof c.act === 'number') flip(cardsAll[c.act], true);
    if (back && prev && typeof prev.act === 'number') flip(cardsAll[prev.act], false);
    /* going back retraces to where that cue ends, quicker */
    const path = back ? [[(c.path.length ? c.path[c.path.length - 1][0] : scrollY), 1.2]] : c.path;
    travel(path, 1, () => { busy = false; quietUntil = performance.now() + 350; if (auto && !paused) schedule(); });
  };
  const next = () => goTo(idx + 1, false), prev = () => goTo(idx - 1, true);
  const schedule = () => { clearTimeout(holdTimer); if (idx >= list.length - 1) { auto = false; paint(); return; } holdTimer = setTimeout(() => { if (auto && !paused) next(); }, list[idx].hold * 1000); };
  const nearest = () => { let best = 0, d = Infinity; list.forEach((c, i) => { if (!c.path.length) return; const y = c.path[c.path.length - 1][0], dd = Math.abs(y - scrollY); if (dd < d) { d = dd; best = i; } }); return best; };
  const startAuto = () => { auto = true; paused = false; idx = nearest(); paint(); schedule(); };
  const stopAuto = () => { auto = false; paused = false; clearTimeout(holdTimer); paint(); };
  const enable = () => { sizeRide(); list = cues(); idx = nearest(); paint(); };

  if (autoBtn && wide.matches) {
    autoBtn.hidden = false;
    autoBtn.addEventListener('click', () => { if (!auto) startAuto(); else { paused = !paused; paint(); if (!paused && !busy) schedule(); else clearTimeout(holdTimer); } });
  }
  if (!wide.matches) settings.mode = 'free'; /* phones scroll normally */
  addEventListener('wheel', (e) => {
    if (!opened || !stepping()) return; e.preventDefault();
    if (auto) return; if (busy || performance.now() < quietUntil || Math.abs(e.deltaY) < 8) return;
    if (e.deltaY > 0) next(); else prev();
  }, { passive: false });
  addEventListener('keydown', (e) => {
    if (!opened) return;
    if (e.key === 'p' || e.key === 'P') { if (auto) stopAuto(); else startAuto(); return; }
    if (!stepping()) return;
    const fwd = ['ArrowDown', 'ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key), bwd = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key);
    if (e.key === ' ' && e.target.closest && e.target.closest('button, a')) return;
    if (auto) { if (e.key === ' ') { e.preventDefault(); paused = !paused; paint(); if (!paused && !busy) schedule(); else clearTimeout(holdTimer); } else if (e.key === 'Escape') stopAuto(); else if (fwd || bwd) e.preventDefault(); return; }
    if (fwd) { e.preventDefault(); next(); } else if (bwd) { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0, true); } else if (e.key === 'End') { e.preventDefault(); goTo(list.length - 1, false); }
  });
  /* Nav links jump to their cue */
  links.forEach((a) => a.addEventListener('click', (e) => {
    if (!stepping()) return; e.preventDefault(); const id = a.getAttribute('href').slice(1); const i = list.findIndex((c) => c.id === id);
    if (i >= 0 && !busy) { clearTimeout(holdTimer); busy = true; idx = i; paint(); const c = list[i]; travel([[c.path[0][0], 1.4]], 1, () => { busy = false; if (c.path.length > 1) travel(c.path.slice(1), 1, () => {}); }); }
  }));
  $$('.hero .btn').forEach((a) => a.addEventListener('click', (e) => { if (!stepping()) return; e.preventDefault(); const id = a.getAttribute('href').slice(1); const i = list.findIndex((c) => c.id === id); if (i >= 0) goTo(i, false); }));
  addEventListener('resize', () => { if (stepping()) { list = cues(); paint(); } });
  const begun = () => { enable(); if (settings.mode === 'auto' || new URLSearchParams(location.search).has('auto')) setTimeout(startAuto, 1500); };
  if (opened) begun(); else readyHooks.push(begun);
})();
