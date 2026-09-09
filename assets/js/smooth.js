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

  reducedMotion.addEventListener?.('change', startEngine);
  precisePointer.addEventListener?.('change', startEngine);
  startEngine();
})();
