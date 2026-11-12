/* Opening: the site author's 3D model (models/godzilla.glb) rises out of a storm sea.
   Glow, lightning and camera follow the roar's loudness curve, then the shot lands on the
   hero photo's angle and crossfades into it. */
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
const loadEl = document.getElementById('stage-load');
const finish = () => (window.siteReady ? window.siteReady() : document.documentElement.classList.add('ready'));

if (curtain && canvas && !window.introSkipped && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  run().catch((e) => { console.error('intro failed', e); finish(); });
}

function softSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

async function run() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { finish(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const HAZE = new THREE.Color('#2b343a');
  scene.fog = new THREE.FogExp2(HAZE, 0.016);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 600);

  /* Soft image light, low: overcast storm, no chrome */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.08).texture;
  scene.environmentIntensity = 0.25;

  /* ---- Storm sky: gradient dome with drifting clouds ---- */
  const skyU = { uTime: { value: 0 }, uFlash: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), new THREE.ShaderMaterial({
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
        vec3 horizon = vec3(.17,.2,.22), top = vec3(.035,.045,.06);
        vec3 col = mix(horizon, top, smoothstep(0.0, 0.55, y));
        vec2 uv = vP.xz / max(vP.y + .25, .08) * 1.4 + vec2(uTime*.03, uTime*.012);
        float c = fbm(uv) * smoothstep(-0.05, 0.25, y);
        col = mix(col, col*0.45, smoothstep(.45, .8, c));
        col += vec3(.55,.65,.75) * uFlash * smoothstep(.35,.75,c);
        gl_FragColor = vec4(col, 1.);
      }`
  }));
  scene.add(sky);

  /* ---- Sea: rolling swell, dark water with a sky-coloured fresnel sheen ---- */
  const seaU = { uTime: { value: 0 }, uFog: { value: HAZE }, uRise: { value: 0 } };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 500, 220, 220), new THREE.ShaderMaterial({
    uniforms: seaU,
    vertexShader: `
      uniform float uTime; uniform float uRise; varying vec3 vW; varying float vH;
      float wave(vec2 p, vec2 d, float f, float s, float a){ return a * sin(dot(p,d)*f + uTime*s); }
      void main(){
        vec3 p = position.xzy; p.z = -position.y; p.y = 0.;
        float hgt = wave(p.xz, vec2(1.,.2), .18, 1.1, .45) + wave(p.xz, vec2(-.3,1.), .27, 1.6, .25) + wave(p.xz, vec2(.7,.7), .6, 2.3, .08);
        float r = length(p.xz);
        hgt += uRise * 1.6 * exp(-r*r*.012) * sin(r*.9 - uTime*4.);
        p.y = hgt; vH = hgt;
        vec4 w = modelMatrix * vec4(p,1.); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uFog; varying vec3 vW; varying float vH;
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1. - max(v.y, 0.), 3.);
        vec3 col = mix(vec3(.018,.026,.032), vec3(.17,.2,.22), fres);
        col += vec3(.6) * smoothstep(.6, 1.0, vH) * .25;
        float d = length(cameraPosition - vW);
        col = mix(col, uFog, 1. - exp(-pow(d*.016, 2.)));
        gl_FragColor = vec4(col, 1.);
      }`
  }));
  scene.add(sea);

  /* ---- Lights: overcast key, cool fill, blue atomic glow behind the back ---- */
  scene.add(new THREE.HemisphereLight('#a9b6bf', '#1a2024', 0.9));
  const key = new THREE.DirectionalLight('#c9d2d8', 1.5);
  key.position.set(-10, 25, 20); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -15, right: 15, top: 25, bottom: -5, near: 1, far: 80 }); key.shadow.bias = -0.0008;
  scene.add(key);
  const back = new THREE.DirectionalLight('#9fb3c2', 1.2); back.position.set(6, 12, -20); scene.add(back);
  const atomic = [new THREE.PointLight('#4fb4ff', 0, 5.5, 2), new THREE.PointLight('#4fb4ff', 0, 5.5, 2), new THREE.PointLight('#7fd0ff', 0, 6, 2)];
  atomic.forEach((l) => scene.add(l));
  const bolt = new THREE.DirectionalLight('#cfe3ff', 0); bolt.position.set(20, 40, -30); scene.add(bolt);

  /* ---- Post: bloom so the atomic glow and lightning bleed like film ---- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize(); addEventListener('resize', resize);

  /* ---- Load the model ---- */
  const gltf = await new Promise((res, rej) => new GLTFLoader().load('models/godzilla.glb', res,
    (e) => { if (loadEl && e.total) loadEl.textContent = `Chargement… ${Math.round((e.loaded / e.total) * 100)} %`; }, rej));
  if (window.introSkipped || document.documentElement.classList.contains('ready')) { renderer.dispose(); return; }
  if (loadEl) loadEl.remove();

  const model = gltf.scene;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const m = o.material; if (!m) return;
    /* Rough, wet-rock skin: kill the chrome */
    m.metalness = 0; m.metalnessMap = null;
    m.roughness = 0.82;
    if ('clearcoat' in m) { m.clearcoat = 0.08; m.clearcoatRoughness = 0.6; }
    if ('specularIntensity' in m) m.specularIntensity = 0.25;
    m.envMapIntensity = 0.6;
    m.color && m.color.multiplyScalar(0.85);
    m.needsUpdate = true;
  });

  const mixer = new THREE.AnimationMixer(model);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  mixer.update(0.01); model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const H = 14; model.scale.setScalar(H / box.getSize(new THREE.Vector3()).y);
  model.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(model, true); const c2 = b2.getCenter(new THREE.Vector3());
  model.position.x -= c2.x; model.position.z -= c2.z; model.position.y -= b2.min.y;
  const holder = new THREE.Group(); holder.add(model); scene.add(holder);
  /* Bones: the camera aims at the head, the atomic glow rides the spine from behind */
  const bone = (n) => { let f = null; model.traverse((o) => { if (!f && o.name && o.name.startsWith(n)) f = o; }); return f; };
  const headB = bone('headJA'), glowBones = [bone('spineJD'), bone('spineJF'), bone('neckJB')];
  const headP = new THREE.Vector3(), tmp = new THREE.Vector3(), fwd = new THREE.Vector3();

  /* ---- VFX: spray, mist, rain ---- */
  const sprite = softSprite();
  const SPRAY = 900, sp = new Float32Array(SPRAY * 3), sv = new Float32Array(SPRAY * 3), sl = new Float32Array(SPRAY);
  const sprayGeo = new THREE.BufferGeometry(); sprayGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ map: sprite, size: 2.6, color: '#c9d3d9', transparent: true, opacity: 0.22, depthWrite: false, sizeAttenuation: true }));
  scene.add(spray);
  const emit = (i, power) => {
    const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 3.5;
    sp[i * 3] = Math.cos(a) * r; sp[i * 3 + 1] = Math.random() * 1.5; sp[i * 3 + 2] = Math.sin(a) * r * 0.8;
    sv[i * 3] = Math.cos(a) * (2 + Math.random() * 4); sv[i * 3 + 1] = (6 + Math.random() * 10) * power; sv[i * 3 + 2] = Math.sin(a) * (2 + Math.random() * 4);
    sl[i] = 1 + Math.random() * 1.2;
  };
  for (let i = 0; i < SPRAY; i++) { sl[i] = 0; sp[i * 3 + 1] = -99; }

  const MIST = 140, mp = new Float32Array(MIST * 3);
  for (let i = 0; i < MIST; i++) { mp[i * 3] = (Math.random() - 0.5) * 70; mp[i * 3 + 1] = Math.random() * 6; mp[i * 3 + 2] = (Math.random() - 0.5) * 50 - 5; }
  const mistGeo = new THREE.BufferGeometry(); mistGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  scene.add(new THREE.Points(mistGeo, new THREE.PointsMaterial({ map: sprite, size: 16, color: '#4f5b62', transparent: true, opacity: 0.16, depthWrite: false })));

  const RAIN = 1400, rp = new Float32Array(RAIN * 6);
  const resetDrop = (i, top) => { const x = (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 50 + 5, y = top ? 30 + Math.random() * 10 : Math.random() * 40;
    rp.set([x, y, z, x - 0.15, y - 1.1, z], i * 6); };
  for (let i = 0; i < RAIN; i++) resetDrop(i, false);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  scene.add(new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#9fb0bb', transparent: true, opacity: 0.28 })));

  /* ---- Timeline (seconds from the moment the model is ready) ----
     0.0–2.4  rises out of the sea through spray, wide low shot
     2.4      roar starts (audio t = 0); glow, lightning and camera follow its loudness
     2.4–6.0  camera settles on the hero photo's angle: low, front, head right of centre
     6.2      crossfade into the hero photo */
  const ROAR_AT = 2.4, END_AT = 6.2;
  const audio = document.getElementById('roar');
  let roared = false;
  /* If autoplay was blocked, a tap starts the roar at the right offset so it stays in sync */
  curtain.addEventListener('pointerdown', () => {
    const into = clock.elapsedTime - ROAR_AT;
    if (audio && audio.paused && into > 0 && into < 5) { try { audio.currentTime = into; } catch (e) {} audio.play().catch(() => {}); }
  });

  let tx = 0, ty = 0;
  addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; });

  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = THREE.MathUtils.lerp;
  const camA = new THREE.Vector3(0, 3, 46), camB = new THREE.Vector3();
  const lookA = new THREE.Vector3(0, H * 0.5, 0), lookB = new THREE.Vector3();
  const camP = new THREE.Vector3(), look = new THREE.Vector3();
  const clock = new THREE.Clock();
  let ended = false, lastBolt = -9, prevLoud = 0;

  const tick = () => {
    if (ended) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    mixer.update(dt);
    skyU.uTime.value = t; seaU.uTime.value = t;

    /* Rise out of the water */
    const rise = sm(0, 2.6, t);
    holder.position.y = -H * 0.8 * (1 - rise);
    seaU.uRise.value = Math.max(0, 1 - Math.abs(t - 1.2) / 1.6);
    holder.rotation.y += (tx * 0.18 - holder.rotation.y) * 0.04;

    /* Spray bursts while he breaks the surface, again on the roar */
    const rt = t - ROAR_AT, L = loud(rt);
    const emitRate = (t < 2.6 ? 1 - t / 2.6 : 0) * 1 + (L > 0.85 ? 0.5 : 0);
    for (let i = 0; i < SPRAY; i++) {
      if (sl[i] <= 0) { if (Math.random() < emitRate * 0.05) emit(i, t < 2.6 ? 1 : 0.6); else continue; }
      sl[i] -= dt; sv[i * 3 + 1] -= 14 * dt;
      sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt;
      if (sl[i] <= 0 || sp[i * 3 + 1] < -1) { sl[i] = 0; sp[i * 3 + 1] = -99; }
    }
    sprayGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < RAIN; i++) { const o = i * 6; rp[o + 1] -= 38 * dt; rp[o + 4] -= 38 * dt; rp[o] -= 4 * dt; rp[o + 3] -= 4 * dt; if (rp[o + 4] < 0) resetDrop(i, true); }
    rainGeo.attributes.position.needsUpdate = true;

    /* Roar: start audio, drive the glow from its loudness */
    if (!roared && rt >= 0) { roared = true; if (audio) { try { audio.currentTime = 0; } catch (e) {} audio.play().catch(() => {}); } }
    const glow = rt > 0 ? L : 0;
    atomic.forEach((l, i) => { l.intensity = glow * (70 + i * 25); });
    bloom.strength = 0.35 + glow * 0.9;

    /* Lightning on the loud hits */
    if (rt > 0 && L > 0.9 && prevLoud <= 0.9 && t - lastBolt > 0.6) lastBolt = t;
    prevLoud = L;
    const flash = Math.max(0, 1 - (t - lastBolt) / 0.35) * (Math.random() > 0.3 ? 1 : 0.4);
    bolt.intensity = flash * 6; skyU.uFlash.value = flash;

    /* Glow lights sit just behind the spine bones */
    holder.updateMatrixWorld(true);
    glowBones.forEach((bn, i) => { if (!bn) return; bn.getWorldPosition(tmp); atomic[i].position.set(tmp.x, tmp.y + 0.8, tmp.z - 4.2); });
    /* Final framing like the hero photo: low, in front, head right of centre and a little above middle */
    if (headB) headB.getWorldPosition(headP); else headP.set(0, H * 0.9, 1);
    camB.set(headP.x - 5.5, headP.y - 4.2, headP.z + 17);
    lookB.set(headP.x - 2.4, headP.y - 1.6, headP.z);

    /* Camera: wide and low, then lands on the hero photo's framing */
    const k = sm(ROAR_AT - 0.4, END_AT - 0.6, t);
    camP.lerpVectors(camA, camB, k); look.lerpVectors(lookA, lookB, k);
    camP.x += Math.sin(t * 0.3) * 0.4 * (1 - k) + tx * 0.8 * (1 - k);
    camP.y += -ty * 0.6 * (1 - k);
    camera.position.copy(camP); camera.lookAt(look);
    camera.fov = lerp(34, 30, k); camera.updateProjectionMatrix();

    composer.render();

    if (t >= END_AT) { ended = true; finish(); setTimeout(() => { renderer.dispose(); }, 1800); return; }
    if (window.introSkipped) { ended = true; setTimeout(() => renderer.dispose(), 1800); return; }
    requestAnimationFrame(tick);
  };
  curtain.classList.add('live');
  requestAnimationFrame(tick);
}
