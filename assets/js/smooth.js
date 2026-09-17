/* Smooth, restrained page motion adapted from the Abhyas interaction model. */
(() => {
  'use strict';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const precisePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let lenis = null;
  let animationFrame = 0;

  const stopEngine = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lenis?.destroy();
    lenis = null;
    window.__lenis = null;
  };

  const startEngine = () => {
    stopEngine();
    if (reducedMotion.matches || !precisePointer.matches || typeof window.Lenis === 'undefined') return;

    lenis = new window.Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.92,
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1,
      prevent: node => Boolean(node.closest?.('[data-lenis-prevent]'))
    });
    window.__lenis = lenis;

    const tick = time => {
      lenis.raf(time);
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
  };

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    const href = link?.getAttribute('href');
    if (!link || !href || href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    if (lenis) {
      lenis.scrollTo(target, {
        offset: href === '#top' ? 0 : -24,
        duration: 1.15,
        easing: t => 1 - Math.pow(1 - t, 4)
      });
    } else {
      target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }
    history.replaceState(null, '', href);
  });

  // The hero uses a custom curved profile wheel instead of native overflow.
  // Auto-rotation is only for the untouched landing state. As soon as the user
  // deliberately interacts with the wheel, their selected position becomes
  // authoritative for the rest of the page visit.
  const stage = document.getElementById('stage');
  if (stage) {
    const stopHeroAutoShowcase = () => window.stopAutoShowcase?.();

    stage.addEventListener('wheel', event => {
      if (event.ctrlKey || (!event.deltaX && !event.deltaY)) return;

      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const overPersona = Boolean(event.target.closest?.('.persona'));
      if (horizontalIntent || overPersona) stopHeroAutoShowcase();

      // Horizontal trackpad gestures are handled by the wheel code in index.html.
      if (horizontalIntent) return;
      if (!overPersona || !event.deltaY) return;
      if (typeof window.moveWheel !== 'function') return;

      event.preventDefault();
      event.stopPropagation();
      const delta = Math.max(-120, Math.min(120, event.deltaY));
      window.moveWheel(delta / 180, true, 'manual');
    }, { passive: false });

    stage.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      stopHeroAutoShowcase();
    }, { passive: true });

    stage.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') stopHeroAutoShowcase();
    });

    const modeHint = document.getElementById('modeHint');
    if (modeHint && !reducedMotion.matches) {
      modeHint.textContent = 'Scroll or drag the cards. Select one to explore.';
    }
  }

  reducedMotion.addEventListener?.('change', startEngine);
  precisePointer.addEventListener?.('change', startEngine);
  startEngine();
})();
