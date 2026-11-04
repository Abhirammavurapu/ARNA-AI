import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { hasWebGL, isLowPowerDevice, isTouchDevice, prefersReducedMotion } from '../../utils/device.js';

const OrbCanvas = lazy(() => import('./OrbCanvas.jsx'));

/**
 * ARNA's 3D orb. Built to stay smooth on phones:
 *  - the heavy 3D code loads lazily, a lightweight CSS orb shows instantly meanwhile
 *  - pixel ratio is capped and quality drops automatically if frames get slow
 *  - rendering pauses when scrolled off-screen or the tab is hidden
 *  - falls back to the CSS orb if WebGL is missing or the GPU context is lost
 */
export default function Orb({ state = 'idle', className = '' }) {
  const wrapRef = useRef(null);
  const touch = useRef(isTouchDevice()).current;
  const [mode, setMode] = useState(() =>
    !isLowPowerDevice() && hasWebGL() && !prefersReducedMotion() ? 'webgl' : 'css'
  );
  const [ready, setReady] = useState(false);
  const [quality, setQuality] = useState(() => (isLowPowerDevice() ? 1 : 0));
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const qualityRef = useRef(quality);
  const onSlow = useCallback(() => {
    // First drop to low quality; if it is still slow, give up on WebGL.
    if (qualityRef.current === 0) {
      qualityRef.current = 1;
      setQuality(1);
    } else {
      setMode('css');
    }
  }, []);
  const onFail = useCallback(() => setMode('css'), []);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <div ref={wrapRef} className={`orb-wrap ${className}`} data-state={state}>
      <div className={`css-orb ${ready && mode === 'webgl' ? 'css-orb--hidden' : ''}`} aria-hidden="true">
        <span className="css-orb__glow" />
        <span className="css-orb__satellite css-orb__satellite--one" />
        <span className="css-orb__satellite css-orb__satellite--two" />
        <span className="css-orb__core" />
        <span className="css-orb__ring" />
      </div>
      {mode === 'webgl' && (
        <Suspense fallback={null}>
          <OrbCanvas
            state={state}
            active={onScreen && tabVisible}
            quality={quality}
            isTouch={touch}
            onReady={onReady}
            onFail={onFail}
            onSlow={onSlow}
          />
        </Suspense>
      )}
    </div>
  );
}
