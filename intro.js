/* Opening: the 3D model (models/godzilla.glb, supplied by the site's author) rises out of a dark sea,
   turns toward the cursor, roars as the camera pushes in, then the scene lifts away into the page. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const curtain = document.getElementById('curtain');
const canvas = document.getElementById('stage');
const loadEl = document.getElementById('stage-load');
const finish = () => (window.siteReady ? window.siteReady() : document.documentElement.classList.add('ready'));

if (curtain && canvas && !window.introSkipped && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  run().catch((e) => { console.error("intro failed", e); finish(); });
}

async function run() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { finish(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const sky = new THREE.Color('#0b1014');
  scene.background = sky;
  scene.fog = new THREE.FogExp2(sky, 0.011);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  /* Image-based light so the textured, metallic skin reads instead of going black */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  /* Lighting: soft storm fill, a cool key from the front-left, a strong blue rim from behind for the silhouette */
  scene.add(new THREE.HemisphereLight('#9fb4c4', '#0a0d10', 0.55));
  const key = new THREE.DirectionalLight('#dfe6ea', 2.8);
  key.position.set(-12, 22, 18); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 80;
  Object.assign(key.shadow.camera, { left: -20, right: 20, top: 25, bottom: -5 }); key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#6fb6ff', 4.5); rim.position.set(8, 14, -20); scene.add(rim);
  const rim2 = new THREE.DirectionalLight('#8fc8ff', 2.0); rim2.position.set(-14, 8, -14); scene.add(rim2);
  const glow = new THREE.PointLight('#5aa9ff', 0, 40, 1.6); scene.add(glow);

  /* Sea: a dark glossy plane that catches the light */
  const sea = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.ShadowMaterial({ opacity: 0.55 }));
  sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; scene.add(sea);

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize(); addEventListener('resize', resize);

  /* Load with progress */
  const gltf = await new Promise((res, rej) => new GLTFLoader().load('models/godzilla.glb', res,
    (e) => { if (loadEl && e.total) loadEl.textContent = `Chargement… ${Math.round((e.loaded / e.total) * 100)} %`; }, rej));
  if (window.introSkipped || document.documentElement.classList.contains('ready')) { renderer.dispose(); return; }
  if (loadEl) loadEl.remove();

  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const m = o.material; if (m && !m.metalnessMap) m.metalness = Math.min(m.metalness, 0.15);
      if (m && 'envMapIntensity' in m) m.envMapIntensity = 1;
    }
  });

  /* Size it: normalise to 14 units tall, feet on the sea, centred */
  const mixer = new THREE.AnimationMixer(model);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  mixer.update(0.01); model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  const s = 14 / size.y; model.scale.setScalar(s);
  model.updateMatrixWorld(true); const box2 = new THREE.Box3().setFromObject(model, true); const c = box2.getCenter(new THREE.Vector3());
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box2.min.y;
  const holder = new THREE.Group(); holder.add(model); scene.add(holder);
  const H = 14;


  /* Cursor: the head turns toward it, gently */
  let tx = 0, ty = 0;
  addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; });

  /* Camera path: low wide shot, then a push-in to the head on the roar */
  const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const easeIn = (t) => Math.pow(Math.min(1, Math.max(0, t)), 2.2);
  const flash = curtain.querySelector('.bite-flash');
  const clock = new THREE.Clock();
  const T_RISE = 2.2, T_ROAR = 2.6, T_PUSH = 3.4, T_END = 4.1;
  let roared = false, ended = false;

  const tick = () => {
    if (ended) return;
    const dt = Math.min(clock.getDelta(), 0.05); const t = clock.elapsedTime;
    mixer.update(dt);

    const rise = ease(t / T_RISE);
    holder.position.y = -H * 0.75 * (1 - rise);
    holder.rotation.y += ((tx * 0.35) - holder.rotation.y) * 0.05;

    const push = easeIn((t - T_ROAR) / (T_PUSH - T_ROAR));
    const camDist = THREE.MathUtils.lerp(40, 22, push);
    const camY = THREE.MathUtils.lerp(2.5, H * 0.78, push) - ty * 1.2;
    camera.position.set(Math.sin(t * 0.15) * 4 + tx * 2, camY, camDist);
    camera.lookAt(0, THREE.MathUtils.lerp(H * 0.5, H * 0.86, push), 0);

    glow.position.set(0, H * 0.9, 4); glow.intensity = push * 60;
    rim.intensity = 4.5 + push * 4;

    if (!roared && t >= T_ROAR) { roared = true; if (window.playRoar) window.playRoar(); }
    if (flash && t >= T_PUSH - 0.1 && !flash.dataset.on) { flash.dataset.on = '1'; flash.classList.add('on'); }
    if (t >= T_END) { ended = true; finish(); setTimeout(() => renderer.dispose(), 1600); return; }
    if (window.introSkipped) { ended = true; setTimeout(() => renderer.dispose(), 1600); return; }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  curtain.classList.add('live');
  requestAnimationFrame(tick);
}
