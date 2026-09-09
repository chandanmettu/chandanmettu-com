(() => {
  'use strict';

  const AUTOPLAY_DELAY = 6500;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const twoDigits = value => String(value).padStart(2, '0');

  function markup(item) {
    const slides = Array.isArray(item.slides) ? item.slides.filter(slide => slide && slide.src) : [];
    if (!slides.length) return '';

    const name = escapeHtml(item.name);
    const single = slides.length === 1;
    const slideMarkup = slides.map((slide, index) => {
      const src = escapeHtml(slide.src);
      const alt = escapeHtml(slide.alt || `${item.name} image ${index + 1}`);
      const position = escapeHtml(slide.position || 'center');
      return `<div class="athlete-gallery-slide ${index === 0 ? 'is-active' : ''}" data-gallery-slide aria-hidden="${index === 0 ? 'false' : 'true'}" style="--slide-position:${position}"><img class="athlete-gallery-backdrop" data-src="${src}" alt="" loading="lazy" decoding="async" aria-hidden="true"><img class="athlete-gallery-image" data-src="${src}" alt="${alt}" loading="lazy" decoding="async"></div>`;
    }).join('');
    const dots = slides.map((_, index) => `<button class="athlete-gallery-dot" type="button" data-gallery-dot="${index}" aria-label="Show ${name} image ${index + 1}" aria-pressed="${index === 0 ? 'true' : 'false'}"></button>`).join('');

    return `<article class="item photo-item athlete-gallery-card apple-bento-card ${item.wide ? 'wide' : ''}" data-athlete-gallery data-gallery-single="${single}" tabindex="0" aria-label="${name} image gallery"><div class="athlete-gallery-stage">${slideMarkup}</div><div class="bento-spotlight" aria-hidden="true"></div><div class="athlete-gallery-controls"><button class="athlete-gallery-arrow" type="button" data-gallery-prev aria-label="Previous ${name} image">←</button><span class="athlete-gallery-count" data-gallery-count aria-live="polite">01 / ${twoDigits(slides.length)}</span><button class="athlete-gallery-arrow" type="button" data-gallery-next aria-label="Next ${name} image">→</button></div><div class="athlete-gallery-dots" aria-label="Choose ${name} image">${dots}</div><div class="photo-copy"><h3>${name}</h3><p>${escapeHtml(item.copy)}</p><p class="item-meta">${escapeHtml(item.meta)}</p></div></article>`;
  }

  function mount(card) {
    const slides = [...card.querySelectorAll('[data-gallery-slide]')];
    const dots = [...card.querySelectorAll('[data-gallery-dot]')];
    const count = card.querySelector('[data-gallery-count]');
    const previous = card.querySelector('[data-gallery-prev]');
    const next = card.querySelector('[data-gallery-next]');
    if (!slides.length) return () => {};

    let index = 0;
    let timer = 0;
    let visible = true;
    let pointerStart = null;

    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const start = () => {
      stop();
      if (slides.length < 2 || reducedMotion.matches || !visible || document.hidden || card.matches(':hover') || card.contains(document.activeElement)) return;
      timer = window.setInterval(() => show(index + 1), AUTOPLAY_DELAY);
    };
    const show = requested => {
      index = (requested + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
      });
      dots.forEach((dot, dotIndex) => dot.setAttribute('aria-pressed', String(dotIndex === index)));
      if (count) count.textContent = `${twoDigits(index + 1)} / ${twoDigits(slides.length)}`;
    };
    const choose = requested => {
      show(requested);
      start();
    };
    const onVisibility = () => start();
    const onMotionChange = () => start();
    const onKeydown = event => {
      if (slides.length < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
      event.preventDefault();
      choose(index + (event.key === 'ArrowRight' ? 1 : -1));
    };
    const onPointerDown = event => {
      if (slides.length > 1) pointerStart = { id: event.pointerId, x: event.clientX };
    };
    const onPointerUp = event => {
      if (!pointerStart || pointerStart.id !== event.pointerId) return;
      const distance = event.clientX - pointerStart.x;
      pointerStart = null;
      if (Math.abs(distance) >= 44) choose(index + (distance < 0 ? 1 : -1));
    };

    previous?.addEventListener('click', () => choose(index - 1));
    next?.addEventListener('click', () => choose(index + 1));
    dots.forEach((dot, dotIndex) => dot.addEventListener('click', () => choose(dotIndex)));
    card.addEventListener('keydown', onKeydown);
    card.addEventListener('pointerdown', onPointerDown, { passive: true });
    card.addEventListener('pointerup', onPointerUp, { passive: true });
    card.addEventListener('pointercancel', () => { pointerStart = null; }, { passive: true });
    card.addEventListener('mouseenter', stop);
    card.addEventListener('mouseleave', start);
    card.addEventListener('focusin', stop);
    card.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener?.('change', onMotionChange);

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      start();
    }, { threshold: 0.35 }) : null;
    observer?.observe(card);
    start();

    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener?.('change', onMotionChange);
    };
  }

  function mountAll(root) {
    const cards = [...root.querySelectorAll('[data-athlete-gallery]')];
    const cleanups = new Map();
    let observer = null;

    const hydrate = card => {
      if (cleanups.has(card)) return;
      card.querySelectorAll('img[data-src]').forEach(image => {
        image.src = image.dataset.src;
        image.removeAttribute('data-src');
      });
      cleanups.set(card, mount(card));
      observer?.unobserve(card);
    };

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) hydrate(entry.target);
        });
      }, { rootMargin: '480px 0px', threshold: 0.01 });
      cards.forEach(card => observer.observe(card));
    } else {
      cards.forEach(hydrate);
    }

    return () => {
      observer?.disconnect();
      cleanups.forEach(cleanup => cleanup());
      cleanups.clear();
    };
  }

  window.AthleteGallery = { markup, mountAll };
})();
