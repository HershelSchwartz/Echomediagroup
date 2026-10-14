// Ember & Salt — section entrances and the booking coupon.
(() => {
  document.documentElement.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Entrances: parts arrive in reading order, once.
  const items = document.querySelectorAll('[data-reveal], .postcard');
  items.forEach((el) => {
    if (el.dataset.reveal === 'list') [...el.children].forEach((k, i) => k.style.setProperty('--d', `${i * 70}ms`));
  });
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('is-in'));
  }

  // Booking: the total follows the guests; sending opens an email with everything filled in.
  const form = document.querySelector('[data-book]');
  if (!form) return;
  const PRICE = 58;
  const total = form.querySelector('[data-total]');
  const guests = form.querySelector('#b-guests');
  const night = form.querySelector('#b-night');
  const sitting = form.querySelector('#b-sitting');

  const update = () => {
    const n = Number(guests.value);
    total.textContent = `${n} ${n === 1 ? 'guest' : 'guests'}, ${night.value.split(' ')[0]} at ${sitting.value}: £${n * PRICE} for the set menu. Nothing to pay until the night.`;
  };
  [guests, night, sitting].forEach((el) => el.addEventListener('change', update));
  update();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const name = form.querySelector('#b-name').value.trim();
    const notes = form.querySelector('#b-notes').value.trim();
    const n = Number(guests.value);
    const subject = `Booking: ${n} on ${night.value}, ${sitting.value}`;
    const body = [
      'Hello Ember & Salt,',
      '',
      `I'd like to book a table for ${n} on ${night.value} at the ${sitting.value} sitting.`,
      notes ? `Notes: ${notes}` : 'No allergies or notes.',
      '',
      `Thank you,`,
      name,
    ].join('\n');
    location.href = `mailto:table@emberandsalt.co.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  // Phone: place the coupon's side notches on the perforation.
  const left = form.querySelector('.coupon-left');
  const placeCut = () => form.style.setProperty('--coupon-cut', `${left.offsetHeight}px`);
  addEventListener('resize', placeCut);
  placeCut();
})();
