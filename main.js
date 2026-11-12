(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roar = document.getElementById('roar');
  const soundBtn = document.getElementById('sound');

  /* Sound: browsers only allow audio after a tap or key, so the roar plays on autoplay if allowed, else on the first tap. */
  let soundOn = false;
  const setSound = (on) => { soundOn = on; soundBtn.setAttribute('aria-pressed', on); soundBtn.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son'); if (!on) roar.pause(); };
  soundBtn.addEventListener('click', () => { setSound(!soundOn); if (soundOn) { roar.currentTime = 0; roar.play().catch(() => {}); } });
  const tryRoar = () => roar.play().then(() => setSound(true)).catch(() => {});

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

  /* Cold open: black, smash cut to the eyes, smash cut to the roar, cut to the site */
  const open = document.getElementById('coldopen');
  const ready = () => { open.classList.add('done'); root.classList.add('ready'); };
  if (still || !open) { ready(); } else {
    root.style.overflow = 'clip';
    const timers = [];
    const shot = (n, t) => timers.push(setTimeout(() => { open.dataset.shot = n; if (n === 2) tryRoar(); }, t));
    shot(1, 350); shot(2, 1250);
    const end = () => { timers.forEach(clearTimeout); root.style.overflow = ''; ready(); };
    timers.push(setTimeout(end, 2700));
    open.addEventListener('click', () => { tryRoar(); end(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') end(); }, { once: true });
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

  /* Poll */
  const poll = document.querySelector('.poll');
  poll.addEventListener('submit', (e) => { e.preventDefault(); poll.querySelector('.form-status').textContent = 'Les réponses ne sont pas encore branchées : rien n’a été envoyé.'; });

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

  /* Scroll-linked scenes */
  if (still) return;
  const hero = document.querySelector('.hero'), stmt = document.querySelector('.statement'), ride = document.querySelector('.ride'), track = document.getElementById('track'), brk = document.getElementById('breakout'), verdict = document.getElementById('verdict');
  const prog = (el) => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / (r.height - innerHeight))); };
  let queued = false;
  const frame = () => {
    queued = false;
    hero.style.setProperty('--p', prog(hero).toFixed(4));
    const sp = prog(stmt); const lit = Math.round(sp * 1.25 * wEls.length);
    wEls.forEach((w, i) => { w.classList.toggle('lit', i < lit); w.classList.toggle('hot', i < lit && w.classList.contains('is-hot')); });
    const br = brk.getBoundingClientRect(); const b = Math.min(1, Math.max(0, (innerHeight - br.top) / (innerHeight * 0.75)));
    brk.style.setProperty('--b', b.toFixed(4));
    if (matchMedia('(min-width: 52rem)').matches) {
      const max = track.scrollWidth - innerWidth; const rp = prog(ride);
      track.style.setProperty('--r', (rp * max).toFixed(1));
      track.querySelectorAll('.ride-card').forEach((c) => { const cr = c.getBoundingClientRect(); c.style.setProperty('--k', ((cr.left + cr.width / 2 - innerWidth / 2) / innerWidth).toFixed(3)); });
    }
    const vr = verdict.getBoundingClientRect(); verdict.style.setProperty('--v', Math.min(1, Math.max(0, 1 - vr.top / innerHeight)).toFixed(3));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener('resize', frame);
  frame();

  /* Nav: mark the section in view */
  const links = [...document.querySelectorAll('.nav-pill ul a')];
  const navObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  ['fiche', 'histoire', 'avis', 'verdict'].forEach((id) => navObs.observe(document.getElementById(id)));
})();
