(() => {
  'use strict';

  const RECORDS = Object.freeze([
    { year: '2018', short: 'AMTI NMTC', title: 'Top 10% at the institution level in the Sub-Junior screening test', kind: 'Top 10% · Institution', image: 'assets/certificates/amti-nmtc-2018-top-10-percent.jpg', shape: 'standard' },
    { year: '2018', short: 'SOF IMO', title: 'Gold medal for performance excellence at the school level', kind: 'School-level gold medal', image: 'assets/certificates/sof-imo-2018-school-gold-medal.jpg', shape: 'square' },
    { year: '2020', short: 'IOQM', title: 'Certificate of merit for placing within the top 300 ranks in Telangana', kind: 'Top 300 · Telangana', image: 'assets/certificates/ioqm-2020-top-300-telangana.png', shape: 'landscape' },
    { year: '2021–22', short: 'IOQM', title: 'Certificate of merit for scoring 20% or more in Part A', kind: 'Certificate of merit', image: 'assets/certificates/ioqm-2021-22-certificate-of-merit.png', shape: 'landscape' },
    { year: '2022–23', short: 'IOQM', title: 'Certificate of merit for scoring 20% or more of the total marks', kind: 'Certificate of merit', image: 'assets/certificates/ioqm-2022-23-certificate-of-merit.png', shape: 'landscape' }
  ]);

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function card(record, duplicate = false) {
    const media = record.image
      ? `<img src="${escapeHtml(record.image)}" alt="${escapeHtml(`${record.short}: ${record.title}`)}" loading="lazy" decoding="async">`
      : `<span class="certificate-placeholder-label">Certificate image pending</span><span class="certificate-mark" aria-hidden="true">${escapeHtml(record.mark)}</span><strong>${escapeHtml(record.short)}</strong><small>${escapeHtml(record.title)}</small>`;

    const classes = ['certificate-card'];
    if (record.image) classes.push('has-certificate-image');
    if (record.shape) classes.push(`certificate-card-${record.shape}`);
    return `<figure class="${classes.join(' ')}" ${duplicate ? 'aria-hidden="true"' : ''}><div class="certificate-paper">${media}</div><figcaption><span class="certificate-year">${escapeHtml(record.year)}</span><span class="certificate-kind">${escapeHtml(record.kind)}</span></figcaption></figure>`;
  }

  function markup() {
    const primary = RECORDS.map(record => card(record)).join('');
    const duplicate = RECORDS.map(record => card(record, true)).join('');
    return `<article class="item certificate-loop apple-bento-card" data-certificate-loop><div class="bento-spotlight" aria-hidden="true"></div><div class="certificate-loop-head"><div><h3>The journey,<br>documented.</h3></div><p class="certificate-loop-intro">Five records, from school competitions to three IOQM merit certificates.</p></div><div class="certificate-viewport" data-certificate-viewport tabindex="0" aria-label="Scrollable certificate archive"><div class="certificate-track" data-certificate-track><div class="certificate-set">${primary}</div><div class="certificate-set" aria-hidden="true">${duplicate}</div></div></div><div class="certificate-loop-foot"><span class="certificate-loop-help"><strong>Keep moving.</strong> Drag, scroll, or use the arrow keys.</span><div class="certificate-controls"><button class="certificate-control" type="button" data-certificate-previous aria-label="Previous certificate">←</button><button class="certificate-control" type="button" data-certificate-toggle aria-pressed="false">Pause</button><button class="certificate-control" type="button" data-certificate-next aria-label="Next certificate">→</button></div></div></article>`;
  }

  function mount(root) {
    if (!root) return () => {};
    const viewport = root.querySelector('[data-certificate-viewport]');
    const track = root.querySelector('[data-certificate-track]');
    const previous = root.querySelector('[data-certificate-previous]');
    const next = root.querySelector('[data-certificate-next]');
    const toggle = root.querySelector('[data-certificate-toggle]');
    if (!viewport || !track) return () => {};

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let lastTime = 0;
    let manualPause = reduced;
    let interactionPause = false;
    let visible = true;

    const halfWidth = () => track.scrollWidth / 2;
    const normalize = () => {
      const half = halfWidth();
      if (!half) return;
      if (viewport.scrollLeft >= half) viewport.scrollLeft -= half;
    };
    const tick = time => {
      const elapsed = Math.min(48, time - (lastTime || time));
      lastTime = time;
      if (!manualPause && !interactionPause && visible && !document.hidden) {
        viewport.scrollLeft += elapsed * 0.032;
        normalize();
      }
      frame = requestAnimationFrame(tick);
    };
    const cardStep = () => {
      const card = track.querySelector('.certificate-card');
      const set = track.querySelector('.certificate-set');
      const gap = parseFloat(getComputedStyle(set).gap) || 16;
      return (card?.getBoundingClientRect().width || 290) + gap;
    };
    const move = direction => {
      interactionPause = true;
      const half = halfWidth();
      if (direction < 0 && viewport.scrollLeft < cardStep() && half) viewport.scrollLeft += half;
      viewport.scrollBy({ left: cardStep() * direction, behavior: reduced ? 'auto' : 'smooth' });
      window.setTimeout(() => { interactionPause = false; normalize(); }, reduced ? 0 : 520);
    };
    const setInteraction = value => {
      interactionPause = value;
      lastTime = performance.now();
    };
    const onKeydown = event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    };
    const onVisibility = () => { lastTime = performance.now(); };

    previous?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    toggle?.addEventListener('click', () => {
      manualPause = !manualPause;
      toggle.textContent = manualPause ? 'Play' : 'Pause';
      toggle.setAttribute('aria-pressed', String(manualPause));
      lastTime = performance.now();
    });
    viewport.addEventListener('keydown', onKeydown);
    viewport.addEventListener('pointerdown', () => setInteraction(true), { passive: true });
    viewport.addEventListener('pointerup', () => setInteraction(false), { passive: true });
    viewport.addEventListener('pointercancel', () => setInteraction(false), { passive: true });
    viewport.addEventListener('mouseenter', () => setInteraction(true), { passive: true });
    viewport.addEventListener('mouseleave', () => setInteraction(false), { passive: true });
    viewport.addEventListener('focusin', () => setInteraction(true));
    viewport.addEventListener('focusout', () => setInteraction(false));
    viewport.addEventListener('scroll', normalize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      lastTime = performance.now();
    }, { threshold: 0.2 }) : null;
    observer?.observe(root);

    if (reduced && toggle) {
      toggle.textContent = 'Motion off';
      toggle.disabled = true;
      toggle.setAttribute('aria-pressed', 'true');
    }
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  window.CertificateLoop = { markup, mount };
})();
