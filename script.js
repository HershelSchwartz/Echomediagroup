// Echo Media Group — chapter inks for the bar, section entrances, the band drift, and the room tester.
(() => {
  document.documentElement.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The bar takes the ink of whichever chapter sits under it.
  const bar = document.querySelector('.bar');
  const chapters = [...document.querySelectorAll('[data-chapter]')];
  const setInk = () => {
    const probe = bar.offsetHeight / 2;
    for (const el of chapters) {
      const r = el.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        let ink = el.dataset.chapter;
        // The hero's lower field is blue below its seam.
        if (el.classList.contains('hero')) {
          const seam = r.top + innerHeight * (innerWidth <= 760 ? 0.46 : 0.5);
          if (seam <= probe) ink = 'blue';
        }
        if (bar.dataset.ink !== ink) bar.dataset.ink = ink;
        break;
      }
    }
  };

  // The band photograph settles from a slight scale as it crosses the screen.
  const bandImg = document.querySelector('.band-img');
  const drift = () => {
    if (!bandImg || reduce) return;
    const r = bandImg.parentElement.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
    bandImg.style.setProperty('--band-scale', (1.16 - 0.16 * t).toFixed(4));
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { setInk(); drift(); ticking = false; });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  setInk(); drift();

  // Entrances: parts of each block arrive in reading order, once.
  const revealables = document.querySelectorAll('[data-reveal]');
  const stagger = (el) => {
    const kids = el.dataset.reveal === 'lines' || el.dataset.reveal === 'spines' ? [...el.children] : [];
    const step = el.dataset.reveal === 'spines' ? 28 : 80;
    kids.forEach((k, i) => k.style.setProperty('--d', `${i * step}ms`));
  };
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        stagger(e.target);
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    // Neighbouring parts in one section enter a beat apart.
    document.querySelectorAll('section, figure.band').forEach((sec) => {
      sec.querySelectorAll('[data-reveal]').forEach((el, i) => {
        if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${i * 90}ms`);
      });
    });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  // Close the phone menu after choosing a link.
  const menu = document.querySelector('.bar-menu');
  menu?.addEventListener('click', (e) => { if (e.target.closest('a')) menu.open = false; });

  // ---------- The room tester: a clap through a delay line with feedback ----------
  const room = document.querySelector('[data-room]');
  if (!room) return;
  const picks = room.querySelector('.room-picks');
  const clapBtn = room.querySelector('[data-clap]');
  const read = room.querySelector('[data-read]');
  const echoRow = room.querySelector('[data-echo]');
  const AC = window.AudioContext || window.webkitAudioContext;

  picks.hidden = false;
  clapBtn.hidden = false;
  room.querySelector('.room-ask').textContent = 'Pick a room, then clap. Every space sends a sound back differently.';

  const radios = [...picks.querySelectorAll('[role="radio"]')];
  const current = () => radios.find((b) => b.getAttribute('aria-checked') === 'true') || radios[1];

  const describe = (btn) => {
    const delay = parseFloat(btn.dataset.delay);
    const fb = parseFloat(btn.dataset.feedback);
    const repeats = Math.ceil(Math.log(0.01) / Math.log(fb));
    const gone = repeats * delay;
    return {
      delay, fb, repeats,
      text: `${btn.textContent}: the first echo comes back after ${Math.round(delay * 1000)} ms and is gone in about ${gone < 1 ? `${Math.round(gone * 1000)} ms` : `${gone.toFixed(1)} s`}.`,
    };
  };
  const showRead = () => { read.textContent = describe(current()).text; };

  radios.forEach((btn, i) => {
    btn.tabIndex = btn.getAttribute('aria-checked') === 'true' ? 0 : -1;
    btn.addEventListener('click', () => select(i));
    btn.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      const n = (i + keys[e.key] + radios.length) % radios.length;
      select(n); radios[n].focus();
    });
  });
  function select(i) {
    radios.forEach((b, j) => { b.setAttribute('aria-checked', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    showRead();
  }
  showRead();

  let ctx;
  const clap = () => {
    const info = describe(current());
    drawEcho(info);
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // A clap is a short burst of filtered noise.
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass'; band.frequency.value = 1400; band.Q.value = 0.8;

    const out = ctx.createGain(); out.gain.value = 0.9;
    const delay = ctx.createDelay(1.5); delay.delayTime.value = info.delay;
    const feedback = ctx.createGain(); feedback.gain.value = info.fb;
    const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = parseFloat(current().dataset.tone);
    const wet = ctx.createGain(); wet.gain.value = 0.8;

    src.connect(band);
    band.connect(out);
    band.connect(delay);
    delay.connect(damp); damp.connect(feedback); feedback.connect(delay);
    damp.connect(wet); wet.connect(out);
    out.connect(ctx.destination);
    src.start(now);
    const end = now + info.repeats * info.delay + 0.5;
    out.gain.setValueAtTime(0.9, end - 0.2);
    out.gain.linearRampToValueAtTime(0, end);
    setTimeout(() => { out.disconnect(); }, (end - now) * 1000 + 100);
  };

  // The echo drawn as type: each return smaller, arriving at its own time.
  function drawEcho(info) {
    echoRow.textContent = '';
    const n = Math.min(info.repeats, 9);
    for (let i = 0; i <= n; i++) {
      const s = document.createElement('span');
      s.textContent = 'clap';
      s.style.fontSize = `${Math.max(0.875, 2.25 * Math.pow(0.8, i))}rem`;
      s.style.animationDelay = reduce ? '0ms' : `${Math.round(i * info.delay * 1000)}ms`;
      echoRow.appendChild(s);
    }
  }

  clapBtn.addEventListener('click', clap);
})();
