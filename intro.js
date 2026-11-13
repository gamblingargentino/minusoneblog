/* Opening scene. The site author's 3D model (models/godzilla.glb) breaks out of a storm sea.
   While the start screen is up, the sea idles behind it. On start: the water bulges, he breaches
   in a burst of spray timed to sounds/emerge.mp3, water runs off him, then the roar (sounds/roar.mp3)
   drives the glow, lightning and camera before the shot crossfades into the hero photo. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* Loudness of sounds/roar.mp3, one value per 50 ms (normalised 0..1) */
const ENV = [0.35,0.76,1.00,0.82,0.55,0.60,0.57,0.95,0.44,0.39,0.44,0.36,0.42,0.32,0.43,0.48,0.57,0.65,0.78,0.68,0.76,0.85,0.67,0.94,0.81,0.75,0.74,0.77,0.81,0.61,0.70,0.55,0.44,0.52,0.34,0.34,0.42,0.43,0.38,0.43,0.36,0.33,0.41,0.34,0.40,0.40,0.40,0.29,0.28,0.27,0.31,0.39,0.32,0.28,0.39,0.43,0.37,0.41,0.42,0.39,0.44,0.43,0.43,0.49,0.44,0.49,0.44,0.39,0.46,0.38,0.45,0.40,0.38,0.43,0.42,0.42,0.43,0.39,0.45,0.45,0.45,0.45,0.42,0.45,0.43,0.50,0.41,0.36,0.36,0.31,0.37,0.37,0.41,0.47,0.33,0.40,0.41,0.35,0.32,0.42,0.41,0.40,0.69,0.64,0.67,0.79,0.53];
const loud = (t) => { if (t < 0) return 0; const i = t / 0.05, a = Math.floor(i); if (a >= ENV.length - 1) return 0; const f = i - a; return ENV[a] * (1 - f) + ENV[a + 1] * f; };

const curtain = document.getElementById('curtain');
const canvas = document.getElementById('stage');
const api = (window.intro = { state: 'loading', progress: 0, play: null, onchange: null });
const setState = (s) => { api.state = s; if (api.onchange) api.onchange(); };
const finish = () => { if (window.site) window.site.ready(); else document.documentElement.classList.add('ready'); };

if (curtain && canvas && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  run().catch((e) => { console.error('intro failed', e); setState('failed'); });
} else setState('failed');

function softSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

async function run() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const HAZE = new THREE.Color('#161c20');
  scene.fog = new THREE.FogExp2(HAZE, 0.015);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 600);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.08).texture;
  scene.environmentIntensity = 0.22;

  /* ---- Storm sky ---- */
  const skyU = { uTime: { value: 0 }, uFlash: { value: 0 } };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `
      varying vec3 vP; uniform float uTime; uniform float uFlash;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.02; a*=.5; } return v; }
      void main(){
        float y = clamp(vP.y, -0.1, 1.0);
        vec3 horizon = vec3(.075,.095,.11), top = vec3(.012,.016,.024);
        vec3 col = mix(horizon, top, smoothstep(0.0, 0.5, y));
        /* a pale break in the cloud low behind him, so the silhouette reads */
        col += vec3(.13,.16,.185) * exp(-pow(vP.x*3.2, 2.)) * exp(-pow((y-.12)*6., 2.)) * step(vP.z, 0.);
        vec2 uv = vP.xz / max(vP.y + .25, .08) * 1.4 + vec2(uTime*.03, uTime*.012);
        float c = fbm(uv) * smoothstep(-0.05, 0.25, y);
        col = mix(col, col*0.35, smoothstep(.4, .8, c));
        col += vec3(.55,.65,.75) * uFlash * smoothstep(.35,.75,c);
        gl_FragColor = vec4(col, 1.);
      }`
  })));

  /* ---- Sea: swell, a bulge before the breach, ring waves and foam after it ---- */
  const seaU = { uTime: { value: 0 }, uFog: { value: HAZE }, uBulge: { value: 0 }, uRing: { value: -1 }, uFoam: { value: 0 } };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 320, 400, 400), new THREE.ShaderMaterial({
    uniforms: seaU,
    vertexShader: `
      uniform float uTime, uBulge, uRing; varying vec3 vW; varying float vH; varying float vRing;
      float wave(vec2 p, vec2 d, float f, float s, float a){ return a * sin(dot(p,d)*f + uTime*s); }
      void main(){
        vec3 p = vec3(position.x, 0., -position.y);
        float hgt = wave(p.xz, vec2(1.,.2), .18, 1.1, .45) + wave(p.xz, vec2(-.3,1.), .27, 1.6, .25) + wave(p.xz, vec2(.7,.7), .6, 2.3, .08);
        float r = length(p.xz);
        hgt += uBulge * 2.6 * exp(-r*r*.035);
        float ring = 0.;
        if (uRing >= 0.) {
          for (int k = 0; k < 3; k++) {
            float tb = uRing - float(k) * .55; if (tb < 0.) continue;
            float front = 3. + tb * 9.;
            float pk = exp(-pow(r - front, 2.) * .09) * exp(-tb * .45);
            ring += pk; hgt += pk * 1.5 * sin((r - front) * 1.4);
          }
        }
        vRing = ring; p.y = hgt; vH = hgt;
        vec4 w = modelMatrix * vec4(p,1.); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uFog; uniform float uTime, uFoam; varying vec3 vW; varying float vH; varying float vRing;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1. - max(v.y, 0.), 3.);
        vec3 col = mix(vec3(.008,.013,.017), vec3(.085,.105,.12), fres);
        col += vec3(.3) * smoothstep(.7, 1.1, vH) * .2;
        /* foam: churned water around him and on the ring crests, broken up by noise */
        float r = length(vW.xz);
        float nz = n(vW.xz * .9 + uTime * .5) * .5 + n(vW.xz * 2.6 - uTime * .9) * .3 + n(vW.xz * 7. + uTime * 1.3) * .2;
        float churn = uFoam * exp(-r * r * .02);
        float foam = smoothstep(.5, .95, (churn * .9 + vRing * .8) * (.35 + nz * 1.3));
        foam *= .55 + .45 * n(vW.xz * 11. - uTime * 2.);
        col = mix(col, vec3(.42,.48,.52), foam * .8);
        float d = length(cameraPosition - vW);
        col = mix(col, uFog, 1. - exp(-pow(d*.015, 2.)));
        gl_FragColor = vec4(col, 1.);
      }`
  }));
  scene.add(sea);

  /* ---- Lighting: dim overcast fill, a hard cool key from front-left, two rims from behind to carve the outline ---- */
  scene.add(new THREE.HemisphereLight('#7f909c', '#0c1013', 0.4));
  const key = new THREE.DirectionalLight('#cfd9e0', 2.0);
  key.position.set(-14, 22, 18); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -15, right: 15, top: 25, bottom: -5, near: 1, far: 90 }); key.shadow.bias = -0.0008;
  scene.add(key);
  const rimA = new THREE.DirectionalLight('#bcd4ea', 4.2); rimA.position.set(12, 14, -22); scene.add(rimA);
  const rimB = new THREE.DirectionalLight('#8fb3d6', 2.4); rimB.position.set(-16, 9, -16); scene.add(rimB);
  const atomic = [new THREE.PointLight('#4fb4ff', 0, 5.5, 2), new THREE.PointLight('#4fb4ff', 0, 5.5, 2), new THREE.PointLight('#7fd0ff', 0, 6, 2)];
  atomic.forEach((l) => scene.add(l));
  const bolt = new THREE.DirectionalLight('#cfe3ff', 0); bolt.position.set(20, 40, -30); scene.add(bolt);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.6, 0.82);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  resize(); addEventListener('resize', resize);

  /* ---- Rain and standing mist (always on) ---- */
  const sprite = softSprite();
  const MIST = 140, mp = new Float32Array(MIST * 3);
  for (let i = 0; i < MIST; i++) { mp[i * 3] = (Math.random() - 0.5) * 70; mp[i * 3 + 1] = Math.random() * 6; mp[i * 3 + 2] = (Math.random() - 0.5) * 50 - 5; }
  const mistGeo = new THREE.BufferGeometry(); mistGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  scene.add(new THREE.Points(mistGeo, new THREE.PointsMaterial({ map: sprite, size: 16, color: '#39444b', transparent: true, opacity: 0.14, depthWrite: false })));
  const RAIN = 1400, rp = new Float32Array(RAIN * 6);
  const resetDrop = (i, top) => { const x = (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 50 + 5, y = top ? 30 + Math.random() * 10 : Math.random() * 40; rp.set([x, y, z, x - 0.15, y - 1.1, z], i * 6); };
  for (let i = 0; i < RAIN; i++) resetDrop(i, false);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  scene.add(new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#8fa0ab', transparent: true, opacity: 0.2 })));

  const H = 14, lerp = THREE.MathUtils.lerp;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const camA = new THREE.Vector3(0, 2.6, 44), lookA = new THREE.Vector3(0, H * 0.48, 0);
  camera.position.copy(camA); camera.lookAt(lookA);

  /* Idle loop behind the start screen: just the storm */
  const clock = new THREE.Clock();
  let mode = 'idle', raf = 0;
  const weather = (dt, t) => {
    skyU.uTime.value = t; seaU.uTime.value = t;
    for (let i = 0; i < RAIN; i++) { const o = i * 6; rp[o + 1] -= 38 * dt; rp[o + 4] -= 38 * dt; rp[o] -= 4 * dt; rp[o + 3] -= 4 * dt; if (rp[o + 4] < 0) resetDrop(i, true); }
    rainGeo.attributes.position.needsUpdate = true;
  };
  const idle = () => { if (mode !== 'idle') return; if (window.introSkipped || document.documentElement.classList.contains('ready')) { mode = 'done'; renderer.dispose(); return; } const dt = Math.min(clock.getDelta(), 0.05); weather(dt, clock.elapsedTime); camera.position.x = Math.sin(clock.elapsedTime * 0.2) * 0.6; camera.lookAt(lookA); composer.render(); raf = requestAnimationFrame(idle); };
  curtain.classList.add('live'); raf = requestAnimationFrame(idle);

  /* ---- Load the model ---- */
  const gltf = await new Promise((res, rej) => new GLTFLoader().load('models/godzilla.glb', res,
    (e) => { if (e.total) { api.progress = e.loaded / e.total; if (api.onchange) api.onchange(); } }, rej));

  const model = gltf.scene;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const m = o.material; if (!m) return;
    /* Wet rock, not chrome */
    m.metalness = 0; m.metalnessMap = null; m.roughness = 0.68;
    if ('clearcoat' in m) { m.clearcoat = 0.25; m.clearcoatRoughness = 0.4; }
    if ('specularIntensity' in m) m.specularIntensity = 0.35;
    m.envMapIntensity = 0.7; if (m.color) m.color.multiplyScalar(0.9);
    m.needsUpdate = true;
  });
  const mixer = new THREE.AnimationMixer(model);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  mixer.setTime(0.01); model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  model.scale.setScalar(H / box.getSize(new THREE.Vector3()).y); model.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(model, true); const c2 = b2.getCenter(new THREE.Vector3());
  model.position.x -= c2.x; model.position.z -= c2.z; model.position.y -= b2.min.y;
  const holder = new THREE.Group(); holder.add(model); holder.position.y = -H * 1.1; scene.add(holder);
  const bone = (n) => { let f = null; model.traverse((o) => { if (!f && o.name && o.name.startsWith(n)) f = o; }); return f; };
  const headB = bone('headJA'), glowBones = [bone('spineJD'), bone('spineJF'), bone('neckJB')];
  const headP = new THREE.Vector3(), tmp = new THREE.Vector3(), camB = new THREE.Vector3(), lookB = new THREE.Vector3(), camP = new THREE.Vector3(), look = new THREE.Vector3();
  renderer.compile(scene, camera);

  /* ---- Emerging water effects ---- */
  /* 1. Spray: heavy burst at the breach, then thrown off as he keeps rising */
  const SPRAY = 5200, sp = new Float32Array(SPRAY * 3), sv = new Float32Array(SPRAY * 3), sl = new Float32Array(SPRAY);
  for (let i = 0; i < SPRAY; i++) sp[i * 3 + 1] = -99;
  const sprayGeo = new THREE.BufferGeometry(); sprayGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sprayPts = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ map: sprite, size: 0.75, color: '#cfd9e0', transparent: true, opacity: 0.6, depthWrite: false })); sprayPts.frustumCulled = false; scene.add(sprayPts);
  let sprayCursor = 0;
  const emitSpray = (count, up, out) => { for (let n = 0; n < count; n++) { const i = sprayCursor = (sprayCursor + 1) % SPRAY;
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 3.5;
    sp[i * 3] = Math.cos(a) * r; sp[i * 3 + 1] = Math.random() * 1.2; sp[i * 3 + 2] = Math.sin(a) * r * 0.85;
    const o = out * (0.4 + Math.random()); sv[i * 3] = Math.cos(a) * o; sv[i * 3 + 1] = up * (0.45 + Math.random() * 0.75); sv[i * 3 + 2] = Math.sin(a) * o;
    sl[i] = 1.2 + Math.random() * 1.4; } };
  /* 2. Mist cloud thrown up by the breach */
  const PUFF = 90, pp = new Float32Array(PUFF * 3), pv = new Float32Array(PUFF * 3);
  for (let i = 0; i < PUFF; i++) pp[i * 3 + 1] = -99;
  const puffGeo = new THREE.BufferGeometry(); puffGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const puffMat = new THREE.PointsMaterial({ map: sprite, size: 13, color: '#8f9da6', transparent: true, opacity: 0, depthWrite: false });
  const puffPts = new THREE.Points(puffGeo, puffMat); puffPts.frustumCulled = false; scene.add(puffPts);
  /* 3. Run-off: water streaming down off the body */
  const RUN = 900, rn = new Float32Array(RUN * 6), rnv = new Float32Array(RUN), rnl = new Float32Array(RUN);
  for (let i = 0; i < RUN; i++) { rn[i * 6 + 1] = -99; rn[i * 6 + 4] = -99; }
  const runGeo = new THREE.BufferGeometry(); runGeo.setAttribute('position', new THREE.BufferAttribute(rn, 3));
  const runLines = new THREE.LineSegments(runGeo, new THREE.LineBasicMaterial({ color: '#c3ced6', transparent: true, opacity: 0.55 })); runLines.frustumCulled = false; scene.add(runLines);
  let runCursor = 0;
  const emitRun = (count, topY) => { for (let n = 0; n < count; n++) { const i = runCursor = (runCursor + 1) % RUN, o = i * 6;
    const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 2.6, y = Math.random() * Math.max(1, topY);
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9; rn.set([x, y, z, x, y - 0.9, z], o); rnv[i] = 2 + Math.random() * 4; rnl[i] = 1; } };

  /* ---- Timeline, in seconds from the start button ----
     0.00  emerge sound starts; the sea swells into a dome
     0.75  breach (the sound's peak): burst of spray, mist cloud, first ring wave
     0.75–3.4  he rises; water streams off him, rings spread, foam churns
     3.60  roar starts as the jaw opens; glow and lightning follow its loudness
     8.60  the roar's last hit lands on the crossfade into the hero photo */
  const BREACH = 0.75, UP = 3.4, ROAR_AT = 3.6, END_AT = 8.6;
  const clipTime = (t, rt) => {
    if (rt < 0) return 1.3 * sm(0, ROAR_AT, t);
    if (rt < 0.2) return 1.3 + (rt / 0.2) * 0.3;
    if (rt < 5.0) return 1.6 + ((rt - 0.2) / 4.8) * 1.7;
    return 3.3 + Math.min(1, (rt - 5.0) / 0.8);
  };
  const roar = document.getElementById('roar'), emerge = document.getElementById('emerge');
  const fadeOut = (a) => { if (!a || a.paused) return; const v0 = a.volume, t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 700); a.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(step); else { a.pause(); a.volume = v0; } };
    requestAnimationFrame(step); };

  let tx = 0, ty = 0;
  addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; });
  let T0 = 0, breached = false, roared = false, lastBolt = -9, prevLoud = 0, prevY = 0;

  const play = () => {
    if (mode !== 'idle') return; mode = 'play'; cancelAnimationFrame(raf);
    T0 = clock.elapsedTime; clock.getDelta();
    if (emerge) { try { emerge.currentTime = 0; } catch (e) {} emerge.play().catch(() => {}); }
    requestAnimationFrame(tick);
  };
  const end = (skipped) => { mode = 'done'; if (skipped) { fadeOut(roar); fadeOut(emerge); } setTimeout(() => renderer.dispose(), 1800); };

  const tick = () => {
    if (mode !== 'play') return;
    if (window.introSkipped) { end(true); return; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime - T0, rt = t - ROAR_AT;
    weather(dt, clock.elapsedTime);
    mixer.setTime(clipTime(t, rt));

    /* The sea reacts */
    seaU.uBulge.value = sm(0, BREACH, t) * (1 - sm(BREACH, BREACH + 0.7, t));
    seaU.uRing.value = t >= BREACH ? t - BREACH : -1;
    seaU.uFoam.value = sm(0.3, BREACH + 0.4, t) * (1 - sm(UP + 0.5, END_AT, t) * 0.7);

    /* He rises: slow at first, fast through the surface, settling at full height */
    const k = Math.min(1, Math.max(0, (t - 0.55) / (UP - 0.55))), e = 1 - Math.pow(1 - k, 3);
    holder.position.y = -H * 0.95 * (1 - e);
    const speed = (holder.position.y - prevY) / Math.max(dt, 0.001); prevY = holder.position.y;
    holder.rotation.y += (tx * 0.15 - holder.rotation.y) * 0.04;
    const topY = holder.position.y + H;

    /* Breach burst */
    if (!breached && t >= BREACH) { breached = true; lastBolt = t; emitSpray(3000, 17, 8);
      for (let i = 0; i < PUFF; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 4; pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = Math.random() * 2; pp[i * 3 + 2] = Math.sin(a) * r;
        pv[i * 3] = Math.cos(a) * (2 + Math.random() * 5); pv[i * 3 + 1] = 2 + Math.random() * 7; pv[i * 3 + 2] = Math.sin(a) * (2 + Math.random() * 5); } }
    if (breached) {
      /* spray thrown off in proportion to how fast he is moving, plus the roar's hits */
      emitSpray(Math.round(Math.max(0, speed) * 5 + (loud(rt) > 0.85 ? 10 : 0)), 8 + speed * 0.5, 5);
      emitRun(Math.round((1 - sm(UP, UP + 2.2, t)) * 26), topY);
      puffMat.opacity = 0.34 * Math.exp(-(t - BREACH) * 0.5);
      for (let i = 0; i < PUFF; i++) { pp[i * 3] += pv[i * 3] * dt; pp[i * 3 + 1] += pv[i * 3 + 1] * dt; pp[i * 3 + 2] += pv[i * 3 + 2] * dt; pv[i * 3 + 1] *= 0.985; }
      puffGeo.attributes.position.needsUpdate = true;
    }
    for (let i = 0; i < SPRAY; i++) { if (sl[i] <= 0) continue; sl[i] -= dt; sv[i * 3 + 1] -= 16 * dt;
      sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt;
      if (sl[i] <= 0 || sp[i * 3 + 1] < -0.5) { sl[i] = 0; sp[i * 3 + 1] = -99; } }
    sprayGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < RUN; i++) { if (rnl[i] <= 0) continue; const o = i * 6; rnv[i] += 18 * dt; const d = rnv[i] * dt; rn[o + 1] -= d; rn[o + 4] -= d;
      if (rn[o + 4] < 0) { rnl[i] = 0; rn[o + 1] = -99; rn[o + 4] = -99; } }
    runGeo.attributes.position.needsUpdate = true;

    /* Roar: sound starts with the jaw; glow, bloom and lightning follow its loudness */
    if (!roared && rt >= 0) { roared = true; if (roar) { try { roar.currentTime = 0; } catch (err) {} roar.play().catch(() => {}); } }
    const L = loud(rt), glow = rt > 0 ? L : 0;
    holder.updateMatrixWorld(true);
    glowBones.forEach((bn, i) => { if (!bn) return; bn.getWorldPosition(tmp); atomic[i].position.set(tmp.x, tmp.y + 0.8, tmp.z - 4.2); atomic[i].intensity = glow * (70 + i * 25); });
    bloom.strength = 0.3 + glow * 0.9;
    if (rt > 0 && L > 0.9 && prevLoud <= 0.9 && t - lastBolt > 0.6) lastBolt = t;
    prevLoud = L;
    const flash = Math.max(0, 1 - (t - lastBolt) / 0.35) * (Math.random() > 0.3 ? 1 : 0.4);
    bolt.intensity = flash * 6; skyU.uFlash.value = flash;

    /* Camera: low and wide for the breach, then lands on the hero photo's framing */
    if (headB) headB.getWorldPosition(headP); else headP.set(0, H * 0.9, 1);
    camB.set(headP.x - 5.5, headP.y - 4.2, headP.z + 17); lookB.set(headP.x - 2.4, headP.y - 1.6, headP.z);
    const c = sm(ROAR_AT - 0.3, END_AT - 1.2, t);
    camP.lerpVectors(camA, camB, c); look.lerpVectors(lookA, lookB, c);
    camP.z -= sm(0, UP, t) * 4 * (1 - c);
    camP.x += (Math.sin(clock.elapsedTime * 0.2) * 0.6 + tx * 0.8) * (1 - c); camP.y += -ty * 0.6 * (1 - c);
    camera.position.copy(camP); camera.lookAt(look);
    camera.fov = lerp(34, 30, c); camera.updateProjectionMatrix();

    composer.render();
    if (t >= END_AT) { end(false); finish(); return; }
    requestAnimationFrame(tick);
  };

  api.play = play; api.debug = { tick, set: (v) => { T0 = clock.elapsedTime - v; } };
  setState('ready');
}
