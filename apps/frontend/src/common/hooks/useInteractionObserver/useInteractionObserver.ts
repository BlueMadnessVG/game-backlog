import { useEffect, useRef, useState } from 'react';

interface useInteractionObserverOptions extends IntersectionObserverInit {
  triggerOnce?: boolean;
}

/**
 * useInteractionObserver hook
 * Optimized for high-performance grids and tables by preventing observer churn.
 * * * Features:
 * - Persistent Options: Prevents re-attachment on every render.
 * - Generic Ref: Works with any HTML element.
 * - triggerOnce: Option to stop observing after the first intersection (ideal for lazy loading).
 *
 * @param {UseInteractionObserverOptions} options - Intersection Observer settings.
 *
 * @example
 * const { targetRef, isInteracting } = useInteractionObserver({ threshold: 0.1, triggerOnce: true });
 * * return <div ref={targetRef}>{isInteracting ? <HeavyComponent /> : <Placeholder />}</div>;
 */
export function useInteractionObserver<T extends HTMLElement = HTMLDivElement>({
  threshold,
  root,
  rootMargin,
  triggerOnce = false,
}: useInteractionObserverOptions = {}) {
  const [isInteracting, setIsInteracting] = useState(false);
  const targetRef = useRef<T | null>(null);

  const optionsRef = useRef({ threshold, root, rootMargin });

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      const isElementIntersecting = entry.isIntersecting;
      setIsInteracting(isElementIntersecting);

      if (isElementIntersecting && triggerOnce) {
        observer.unobserve(target);
      }
    }, optionsRef.current);

    return () => {
      observer.disconnect();
    };
  }, [triggerOnce]);

  return { targetRef, isInteracting };
}
