// WHAT: I-animate ang pagtaas ng isang numero hanggang makarating ang target.
// WHY: Ang stat cards sa About section ay dapat may buhay na pag-animasyon;
//      isang IntersectionObserver naman ang gumaganap kailan ito nagsisimula
//      (hindi humihintulot na mag-scroll-listener ang buong page).

import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// WHAT: Ang count-up ay nagsisimula lamang kapag isang IntersectionObserver
//       nakikita ang target (hal. ang grid ng stat cards). Kapag hindi pa
//       nakikita, mananatiling 0 hanggang ito ay isinilay. Kapag may
//       `prefers-reduced-motion` na setting, ipakita na agad ang final value.
export default function useCountUp(target, { containerRef = null } = {}) {
  const [value, setValue] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const numericTarget = target === null || target === undefined
      ? Number.NaN
      : Number(target);
    if (!Number.isFinite(numericTarget)) {
      // Hindi numero ang target (hal. "RA 11985") — ipakita kaagad, walang
      // animasyon kailangan.
      setValue(target === null || target === undefined ? null : target);
      return undefined;
    }

    if (prefersReducedMotion()) {
      setValue(numericTarget);
      return undefined;
    }

    let cancelled = false;
    const endValue = numericTarget;
    const startedAt = performance.now();

    const animate = () => {
      if (cancelled) {
        return;
      }
      const elapsed = (performance.now() - startedAt) / 1000;
      const progress = Math.min(1, elapsed);
      setValue(endValue * easeOutExpo(progress));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setValue(endValue);
      }
    };

    let observer = null;
    const node = containerRef && containerRef.current;
    if (node) {
      const onIntersect = ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          observer = null;
          animate();
        }
      };
      observer = new IntersectionObserver(onIntersect, { threshold: 0.35 });
      observer.observe(node);
    } else {
      animate();
    }

    return () => {
      cancelled = true;
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, [target, containerRef]);

  return value;
}
