(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Split the title into letters */
  document.querySelectorAll('.split').forEach((el) => {
    const text = el.textContent; el.setAttribute('aria-label', text); el.textContent = '';
    let i = 0;
    text.split(' ').forEach((word, wi) => {
      const w = document.createElement('span'); w.className = 'word'; w.setAttribute('aria-hidden', 'true');
      [...word].forEach((ch) => { const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--c', i++); s.textContent = ch; w.append(s); });
      el.append(w); if (wi < text.split(' ').length - 1) el.append(' ');
    });
  });

  /* Sound toggle + roar. Browsers allow sound only after a tap, so the roar tries to autoplay, then plays on the first tap. */
  const roar = document.getElementById('roar'), soundBtn = document.getElementById('sound');
  let soundOn = false;
  const setSound = (on) => { soundOn = on; if (soundBtn) soundBtn.setAttribute('aria-pressed', on); if (!on && roar) roar.pause(); };
  const playRoar = () => { if (!roar) return Promise.resolve(); try { roar.currentTime = 0; } catch (e) {} return roar.play().then(() => setSound(true)).catch(() => {}); };
  if (soundBtn) soundBtn.addEventListener('click', () => { if (soundOn) setSound(false); else playRoar(); });

  /* Opening: Godzilla rises, lunges at the cursor and bites it, then the page glides down into the start */
  const curtain = document.getElementById('curtain'), beast = document.getElementById('beast'), bait = document.getElementById('bait');
  let opened = false;
  const ready = () => { if (opened) return; opened = true; root.classList.add('ready'); setTimeout(() => { if (curtain) curtain.remove(); }, 1400); };
  if (still || !curtain || !beast) { if (curtain) curtain.remove(); root.classList.add('ready'); }
  else {
    let px = innerWidth * 0.5, py = innerHeight * 0.42;
    const follow = (e) => { px = e.clientX; py = e.clientY; if (bait) bait.style.transform = `translate(${px}px, ${py}px)`; };
    curtain.addEventListener('pointermove', follow);
    if (bait) bait.style.transform = `translate(${px}px, ${py}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => curtain.classList.add('rise')));
    const timers = [];
    /* Lunge: move the jaw (about 55% across, 16% down the cut-out) onto the cursor */
    timers.push(setTimeout(() => {
      const r = beast.getBoundingClientRect();
      const jawX = r.left + r.width * 0.55, jawY = r.top + r.height * 0.16;
      beast.style.setProperty('--lx', `${px - jawX}px`); beast.style.setProperty('--ly', `${py - jawY}px`);
      curtain.classList.add('lunge'); playRoar();
    }, 1500));
    timers.push(setTimeout(() => curtain.classList.add('bitten'), 1760));
    timers.push(setTimeout(ready, 2300));
    curtain.addEventListener('pointerdown', () => { if (!soundOn) playRoar(); }, { once: true });
    const skip = () => { timers.forEach(clearTimeout); ready(); };
    const skipBtn = document.getElementById('skip'); if (skipBtn) skipBtn.addEventListener('click', skip);
    ['wheel', 'touchmove', 'keydown'].forEach((ev) => addEventListener(ev, skip, { once: true, passive: true }));
  }


  /* Statement words */
  const words = document.getElementById('words');
  const hot = ['zéro.', 'moins', 'un.'];
  if (words) {
    const parts = words.textContent.split(' ');
    words.setAttribute('aria-label', words.textContent);
    words.innerHTML = parts.map((w) => `<span class="w${hot.includes(w) ? ' is-hot' : ''}" aria-hidden="true">${w}</span>`).join(' ');
  }
  const wEls = words ? [...words.querySelectorAll('.w')] : [];

  /* Reveals */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.2 });
  document.querySelectorAll('.reveal, .verdict').forEach((el) => io.observe(el));

  /* Flip cards */
  document.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true')));

  /* Count-up score */
  const score = document.getElementById('score');
  const vObs = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return; vObs.disconnect();
    if (still) return;
    const t0 = performance.now();
    const tick = (t) => { const k = Math.min(1, (t - t0) / 1400); const v = 4.5 * (1 - Math.pow(1 - k, 4)); score.textContent = v.toFixed(1).replace('.', ','); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, { threshold: 0.4 });
  vObs.observe(document.getElementById('verdict'));

  /* Nav: mark the section in view */
  const links = [...document.querySelectorAll('.nav-pill ul a')];
  const navObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  ['fiche', 'histoire', 'avis', 'verdict'].forEach((id) => navObs.observe(document.getElementById(id)));
  const clearObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', 'false')); }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('.hero, .statement, .breakout-sec, .close-line').forEach((el) => clearObs.observe(el));

  /* Wipe reveals for pictures */
  const wo = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.querySelectorAll(':scope > .wipe').forEach((w) => w.classList.add('wiped')); wo.unobserve(e.target); } }), { threshold: 0.15 });
  new Set([...document.querySelectorAll('.wipe')].map((el) => el.parentElement)).forEach((p) => wo.observe(p));

  /* Flip cards: only the visible face is read aloud */
  document.querySelectorAll('.card').forEach((c) => { const sync = () => { const on = c.getAttribute('aria-pressed') === 'true'; c.querySelector('.card-front').setAttribute('aria-hidden', on); c.querySelector('.card-back').setAttribute('aria-hidden', !on); }; sync(); c.addEventListener('click', () => requestAnimationFrame(sync)); });

  /* Mobile: nav hides on scroll down, returns on scroll up */
  let lastY = scrollY; const navEl = document.querySelector('.nav');
  addEventListener('scroll', () => { const y = scrollY; navEl.classList.toggle('nav--hidden', y > lastY && y > 200); lastY = y; }, { passive: true });

  /* Scroll-linked scenes */
  if (still) return;
  if (!document.querySelector('.hero') || !document.getElementById('track') || !document.getElementById('breakout') || !document.getElementById('verdict')) return;
  const hero = document.querySelector('.hero'), stmt = document.querySelector('.statement'), ride = document.querySelector('.ride'), track = document.getElementById('track'), brk = document.getElementById('breakout'), verdict = document.getElementById('verdict');
  const prog = (el) => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / (r.height - innerHeight))); };
  let queued = false;
  const frame = () => {
    queued = false;
    hero.style.setProperty('--p', prog(hero).toFixed(4));
    const sp = prog(stmt); const lit = Math.round(sp * 1.25 * wEls.length);
    wEls.forEach((w, i) => { w.classList.toggle('lit', i < lit); w.classList.toggle('hot', i < lit && w.classList.contains('is-hot')); });
    const br = brk.getBoundingClientRect(); const b = Math.min(1, Math.max(0, (innerHeight - br.top) / (innerHeight * 1.1)));
    brk.style.setProperty('--b', b.toFixed(4));
    if (matchMedia('(min-width: 52rem)').matches) {
      const max = track.scrollWidth - innerWidth; const rp = prog(ride);
      track.style.setProperty('--r', (rp * max).toFixed(1));
      ride.style.setProperty('--rp', rp.toFixed(3));
      track.querySelectorAll('.ride-card').forEach((c) => { const cr = c.getBoundingClientRect(); c.style.setProperty('--k', ((cr.left + cr.width / 2 - innerWidth / 2) / innerWidth).toFixed(3)); });
    }
    const vr = verdict.getBoundingClientRect(); verdict.style.setProperty('--v', Math.min(1, Math.max(0, 1 - vr.top / innerHeight)).toFixed(3));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(frame); } }, { passive: true });
  const sizeRide = () => { if (matchMedia('(min-width: 52rem)').matches) ride.style.height = (track.scrollWidth - innerWidth + innerHeight * 1.15) + 'px'; else ride.style.height = ''; };
  sizeRide();
  addEventListener('resize', () => { sizeRide(); frame(); });
  frame();

})();
