export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ok = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

/** Rough "this phone is weak" check used to start the 3D orb at lower quality. */
export function isLowPowerDevice() {
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  return (mem && mem <= 2) || (cores && cores <= 4) || false;
}
