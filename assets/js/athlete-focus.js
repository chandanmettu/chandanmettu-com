(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const eventMedia = Object.freeze({
    'AIRO 2026': {
      src: 'assets/personas/athlete-medals.jpg',
      alt: 'Chandan Mettu on the track after competition'
    }
  });

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const finishLabel = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
  const readableEvent = value => String(value || '').replace(/(\d)m\b/g, '$1 m');

  function eventsFromResults() {
    const results = window.MedalCabinet?.results || [];
    const grouped = new Map();

    results.forEach(result => {
      if (!grouped.has(result.meet)) {
        const year = String(result.date || '').match(/\b(20\d{2})\b/)?.[1] || '';
        grouped.set(result.meet, {
          key: result.meet,
          name: /\b20\d{2}\b/.test(result.meet) ? result.meet : `${result.meet}${year ? ` ${year}` : ''}`,
          year,
          venue: result.venue || '',
          results: [],
          media: eventMedia[result.meet]
        });
      }
      grouped.get(result.meet).results.push(`${readableEvent(result.event)} ${finishLabel(result.finish)}`);
    });

    return [...grouped.values()].map(event => ({
      ...event,
      count: `${event.results.length} ${event.results.length === 1 ? 'medal' : 'medals'}`,
      resultLine: event.results.join(' · ')
    }));
  }

  function placeholder(event) {
    return `<div class="athlete-focus-placeholder" aria-hidden="true"><span>Competition archive</span><strong>${escapeHtml(event.name)}</strong><small>Photography coming next</small></div>`;
  }

  function mediaMarkup(event) {
    if (!event.media?.src) return placeholder(event);
    const src = escapeHtml(event.media.src);
    const alt = escapeHtml(event.media.alt || `${event.name} competition photograph`);
    return `<img class="athlete-focus-wash" src="${src}" alt="" loading="lazy" aria-hidden="true"><img class="athlete-focus-photo" src="${src}" alt="${alt}" loading="lazy">`;
  }

  function markup() {
    const events = eventsFromResults();
    if (!events.length) return '';

    const choices = events.map((event, index) => `
      <button class="athlete-event-choice" type="button" data-athlete-event="${index}" aria-pressed="${index === 0}">
        <span class="athlete-event-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="athlete-event-name"><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.venue)}</small></span>
        <span class="athlete-event-count">${escapeHtml(event.count)}</span>
      </button>
    `).join('');

    return `
      <section class="item athlete-focus apple-bento-card" data-athlete-focus aria-labelledby="athlete-focus-title">
        <div class="bento-spotlight" aria-hidden="true"></div>
        <header class="athlete-focus-head">
          <div>
            <span class="athlete-focus-kicker">Competition archive</span>
            <h3 id="athlete-focus-title">One frame.<br>Every meet.</h3>
          </div>
          <p>Choose a meet to bring its photograph and results into focus.</p>
        </header>
        <div class="athlete-focus-layout">
          <article class="athlete-focus-stage" data-athlete-focus-stage tabindex="0" aria-label="Selected athletics meet. Use the left and right arrow keys to change meets.">
            <div class="athlete-focus-media" data-athlete-focus-media></div>
            <div class="athlete-focus-arrows">
              <button class="athlete-focus-arrow" type="button" data-athlete-focus-prev aria-label="Previous athletics meet">←</button>
              <button class="athlete-focus-arrow" type="button" data-athlete-focus-next aria-label="Next athletics meet">→</button>
            </div>
            <div class="athlete-focus-detail" aria-live="polite">
              <div class="athlete-focus-topline"><span data-athlete-focus-year></span><span data-athlete-focus-count></span></div>
              <h4 data-athlete-focus-name></h4>
              <p data-athlete-focus-results></p>
            </div>
          </article>
          <nav class="athlete-event-list" data-athlete-event-list aria-label="Choose an athletics meet">${choices}</nav>
        </div>
      </section>
    `;
  }

  function mount(root) {
    if (!root) return () => {};
    const events = eventsFromResults();
    const stage = root.querySelector('[data-athlete-focus-stage]');
    const media = root.querySelector('[data-athlete-focus-media]');
    const name = root.querySelector('[data-athlete-focus-name]');
    const year = root.querySelector('[data-athlete-focus-year]');
    const count = root.querySelector('[data-athlete-focus-count]');
    const results = root.querySelector('[data-athlete-focus-results]');
    const list = root.querySelector('[data-athlete-event-list]');
    const previous = root.querySelector('[data-athlete-focus-prev]');
    const next = root.querySelector('[data-athlete-focus-next]');
    if (!events.length || !stage || !media || !list) return () => {};

    let index = 0;
    let timer = 0;
    let pointerStart = null;

    const update = requested => {
      index = (requested + events.length) % events.length;
      const event = events[index];
      media.innerHTML = mediaMarkup(event);
      name.textContent = event.name;
      year.textContent = event.year;
      count.textContent = event.count;
      results.textContent = event.resultLine;
      list.querySelectorAll('[data-athlete-event]').forEach((button, buttonIndex) => {
        button.setAttribute('aria-pressed', String(buttonIndex === index));
      });
      stage.classList.remove('is-switching');
    };
    const show = (requested, animate = true) => {
      window.clearTimeout(timer);
      if (animate && !reducedMotion.matches) stage.classList.add('is-switching');
      timer = window.setTimeout(() => update(requested), animate && !reducedMotion.matches ? 145 : 0);
    };
    const onListClick = event => {
      const choice = event.target.closest('[data-athlete-event]');
      if (choice) show(Number(choice.dataset.athleteEvent));
    };
    const onPrevious = () => show(index - 1);
    const onNext = () => show(index + 1);
    const onKeydown = event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
    };
    const onPointerDown = event => {
      pointerStart = { id: event.pointerId, x: event.clientX };
    };
    const onPointerUp = event => {
      if (!pointerStart || pointerStart.id !== event.pointerId) return;
      const distance = event.clientX - pointerStart.x;
      pointerStart = null;
      if (Math.abs(distance) >= 48) show(index + (distance < 0 ? 1 : -1));
    };
    const onPointerCancel = () => { pointerStart = null; };

    list.addEventListener('click', onListClick);
    previous?.addEventListener('click', onPrevious);
    next?.addEventListener('click', onNext);
    stage.addEventListener('keydown', onKeydown);
    stage.addEventListener('pointerdown', onPointerDown, { passive: true });
    stage.addEventListener('pointerup', onPointerUp, { passive: true });
    stage.addEventListener('pointercancel', onPointerCancel, { passive: true });
    show(0, false);

    return () => {
      window.clearTimeout(timer);
      list.removeEventListener('click', onListClick);
      previous?.removeEventListener('click', onPrevious);
      next?.removeEventListener('click', onNext);
      stage.removeEventListener('keydown', onKeydown);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerCancel);
    };
  }

  window.AthleteFocus = { markup, mount };
})();
