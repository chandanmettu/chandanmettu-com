(() => {
  'use strict';

  const RESULTS = Object.freeze([
    { finish: 'gold', date: '10 Feb 2026', meet: 'AIRO 2026', venue: 'Mahindra University', event: '4×400m relay' },
    { finish: 'silver', date: '10 Feb 2026', meet: 'AIRO 2026', venue: 'Mahindra University', event: '100m' },
    { finish: 'bronze', date: '10 Feb 2026', meet: 'AIRO 2026', venue: 'Mahindra University', event: '200m' },
    { finish: 'bronze', date: '10 Feb 2026', meet: 'AIRO 2026', venue: 'Mahindra University', event: '4×100m relay' },
    { finish: 'gold', date: '4 Mar 2025', meet: 'Infinity Cup', venue: 'Woxsen University', event: 'Long jump' },
    { finish: 'gold', date: '4 Mar 2025', meet: 'Infinity Cup', venue: 'Woxsen University', event: '4×100m relay' },
    { finish: 'silver', date: '4 Mar 2025', meet: 'Infinity Cup', venue: 'Woxsen University', event: '100m' },
    { finish: 'gold', date: '13 Feb 2025', meet: 'AIRO 2025', venue: 'Mahindra University', event: '4×100m relay' },
    { finish: 'gold', date: '13 Feb 2025', meet: 'AIRO 2025', venue: 'Mahindra University', event: '4×200m relay' },
    { finish: 'gold', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: 'Long jump' },
    { finish: 'gold', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: 'Men’s relay' },
    { finish: 'silver', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: 'Mixed relay' },
    { finish: 'silver', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: '200m' },
    { finish: 'bronze', date: '2025', meet: 'Diesta', venue: 'IIT Hyderabad', event: '100m' },
    { finish: 'silver', date: '2024', meet: 'Milan', venue: 'IIT Hyderabad', event: 'Long jump' },
    { finish: 'silver', date: '2024', meet: 'Milan', venue: 'IIT Hyderabad', event: 'Relay' }
  ]);

  const finishLabel = value => value.charAt(0).toUpperCase() + value.slice(1);
  const padded = value => String(value).padStart(2, '0');
  const yearFrom = value => String(value).match(/\b20\d{2}\b/)?.[0] || '';
  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function medalMarkup(item, index) {
    const place = item.finish === 'gold' ? '1' : item.finish === 'silver' ? '2' : '3';
    const label = `${finishLabel(item.finish)} medal, ${item.event}, ${item.meet}, ${item.date}`;
    return `
      <li class="medal-rack-item" role="listitem">
        <button class="medal-object is-${item.finish}" type="button" data-medal-index="${index}" aria-label="${escapeHtml(label)}" aria-pressed="${index === 0}">
          <span class="medal-hook" aria-hidden="true"></span>
          <span class="medal-ribbon" aria-hidden="true"><i></i><i></i></span>
          <span class="medal-disc" aria-hidden="true">
            <span class="medal-place">${place}</span>
            <span class="medal-year">${escapeHtml(yearFrom(item.date))}</span>
          </span>
          <span class="medal-sequence" aria-hidden="true">${padded(index + 1)}</span>
        </button>
      </li>
    `;
  }

  function markup() {
    const counts = RESULTS.reduce((total, result) => {
      total[result.finish] += 1;
      return total;
    }, { gold: 0, silver: 0, bronze: 0 });
    const meetCount = new Set(RESULTS.map(result => result.meet)).size;

    return `
      <article class="item medal-cabinet apple-bento-card" data-medal-cabinet data-active-finish="gold">
        <div class="bento-spotlight" aria-hidden="true"></div>
        <header class="medal-cabinet-head">
          <div class="medal-cabinet-copy">
            <span class="medal-cabinet-kicker">Competition record</span>
            <h3>The medal rack.</h3>
          </div>
          <p class="medal-cabinet-summary"><strong>${RESULTS.length}</strong> finishes across <strong>${meetCount}</strong> meets <span>${counts.gold} gold · ${counts.silver} silver · ${counts.bronze} bronze</span></p>
        </header>

        <div class="medal-rack-shell">
          <div class="medal-rack-toolbar">
            <span>One rack · every finish</span>
            <span>Hover, focus, or select a medal</span>
          </div>
          <div class="medal-rack-scroll" data-medal-rack tabindex="0" aria-label="Medal rack. Drag sideways or use the arrow keys to explore all sixteen results.">
            <ol class="medal-rack" role="list">
              ${RESULTS.map(medalMarkup).join('')}
            </ol>
          </div>
          <div class="medal-detail" data-medal-detail role="status" aria-live="polite">
            <span class="medal-detail-index" data-medal-detail-index></span>
            <div class="medal-detail-result">
              <span class="medal-detail-finish" data-medal-detail-finish></span>
              <strong data-medal-detail-title></strong>
              <span class="medal-detail-meta" data-medal-detail-meta></span>
            </div>
            <div class="medal-rack-controls" aria-label="Move through the medal rack">
              <button type="button" data-medal-previous aria-label="Previous medal">←</button>
              <button type="button" data-medal-next aria-label="Next medal">→</button>
            </div>
          </div>
        </div>

        <details class="medal-ledger">
          <summary>Competition ledger <span>Dates · meets · events · finishes</span></summary>
          <div class="medal-ledger-wrap">
            <table>
              <thead><tr><th>Date</th><th>Meet</th><th>Event</th><th>Finish</th></tr></thead>
              <tbody data-medal-ledger></tbody>
            </table>
          </div>
        </details>
      </article>
    `;
  }

  function mount(root) {
    if (!root) return () => {};

    const rackViewport = root.querySelector('[data-medal-rack]');
    const medalButtons = [...root.querySelectorAll('[data-medal-index]')];
    const detailIndex = root.querySelector('[data-medal-detail-index]');
    const detailFinish = root.querySelector('[data-medal-detail-finish]');
    const detailTitle = root.querySelector('[data-medal-detail-title]');
    const detailMeta = root.querySelector('[data-medal-detail-meta]');
    const previous = root.querySelector('[data-medal-previous]');
    const next = root.querySelector('[data-medal-next]');
    const tbody = root.querySelector('[data-medal-ledger]');
    if (!rackViewport || !medalButtons.length || !tbody) return () => {};

    RESULTS.forEach(item => {
      const row = document.createElement('tr');
      [item.date, `${item.meet} · ${item.venue}`, item.event, finishLabel(item.finish)].forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let selectedIndex = 0;
    let previewIndex = null;
    let drag = null;
    let suppressClick = false;
    let inertiaFrame = 0;

    function renderDetail(index) {
      const item = RESULTS[index];
      if (!item) return;
      root.dataset.activeFinish = item.finish;
      detailIndex.textContent = `${padded(index + 1)} / ${padded(RESULTS.length)}`;
      detailFinish.textContent = `${finishLabel(item.finish)} · ${item.date}`;
      detailTitle.textContent = item.event;
      detailMeta.textContent = `${item.meet} · ${item.venue}`;
      medalButtons.forEach((button, buttonIndex) => {
        button.classList.toggle('is-current', buttonIndex === index);
        button.setAttribute('aria-pressed', String(buttonIndex === selectedIndex));
      });
    }

    function scrollToMedal(index) {
      const button = medalButtons[index];
      if (!button) return;
      const item = button.closest('.medal-rack-item');
      const target = item.offsetLeft + item.offsetWidth / 2 - rackViewport.clientWidth / 2;
      rackViewport.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' });
    }

    function selectMedal(index, moveFocus = false) {
      selectedIndex = (index + RESULTS.length) % RESULTS.length;
      previewIndex = null;
      renderDetail(selectedIndex);
      scrollToMedal(selectedIndex);
      if (moveFocus) medalButtons[selectedIndex].focus({ preventScroll: true });
    }

    function stopInertia() {
      cancelAnimationFrame(inertiaFrame);
      inertiaFrame = 0;
    }

    function startInertia(velocity) {
      if (reduced || Math.abs(velocity) < .2) return;
      stopInertia();
      let speed = velocity;
      const coast = () => {
        rackViewport.scrollLeft -= speed * 16;
        speed *= .91;
        if (Math.abs(speed) > .08) inertiaFrame = requestAnimationFrame(coast);
      };
      inertiaFrame = requestAnimationFrame(coast);
    }

    const onPointerOver = event => {
      if (drag?.moved) return;
      const button = event.target.closest('[data-medal-index]');
      if (!button || event.pointerType === 'touch') return;
      previewIndex = Number(button.dataset.medalIndex);
      renderDetail(previewIndex);
    };

    const onPointerLeave = () => {
      previewIndex = null;
      renderDetail(selectedIndex);
    };

    const onFocusIn = event => {
      const button = event.target.closest('[data-medal-index]');
      if (!button) return;
      previewIndex = Number(button.dataset.medalIndex);
      renderDetail(previewIndex);
    };

    const onFocusOut = event => {
      if (rackViewport.contains(event.relatedTarget)) return;
      previewIndex = null;
      renderDetail(selectedIndex);
    };

    const onClick = event => {
      const button = event.target.closest('[data-medal-index]');
      if (!button) return;
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      selectMedal(Number(button.dataset.medalIndex));
    };

    const onKeydown = event => {
      const index = previewIndex ?? selectedIndex;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        selectMedal(index + (event.key === 'ArrowRight' ? 1 : -1), true);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        selectMedal(event.key === 'Home' ? 0 : RESULTS.length - 1, true);
      }
    };

    const onPointerDown = event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      stopInertia();
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startScroll: rackViewport.scrollLeft,
        lastX: event.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
        moved: false
      };
      rackViewport.setPointerCapture(event.pointerId);
    };

    const onPointerMove = event => {
      if (!drag || drag.id !== event.pointerId) return;
      const distance = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(distance) < 6) return;
      drag.moved = true;
      rackViewport.classList.add('is-dragging');
      rackViewport.scrollLeft = drag.startScroll - distance;
      const elapsed = Math.max(8, event.timeStamp - drag.lastTime);
      drag.velocity = (event.clientX - drag.lastX) / elapsed;
      drag.lastX = event.clientX;
      drag.lastTime = event.timeStamp;
    };

    const endDrag = event => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      const velocity = drag.velocity;
      drag = null;
      rackViewport.classList.remove('is-dragging');
      if (rackViewport.hasPointerCapture(event.pointerId)) rackViewport.releasePointerCapture(event.pointerId);
      if (moved) {
        suppressClick = true;
        startInertia(velocity);
        window.setTimeout(() => { suppressClick = false; }, 0);
      }
    };

    rackViewport.addEventListener('pointerover', onPointerOver);
    rackViewport.addEventListener('pointerleave', onPointerLeave);
    rackViewport.addEventListener('focusin', onFocusIn);
    rackViewport.addEventListener('focusout', onFocusOut);
    rackViewport.addEventListener('click', onClick);
    rackViewport.addEventListener('keydown', onKeydown);
    rackViewport.addEventListener('pointerdown', onPointerDown);
    rackViewport.addEventListener('pointermove', onPointerMove);
    rackViewport.addEventListener('pointerup', endDrag);
    rackViewport.addEventListener('pointercancel', endDrag);
    previous?.addEventListener('click', () => selectMedal(selectedIndex - 1));
    next?.addEventListener('click', () => selectMedal(selectedIndex + 1));

    renderDetail(selectedIndex);

    return () => {
      stopInertia();
      rackViewport.removeEventListener('pointerover', onPointerOver);
      rackViewport.removeEventListener('pointerleave', onPointerLeave);
      rackViewport.removeEventListener('focusin', onFocusIn);
      rackViewport.removeEventListener('focusout', onFocusOut);
      rackViewport.removeEventListener('click', onClick);
      rackViewport.removeEventListener('keydown', onKeydown);
      rackViewport.removeEventListener('pointerdown', onPointerDown);
      rackViewport.removeEventListener('pointermove', onPointerMove);
      rackViewport.removeEventListener('pointerup', endDrag);
      rackViewport.removeEventListener('pointercancel', endDrag);
    };
  }

  window.MedalCabinet = { markup, mount, results: RESULTS };
})();
