(() => {
  'use strict';

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function recordsFromItems(items) {
    return (Array.isArray(items) ? items : []).flatMap(item => {
      const slides = Array.isArray(item.slides) ? item.slides.filter(slide => slide?.src) : [];
      return slides.map(slide => ({
        title: item.name,
        label: item.meta,
        src: slide.src,
        alt: slide.alt || `${item.name} photograph`,
        kind: slide.type === 'video' || /\.(?:mp4|webm)(?:\?|$)/i.test(slide.src) ? 'video' : 'image',
        poster: slide.poster || '',
        position: slide.position || 'center',
        wide: Boolean(item.wide)
      }));
    });
  }

  function card(record, duplicate = false) {
    const media = record.kind === 'video'
      ? `<video src="${escapeHtml(record.src)}"${record.poster ? ` poster="${escapeHtml(record.poster)}"` : ''} muted loop playsinline preload="metadata" disablepictureinpicture ${duplicate ? 'aria-hidden="true" tabindex="-1"' : `aria-label="${escapeHtml(record.alt)}"`}></video>`
      : `<img src="${escapeHtml(record.src)}" alt="${duplicate ? '' : escapeHtml(record.alt)}" loading="lazy" decoding="async">`;
    return `<figure class="athlete-loop-card ${record.wide ? 'is-wide' : ''}" ${duplicate ? 'aria-hidden="true"' : ''} style="--athlete-position:${escapeHtml(record.position)}">${media}<figcaption><span>${escapeHtml(record.label)}</span><h3>${escapeHtml(record.title)}</h3></figcaption></figure>`;
  }

  function loopMarkup(items) {
    const records = recordsFromItems(items);
    if (!records.length) return '';
    const primary = records.map(record => card(record)).join('');
    const duplicate = records.map(record => card(record, true)).join('');
    return `<article class="item athlete-gallery-loop apple-bento-card" data-athlete-gallery-loop><div class="bento-spotlight" aria-hidden="true"></div><div class="athlete-loop-viewport" data-athlete-loop-viewport tabindex="0" aria-label="Scrollable photographs from sports and training"><div class="athlete-loop-track" data-athlete-loop-track><div class="athlete-loop-set">${primary}</div><div class="athlete-loop-set" aria-hidden="true">${duplicate}</div></div></div><div class="athlete-loop-controls"><button type="button" data-athlete-loop-previous aria-label="Previous photograph">←</button><button type="button" data-athlete-loop-toggle aria-pressed="false">Pause</button><button type="button" data-athlete-loop-next aria-label="Next photograph">→</button></div></article>`;
  }

  function mount(root) {
    if (!root) return () => {};
    const viewport = root.querySelector('[data-athlete-loop-viewport]');
    const track = root.querySelector('[data-athlete-loop-track]');
    const previous = root.querySelector('[data-athlete-loop-previous]');
    const next = root.querySelector('[data-athlete-loop-next]');
    const toggle = root.querySelector('[data-athlete-loop-toggle]');
    const videos = [...root.querySelectorAll('video')];
    if (!viewport || !track) return () => {};

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let lastTime = 0;
    let manualPause = reduced;
    let interactionPause = false;
    let visible = true;
    let resumeTimer = 0;

    const syncVideos = () => {
      videos.forEach(video => {
        const shouldPlay = !reduced && !manualPause && visible && !document.hidden && video.dataset.inView === 'true';
        if (shouldPlay) video.play().catch(() => {});
        else video.pause();
      });
    };

    const halfWidth = () => track.scrollWidth / 2;
    const normalize = () => {
      const half = halfWidth();
      if (!half) return;
      if (viewport.scrollLeft >= half) viewport.scrollLeft -= half;
      else if (viewport.scrollLeft < 0) viewport.scrollLeft += half;
    };
    const tick = time => {
      const elapsed = Math.min(48, time - (lastTime || time));
      lastTime = time;
      if (!manualPause && !interactionPause && visible && !document.hidden) {
        viewport.scrollLeft += elapsed * 0.038;
        normalize();
      }
      frame = requestAnimationFrame(tick);
    };
    const cardStep = () => {
      const card = track.querySelector('.athlete-loop-card');
      const set = track.querySelector('.athlete-loop-set');
      const gap = parseFloat(getComputedStyle(set).gap) || 18;
      return (card?.getBoundingClientRect().width || 520) + gap;
    };
    const setInteraction = value => {
      interactionPause = value;
      lastTime = performance.now();
    };
    const resumeSoon = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => setInteraction(false), reduced ? 0 : 560);
    };
    const move = direction => {
      setInteraction(true);
      const half = halfWidth();
      if (direction < 0 && viewport.scrollLeft < cardStep() && half) viewport.scrollLeft += half;
      viewport.scrollBy({ left: cardStep() * direction, behavior: reduced ? 'auto' : 'smooth' });
      resumeSoon();
    };
    const onPrevious = () => move(-1);
    const onNext = () => move(1);
    const onToggle = () => {
      manualPause = !manualPause;
      toggle.textContent = manualPause ? 'Play' : 'Pause';
      toggle.setAttribute('aria-pressed', String(manualPause));
      lastTime = performance.now();
      syncVideos();
    };
    const onKeydown = event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    };
    const onVisibility = () => {
      lastTime = performance.now();
      syncVideos();
    };
    const onPointerDown = () => setInteraction(true);
    const onPointerUp = () => resumeSoon();
    const onMouseEnter = () => setInteraction(true);
    const onMouseLeave = () => setInteraction(false);
    const onFocusIn = () => setInteraction(true);
    const onFocusOut = () => setInteraction(false);

    previous?.addEventListener('click', onPrevious);
    next?.addEventListener('click', onNext);
    toggle?.addEventListener('click', onToggle);
    viewport.addEventListener('keydown', onKeydown);
    viewport.addEventListener('pointerdown', onPointerDown, { passive: true });
    viewport.addEventListener('pointerup', onPointerUp, { passive: true });
    viewport.addEventListener('pointercancel', onPointerUp, { passive: true });
    viewport.addEventListener('mouseenter', onMouseEnter, { passive: true });
    viewport.addEventListener('mouseleave', onMouseLeave, { passive: true });
    viewport.addEventListener('focusin', onFocusIn);
    viewport.addEventListener('focusout', onFocusOut);
    viewport.addEventListener('scroll', normalize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      lastTime = performance.now();
      syncVideos();
    }, { threshold: 0.2 }) : null;
    observer?.observe(root);

    const videoObserver = videos.length && 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      entries.forEach(entry => { entry.target.dataset.inView = String(entry.isIntersecting); });
      syncVideos();
    }, { root: viewport, threshold: 0.35 }) : null;
    videos.forEach(video => videoObserver?.observe(video));

    if (reduced && toggle) {
      toggle.textContent = 'Motion off';
      toggle.disabled = true;
      toggle.setAttribute('aria-pressed', 'true');
    }
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(resumeTimer);
      observer?.disconnect();
      videoObserver?.disconnect();
      videos.forEach(video => video.pause());
      previous?.removeEventListener('click', onPrevious);
      next?.removeEventListener('click', onNext);
      toggle?.removeEventListener('click', onToggle);
      viewport.removeEventListener('keydown', onKeydown);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerUp);
      viewport.removeEventListener('mouseenter', onMouseEnter);
      viewport.removeEventListener('mouseleave', onMouseLeave);
      viewport.removeEventListener('focusin', onFocusIn);
      viewport.removeEventListener('focusout', onFocusOut);
      viewport.removeEventListener('scroll', normalize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  window.AthleteGallery = { loopMarkup, mount };
})();
