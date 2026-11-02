import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Look of each assistant state. Values are eased toward the target every frame.
const LOOKS = {
  idle: { speed: 0.35, amp: 0.1, spin: 0.15, a: '#22d3ee', b: '#7c5cff' },
  listening: { speed: 0.8, amp: 0.17, spin: 0.3, a: '#38bdf8', b: '#34d399' },
  thinking: { speed: 1.7, amp: 0.13, spin: 1.1, a: '#8b5cf6', b: '#6366f1' },
  speaking: { speed: 1.0, amp: 0.22, spin: 0.4, a: '#f472b6', b: '#8b5cf6' },
};

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const ORB_VERT = /* glsl */ `
uniform float uTime; uniform float uAmp;
varying vec3 vNormal; varying vec3 vView; varying float vNoise;
${NOISE}
void main(){
  float n = snoise(position*1.3 + vec3(0., uTime*.55, uTime*.3));
  float n2 = snoise(position*2.8 - vec3(uTime*.4));
  float d = n*uAmp + n2*uAmp*.3;
  vec3 p = position + normal*d;
  vNoise = n;
  vNormal = normalize(normalMatrix*normal);
  vec4 mv = modelViewMatrix*vec4(p,1.);
  vView = -mv.xyz;
  gl_Position = projectionMatrix*mv;
}`;

const ORB_FRAG = /* glsl */ `
uniform vec3 uA; uniform vec3 uB;
varying vec3 vNormal; varying vec3 vView; varying float vNoise;
void main(){
  vec3 N = normalize(vNormal); vec3 V = normalize(vView);
  float fres = pow(1. - max(dot(N,V), 0.), 2.4);
  float m = smoothstep(-.7, .8, vNoise);
  vec3 col = mix(uB, uA, m) * (.5 + .55*m);
  col += fres * mix(uA, vec3(1.), .4) * 1.15;
  gl_FragColor = vec4(col, .62 + fres*.38);
}`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uA; varying vec3 vNormal; varying vec3 vView;
void main(){
  float f = pow(max(dot(normalize(vNormal), normalize(vView)), 0.), 2.2);
  gl_FragColor = vec4(uA, f*.55);
}`;
const HALO_VERT = /* glsl */ `
varying vec3 vNormal; varying vec3 vView;
void main(){
  vNormal = normalize(normalMatrix*normal);
  vec4 mv = modelViewMatrix*vec4(position,1.);
  vView = -mv.xyz; gl_Position = projectionMatrix*mv;
}`;

const ease = (cur, target, dt, rate = 3) => cur + (target - cur) * Math.min(1, dt * rate);

function Scene({ stateRef, quality, isTouch, onSlow }) {
  const orb = useRef();
  const group = useRef();
  const halo = useRef();
  const ring1 = useRef();
  const ring2 = useRef();
  const points = useRef();
  const clock = useRef({ t: 0, frames: 0, acc: 0, warm: 0 });
  const look = useRef({ speed: 0.35, amp: 0.1, spin: 0.15, a: new THREE.Color(LOOKS.idle.a), b: new THREE.Color(LOOKS.idle.b) });
  const tilt = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const target = useMemo(() => ({ a: new THREE.Color(), b: new THREE.Color() }), []);

  const detail = quality === 0 ? (isTouch ? 14 : 22) : 7;
  const particleCount = quality === 0 ? (isTouch ? 320 : 800) : 140;

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uAmp: { value: 0.1 }, uA: { value: new THREE.Color(LOOKS.idle.a) }, uB: { value: new THREE.Color(LOOKS.idle.b) } }),
    []
  );
  const haloUniforms = useMemo(() => ({ uA: { value: new THREE.Color(LOOKS.idle.a) } }), []);

  const particleGeo = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const r = 1.55 + Math.random() * 0.9;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th);
      arr[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.8;
      arr[i * 3 + 2] = r * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [particleCount]);

  // Desktop only: gently tilt toward the pointer. Skipped on touch so scrolling is never affected.
  useEffect(() => {
    if (isTouch) return undefined;
    const onMove = (e) => {
      tilt.current.tx = (e.clientY / window.innerHeight - 0.5) * 0.5;
      tilt.current.ty = (e.clientX / window.innerWidth - 0.5) * 0.7;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [isTouch]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05); // never jump after a hiccup or tab switch
    const c = clock.current;
    const st = stateRef.current;
    const L = LOOKS[st] || LOOKS.idle;
    const cur = look.current;

    c.t += dt * cur.speed;
    cur.speed = ease(cur.speed, L.speed, dt);
    cur.amp = ease(cur.amp, L.amp, dt);
    cur.spin = ease(cur.spin, L.spin, dt);
    target.a.set(L.a);
    target.b.set(L.b);
    cur.a.lerp(target.a, Math.min(1, dt * 3));
    cur.b.lerp(target.b, Math.min(1, dt * 3));

    // Speech engines expose no audio levels, so simulate a natural voice envelope.
    const real = c.t / Math.max(cur.speed, 0.0001);
    let level = 0;
    if (st === 'speaking') level = 0.5 + 0.5 * Math.sin(real * 9.2) * Math.sin(real * 3.1 + 1.3);
    else if (st === 'listening') level = 0.25 + 0.25 * Math.sin(real * 3);
    const scale = 1 + Math.sin(real * 1.4) * 0.018 + level * 0.09;

    uniforms.uTime.value = c.t;
    uniforms.uAmp.value = cur.amp + level * 0.05;
    uniforms.uA.value.copy(cur.a);
    uniforms.uB.value.copy(cur.b);
    haloUniforms.uA.value.copy(cur.a);

    orb.current.scale.setScalar(scale);
    halo.current.scale.setScalar(1.28 + level * 0.08);
    orb.current.rotation.y += dt * cur.spin * 0.6;
    ring1.current.rotation.z += dt * cur.spin * 0.9;
    ring2.current.rotation.x -= dt * cur.spin * 0.7;
    points.current.rotation.y += dt * (0.05 + cur.spin * 0.12);

    const tl = tilt.current;
    tl.x = ease(tl.x, tl.tx, dt, 2);
    tl.y = ease(tl.y, tl.ty, dt, 2);
    group.current.rotation.x = tl.x;
    group.current.rotation.y = tl.y;

    // Performance watchdog: if frames are slow for ~1.5s on a phone, drop quality instead of stuttering.
    c.warm += rawDelta;
    if (c.warm > 1.5) {
      c.frames += 1;
      c.acc += rawDelta;
      if (c.frames >= 90) {
        if (c.acc / c.frames > 0.034) onSlow();
        c.frames = 0;
        c.acc = 0;
      }
    }
  });

  return (
    <group ref={group}>
      <mesh ref={orb}>
        <icosahedronGeometry args={[1, detail]} />
        <shaderMaterial vertexShader={ORB_VERT} fragmentShader={ORB_FRAG} uniforms={uniforms} transparent depthWrite={false} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[1, 32, 24]} />
        <shaderMaterial
          vertexShader={HALO_VERT}
          fragmentShader={HALO_FRAG}
          uniforms={haloUniforms}
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ring1} rotation={[1.2, 0, 0]}>
        <torusGeometry args={[1.45, 0.006, 6, 120]} />
        <meshBasicMaterial color="#a5b4fc" transparent opacity={0.45} />
      </mesh>
      <mesh ref={ring2} rotation={[0.3, 0.9, 0]}>
        <torusGeometry args={[1.7, 0.005, 6, 120]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.35} />
      </mesh>
      <points ref={points} geometry={particleGeo}>
        <pointsMaterial size={0.022} color="#c4b5fd" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}

/**
 * @param {{state:string, active:boolean, quality:number, isTouch:boolean, onReady:()=>void, onFail:()=>void, onSlow:()=>void}} props
 */
export default function OrbCanvas({ state, active, quality, isTouch, onReady, onFail, onSlow }) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const dpr = quality === 0 ? [1, isTouch ? 1.5 : 2] : 1;

  return (
    <Canvas
      className="orb-canvas"
      key={quality}
      frameloop={active ? 'always' : 'never'}
      dpr={dpr}
      camera={{ position: [0, 0, 4.4], fov: 45 }}
      gl={{ antialias: !isTouch && quality === 0, alpha: true, stencil: false, powerPreference: 'default' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onFail();
        });
        onReady();
      }}
      onError={onFail}
    >
      <Scene stateRef={stateRef} quality={quality} isTouch={isTouch} onSlow={onSlow} />
    </Canvas>
  );
}
