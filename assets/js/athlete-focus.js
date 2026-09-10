(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const eventMedia = Object.freeze({
    'AIRO 2026': [
      {src:'assets/personas/athlete-airo-2026-seated.jpg',alt:'Chandan Mettu seated on the field with his AIRO 2026 trophies and medals',position:'center 44%'},
      {src:'assets/personas/athlete-airo-2026-trophies.jpg',alt:'Chandan Mettu holding two trophies at AIRO 2026',position:'center 40%'}
    ],
    'Infinity Cup': [
      {src:'assets/personas/athlete-woxsen-2025-medals.jpg',alt:'Chandan Mettu wearing his Infinity Cup 2025 medals at Woxsen University',position:'center 38%'},
      {src:'assets/personas/athlete-woxsen-2025-podium.jpg',alt:'Chandan Mettu on the long-jump podium at Woxsen University in 2025',position:'center 56%'}
    ],
    'AIRO 2025': [
      {src:'assets/personas/athlete-relay-exchange.jpg',alt:'Chandan Mettu accelerating with the relay baton at AIRO 2025',position:'center 48%'},
      {src:'assets/personas/athlete-airo-2025-team.jpg',alt:'Chandan Mettu with the IIT Hyderabad athletics team after AIRO 2025',position:'center 48%'}
    ],
    Diesta: [
      {src:'assets/personas/athlete-diesta-2025.jpg',alt:'Chandan Mettu wearing five medals from Diesta 2025',position:'center',fit:'contain'}
    ],
    Milan: [
      {src:'assets/personas/athlete-milan-2024.jpg',alt:'Chandan Mettu holding two medals from Milan 2024',position:'center',fit:'contain'}
    ]
  });

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const finishLabel = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
  const readableEvent = value => String(value || '').replace(/(\d)m\b/g, '$1 m');
  const padded = value => String(value).padStart(2, '0');

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
          media: eventMedia[result.meet] || []
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

  function mediaMarkup(event, photoIndex) {
    const item = event.media[photoIndex];
    if (!item) return '';
    const contained = item.fit === 'contain';
    const frameClass = contained ? 'athlete-focus-photo-frame is-contained' : 'athlete-focus-photo-frame';
    const backdrop = contained ? `;--event-image:url('${escapeHtml(item.src)}')` : '';
    return `<figure class="${frameClass}" style="${backdrop}"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt || `${event.name} competition photograph`)}" loading="lazy" decoding="async" style="--event-position:${escapeHtml(item.position || 'center')}"></figure>`;
  }

  function markup() {
    const events = eventsFromResults();
    if (!events.length) return '';

    const choices = events.map((event, index) => `
      <button class="athlete-event-choice" type="button" data-athlete-event="${index}" aria-pressed="${index === 0}">
        <span class="athlete-event-number">${padded(index + 1)}</span>
        <span class="athlete-event-name"><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.count)}</small></span>
      </button>
    `).join('');

    return `
      <section class="item athlete-focus apple-bento-card" data-athlete-focus aria-labelledby="athlete-focus-title">
        <div class="bento-spotlight" aria-hidden="true"></div>
        <header class="athlete-focus-head">
          <span class="athlete-focus-kicker">Competition archive</span>
          <h3 id="athlete-focus-title">Meet by meet.</h3>
        </header>
        <nav class="athlete-event-list" data-athlete-event-list aria-label="Choose an athletics meet">${choices}</nav>
        <article class="athlete-focus-stage" data-athlete-focus-stage>
          <div class="athlete-focus-visual" data-athlete-focus-visual tabindex="0">
            <div class="athlete-focus-media" data-athlete-focus-media></div>
            <div class="athlete-focus-photo-controls" data-athlete-photo-controls hidden>
              <span data-athlete-photo-count></span>
              <div>
                <button class="athlete-focus-arrow" type="button" data-athlete-photo-prev aria-label="Previous photograph from this meet">←</button>
                <button class="athlete-focus-arrow" type="button" data-athlete-photo-next aria-label="Next photograph from this meet">→</button>
              </div>
            </div>
          </div>
          <div class="athlete-focus-detail" aria-live="polite">
            <span class="athlete-focus-photo-note" data-athlete-photo-note hidden>Photography coming next</span>
            <div class="athlete-focus-topline"><span data-athlete-focus-venue></span><span data-athlete-focus-count></span></div>
            <h4 data-athlete-focus-name></h4>
            <p data-athlete-focus-results></p>
          </div>
        </article>
      </section>
    `;
  }

  function mount(root) {
    if (!root) return () => {};
    const events = eventsFromResults();
    const stage = root.querySelector('[data-athlete-focus-stage]');
    const visual = root.querySelector('[data-athlete-focus-visual]');
    const media = root.querySelector('[data-athlete-focus-media]');
    const name = root.querySelector('[data-athlete-focus-name]');
    const venue = root.querySelector('[data-athlete-focus-venue]');
    const count = root.querySelector('[data-athlete-focus-count]');
    const results = root.querySelector('[data-athlete-focus-results]');
    const note = root.querySelector('[data-athlete-photo-note]');
    const photoControls = root.querySelector('[data-athlete-photo-controls]');
    const photoCount = root.querySelector('[data-athlete-photo-count]');
    const photoPrevious = root.querySelector('[data-athlete-photo-prev]');
    const photoNext = root.querySelector('[data-athlete-photo-next]');
    const list = root.querySelector('[data-athlete-event-list]');
    if (!events.length || !stage || !visual || !media || !list) return () => {};

    let eventIndex = 0;
    let photoIndex = 0;
    let timer = 0;
    let pointerStart = null;

    const render = () => {
      const event = events[eventIndex];
      const photoTotal = event.media.length;
      photoIndex = photoTotal ? (photoIndex + photoTotal) % photoTotal : 0;
      media.innerHTML = mediaMarkup(event, photoIndex);
      name.textContent = event.name;
      venue.textContent = event.venue;
      count.textContent = event.count;
      results.textContent = event.resultLine;
      stage.classList.toggle('is-photo-pending', !photoTotal);
      note.hidden = Boolean(photoTotal);
      photoControls.hidden = photoTotal <= 1;
      photoCount.textContent = photoTotal ? `${padded(photoIndex + 1)} / ${padded(photoTotal)}` : '';
      visual.tabIndex = photoTotal > 1 ? 0 : -1;
      visual.setAttribute('aria-label', photoTotal > 1
        ? `${event.name}, photograph ${photoIndex + 1} of ${photoTotal}. Use the left and right arrow keys for more photographs.`
        : `${event.name} competition photograph`);
      list.querySelectorAll('[data-athlete-event]').forEach((button, buttonIndex) => {
        button.setAttribute('aria-pressed', String(buttonIndex === eventIndex));
      });
      visual.classList.remove('is-switching');
    };
    const transition = callback => {
      window.clearTimeout(timer);
      if (!reducedMotion.matches) visual.classList.add('is-switching');
      timer = window.setTimeout(() => {
        callback();
        render();
      }, reducedMotion.matches ? 0 : 130);
    };
    const showEvent = requested => transition(() => {
      eventIndex = (requested + events.length) % events.length;
      photoIndex = 0;
    });
    const showPhoto = direction => {
      const photoTotal = events[eventIndex].media.length;
      if (photoTotal <= 1) return;
      transition(() => { photoIndex = (photoIndex + direction + photoTotal) % photoTotal; });
    };
    const onListClick = event => {
      const choice = event.target.closest('[data-athlete-event]');
      if (choice) showEvent(Number(choice.dataset.athleteEvent));
    };
    const onPhotoPrevious = () => showPhoto(-1);
    const onPhotoNext = () => showPhoto(1);
    const onKeydown = event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      showPhoto(event.key === 'ArrowRight' ? 1 : -1);
    };
    const onPointerDown = event => { pointerStart = {id:event.pointerId,x:event.clientX}; };
    const onPointerUp = event => {
      if (!pointerStart || pointerStart.id !== event.pointerId) return;
      const distance = event.clientX - pointerStart.x;
      pointerStart = null;
      if (Math.abs(distance) >= 48) showPhoto(distance < 0 ? 1 : -1);
    };
    const onPointerCancel = () => { pointerStart = null; };

    list.addEventListener('click', onListClick);
    photoPrevious?.addEventListener('click', onPhotoPrevious);
    photoNext?.addEventListener('click', onPhotoNext);
    visual.addEventListener('keydown', onKeydown);
    visual.addEventListener('pointerdown', onPointerDown, {passive:true});
    visual.addEventListener('pointerup', onPointerUp, {passive:true});
    visual.addEventListener('pointercancel', onPointerCancel, {passive:true});
    render();

    return () => {
      window.clearTimeout(timer);
      list.removeEventListener('click', onListClick);
      photoPrevious?.removeEventListener('click', onPhotoPrevious);
      photoNext?.removeEventListener('click', onPhotoNext);
      visual.removeEventListener('keydown', onKeydown);
      visual.removeEventListener('pointerdown', onPointerDown);
      visual.removeEventListener('pointerup', onPointerUp);
      visual.removeEventListener('pointercancel', onPointerCancel);
    };
  }

  window.AthleteFocus = { markup, mount };
})();
