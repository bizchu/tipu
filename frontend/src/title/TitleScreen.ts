import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 3D title screen (Three.js): old CRT TV on a VHS player with a stack of CDs,
 * red screen glow and a bloody, glitching "TIPU!" on the TV.
 * Menu on the right: PLAY / HOW TO PLAY / SETTINGS. No title text.
 *
 * Rendered in its own canvas on top of the Phaser canvas; removed when PLAY is pressed.
 */
export interface TitleCallbacks {
  onPlay: () => void;
  onHowTo: () => void;
  onSettings: () => void;
  /** a knob/button on the TV was clicked (for the click sound) */
  onKnob?: () => void;
  /** volume knob turned: 0..1 */
  onVolume?: (v: number) => void;
}

function volumeNow(): number {
  try {
    const v = localStorage.getItem('tipu.vol.ambience');
    return v === null ? 0.8 : Number(v);
  } catch {
    return 0.8;
  }
}

/** Move a mesh's origin to its centre so it spins in place; returns its spin axis (local, thinnest-cylinder axis). */
function centrePivot(mesh: THREE.Mesh): THREE.Vector3 {
  const geo = mesh.geometry.clone();
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const c = bb.getCenter(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z);
  mesh.geometry = geo;
  mesh.updateMatrix();
  const m = mesh.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(c.x, c.y, c.z));
  m.decompose(mesh.position, mesh.quaternion, mesh.scale);
  const sz = bb.getSize(new THREE.Vector3());
  // a knob is a short cylinder: its axis is the dimension that differs most from the other two
  const d = [Math.abs(sz.x - (sz.y + sz.z) / 2), Math.abs(sz.y - (sz.x + sz.z) / 2), Math.abs(sz.z - (sz.x + sz.y) / 2)];
  const i = d.indexOf(Math.max(...d));
  return new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
}

const SCREEN_W = 1024;
const SCREEN_H = 768;

export async function showTitleScreen(cb: TitleCallbacks): Promise<() => void> {
  const root = document.createElement('div');
  root.id = 'title-root';
  root.innerHTML = `
    <style>
      #title-root{position:fixed;inset:0;z-index:20;background:#07060a;overflow:hidden;font-family:"Courier New",monospace}
      #title-root canvas{display:block;width:100%;height:100%}
      #title-menu{position:absolute;right:5vw;top:39%;display:flex;flex-direction:column;gap:2.2vh;transition:opacity .4s}
      #title-menu button{all:unset;cursor:pointer;color:#e8c9b8;font-size:min(3.2vw,5.6vh);letter-spacing:.12em;font-weight:bold;
        display:flex;gap:1.6vw;align-items:center;text-shadow:0 0 12px rgba(255,40,40,.35);transition:color .15s, transform .15s}
      #title-menu button span{width:2.2vw;display:inline-block;text-align:center;color:#c8a89a}
      #title-menu button:hover,#title-menu button:focus-visible{color:#ff3a2a;transform:translateX(.6vw)}
      #title-menu button:focus-visible{outline:2px solid #ff3a2a;outline-offset:6px}
      #title-hint{position:absolute;right:2vw;bottom:2vh;transition:opacity .4s;color:#8a7570;font-size:min(1.3vw,2.1vh);text-align:right;max-width:60vw}
      #title-tip{position:absolute;pointer-events:none;padding:4px 10px;background:rgba(20,8,8,.85);border:1px solid #d9a54e;color:#f6e2b4;
        font-size:min(1.2vw,2vh);white-space:nowrap;transform:translate(14px,14px);display:none}
      #title-menu button.on{color:#ff3a2a}
      #title-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .6s}
      #title-load{position:absolute;left:28%;top:50%;transform:translate(-50%,-50%);white-space:nowrap;color:#e8c9b8;font-size:min(2.4vw,4vh);
        letter-spacing:.2em;text-align:center;transition:opacity .5s;pointer-events:none}
      #title-load small{display:block;margin-top:1.2vh;font-size:.5em;color:#8a7570;letter-spacing:.1em}
      #title-load .blink{animation:tblink 1s steps(2) infinite}
      @keyframes tblink{to{opacity:0}}
    </style>
    <div id="title-menu">
      <button id="t-play"><span>▶</span>PLAY</button>
      <button id="t-how"><span>?</span>HOW TO PLAY</button>
      <button id="t-set"><span>⚙</span>SETTINGS</button>
    </div>
    <div id="title-hint">Turn the TV knobs · click the screen or the VCR to play<br>Best with sound on · desktop browser</div>
    <div id="title-tip"></div>
    <div id="title-load"><span class="blink">▶</span> LOADING TAPE <span id="t-load-pct">0%</span><small>Tip: turn your sound on</small></div>
    <div id="title-fade"></div>`;
  document.body.appendChild(root);

  const font = new FontFace('Creepster', 'url(/fonts/creepster.woff2)');
  await font.load().then((f) => document.fonts.add(f)).catch(() => undefined);

  // ---- renderer / scene ----
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  root.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060a);
  scene.fog = new THREE.Fog(0x07060a, 4, 12);
  const cam = new THREE.PerspectiveCamera(35, 16 / 9, 0.01, 100);
  scene.add(new THREE.AmbientLight(0x404060, 0.35));
  const lamp = new THREE.PointLight(0xffaa66, 14, 10, 2);
  lamp.position.set(-1.6, 1.6, 1.4);
  lamp.castShadow = true;
  scene.add(lamp);
  const rim = new THREE.DirectionalLight(0x6688ff, 0.5);
  rim.position.set(2, 2, -2);
  scene.add(rim);
  const screenGlow = new THREE.PointLight(0xff2a2a, 8, 5, 2);
  scene.add(screenGlow);

  const top = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 1.6), new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.8 }));
  top.position.set(0.8, -0.04, 0);
  top.receiveShadow = true;
  scene.add(top);

  const fit = (obj: THREE.Object3D, size: number) => {
    const b = new THREE.Box3().setFromObject(obj);
    const sz = b.getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(size / Math.max(sz.x, sz.y, sz.z));
    const b2 = new THREE.Box3().setFromObject(obj);
    obj.position.x -= (b2.min.x + b2.max.x) / 2;
    obj.position.z -= (b2.min.z + b2.max.z) / 2;
    obj.position.y -= b2.min.y;
    obj.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true;
    });
    return obj;
  };

  const loader = new GLTFLoader();
  // loading text with a percentage while the two models download (~4 MB)
  const pctEl = root.querySelector<HTMLElement>('#t-load-pct');
  const got = [0, 0];
  const tot = [1.2e6, 2.5e6];
  const onProg = (i: number) => (e: ProgressEvent) => {
    got[i] = e.loaded;
    if (e.lengthComputable) tot[i] = e.total;
    if (pctEl) pctEl.textContent = `${Math.min(99, Math.round(((got[0] + got[1]) / (tot[0] + tot[1])) * 100))}%`;
  };
  const [tv, vcr] = await Promise.all([
    loader.loadAsync('/3d/old_tv.glb', onProg(0)),
    loader.loadAsync('/3d/vhs_player.glb', onProg(1)),
  ]);
  const loadEl = root.querySelector<HTMLElement>('#title-load');
  if (loadEl) {
    loadEl.style.opacity = '0';
    setTimeout(() => loadEl.remove(), 600);
  }
  const vcrO = fit(vcr.scene, 1.1);
  scene.add(vcrO);
  const vb = new THREE.Box3().setFromObject(vcrO);
  const tvO = fit(tv.scene, 1.3);
  tvO.position.y += vb.max.y;
  scene.add(tvO);
  const tb = new THREE.Box3().setFromObject(tvO);
  screenGlow.position.set(0, (tb.min.y + tb.max.y) / 2, tb.max.z + 0.4);

  // ---- TV screen: canvas texture with a bloody TIPU! ----
  // channels: turn the top knob to flip between them, click the screen to choose
  const CHANNELS = ['TIPU!', '▶ PLAY', '? HOW TO PLAY', '⚙ SETTINGS'] as const;
  const bases = CHANNELS.map((label, i) => {
    const c = document.createElement('canvas');
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    if (i === 0) drawTipu(c.getContext('2d')!);
    else drawChannel(c.getContext('2d')!, label, i + 1);
    return c;
  });
  let channel = 0;
  let base = bases[0];
  const cv = document.createElement('canvas');
  cv.width = SCREEN_W;
  cv.height = SCREEN_H;
  const g = cv.getContext('2d')!;
  g.drawImage(base, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sw = tb.max.x - tb.min.x;
  const sh = tb.max.y - tb.min.y;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(sw * 0.52, sh * 0.6),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, depthTest: false }),
  );
  screen.position.set(tb.min.x + sw * 0.4, tb.min.y + sh * 0.54, tb.max.z - 0.07);
  screen.renderOrder = 999;
  scene.add(screen);

  scene.add(makeCdStack());

  cam.position.set(1.55, tb.max.y * 0.78, 3.5);
  const camLook = new THREE.Vector3(0.85, tb.max.y * 0.5, 0);
  cam.lookAt(camLook);
  // camera move when PLAY is pressed (list of legs, played in order)
  let camMove: { from: THREE.Vector3; to: THREE.Vector3; lookFrom: THREE.Vector3; lookTo: THREE.Vector3; ms: number }[] = [];
  let camMoveStart = 0;

  // ---- interactive parts: knobs, power button, VCR ----
  const tvMeshes: THREE.Mesh[] = [];
  tvO.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) tvMeshes.push(m as THREE.Mesh);
  });
  const knobCh = tvMeshes[4]; // upper knob
  const knobVol = tvMeshes[0]; // lower knob
  const powerBtn = tvMeshes[1];
  const vcrParts: THREE.Mesh[] = [];
  vcrO.traverse((m) => {
    if ((m as THREE.Mesh).isMesh && /^(Tray|Buttons_ctrl|Buttons_power|Button_ch|Main)_low/.test(m.name)) vcrParts.push(m as THREE.Mesh);
  });
  const knobAxis = new Map<THREE.Mesh, THREE.Vector3>();
  [knobCh, knobVol].forEach((k) => k && knobAxis.set(k, centrePivot(k)));
  const hoverable = [knobCh, knobVol, powerBtn, ...vcrParts].filter(Boolean);
  hoverable.forEach((m) => {
    m.material = (m.material as THREE.MeshStandardMaterial).clone();
  });
  const LABEL = new Map<THREE.Object3D, string>([
    [knobCh, 'Channel knob: click to turn'],
    [knobVol, 'Volume knob: click to turn'],
    [powerBtn, 'Power'],
    [screen, ''],
  ]);
  vcrParts.forEach((m) => LABEL.set(m, 'VCR: insert the tape ▶ PLAY'));
  const knobTurn = new Map<THREE.Mesh, { cur: number; target: number }>();
  [knobCh, knobVol].forEach((k) => k && knobTurn.set(k, { cur: 0, target: 0 }));

  let tvOn = true;
  let osd = '';
  let osdUntil = 0;
  let volStep = Math.round(volumeNow() * 4); // 0..4
  const menuBtns = ['#t-play', '#t-play', '#t-how', '#t-set'];
  const setChannel = (c: number) => {
    channel = (c + CHANNELS.length) % CHANNELS.length;
    base = bases[channel];
    burstUntil = performance.now() + 350;
    osd = `CH ${String(channel + 1).padStart(2, '0')}`;
    osdUntil = performance.now() + 1500;
    root.querySelectorAll('#title-menu button').forEach((b) => b.classList.remove('on'));
    if (channel > 0) root.querySelector(menuBtns[channel])?.classList.add('on');
  };
  const chooseChannel = () => {
    if (!tvOn) return;
    const id = menuBtns[channel];
    (root.querySelector(id) as HTMLButtonElement).click();
  };

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const tip = root.querySelector<HTMLDivElement>('#title-tip')!;
  let hovered: THREE.Object3D | null = null;
  const pick = (e: PointerEvent): THREE.Object3D | null => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, cam);
    const hit = ray.intersectObjects([...hoverable, screen], false)[0];
    return hit ? hit.object : null;
  };
  const setGlow = (o: THREE.Object3D | null, on: boolean) => {
    const mat = o && (o as THREE.Mesh).material;
    if (mat && 'emissive' in (mat as THREE.MeshStandardMaterial)) (mat as THREE.MeshStandardMaterial).emissive.setHex(on ? 0x5a1a10 : 0x000000);
  };
  renderer.domElement.addEventListener('pointermove', (e) => {
    const o = pick(e);
    if (o !== hovered) {
      setGlow(hovered, false);
      setGlow(o, true);
      hovered = o;
    }
    renderer.domElement.style.cursor = o ? 'pointer' : 'default';
    const label = o === screen ? (tvOn ? `Click to choose: ${CHANNELS[channel] === 'TIPU!' ? '▶ PLAY' : CHANNELS[channel]}` : '') : o ? LABEL.get(o) ?? '' : '';
    tip.style.display = label ? 'block' : 'none';
    tip.textContent = label;
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
  });
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const o = pick(e);
    if (!o) return;
    if (o === knobCh || o === knobVol || o === powerBtn) cb.onKnob?.(); // click sound (screen/VCR use the menu buttons, which click already)
    if (o === knobCh) {
      knobTurn.get(knobCh)!.target -= Math.PI / 4;
      if (tvOn) setChannel(channel + 1);
    } else if (o === knobVol) {
      volStep = (volStep + 1) % 5;
      knobTurn.get(knobVol)!.target = -volStep * (Math.PI / 3);
      cb.onVolume?.(volStep / 4);
      osd = `VOLUME ${'▮'.repeat(volStep)}${'▯'.repeat(4 - volStep)}`;
      osdUntil = performance.now() + 1800;
      burstUntil = performance.now() + 120;
    } else if (o === powerBtn) {
      tvOn = !tvOn;
      powerAnim = { start: performance.now(), on: tvOn };
    } else if (o === screen) {
      chooseChannel();
    } else if (vcrParts.includes(o as THREE.Mesh)) {
      // push the tape in, then play
      const tray = vcrParts.find((m) => m.name.startsWith('Tray')) ?? (o as THREE.Mesh);
      const z0 = tray.position.z;
      const t0 = performance.now();
      const push = () => {
        const k = Math.min(1, (performance.now() - t0) / 250);
        tray.position.z = z0 - Math.sin(k * Math.PI) * 0.02 / Math.max(1e-6, tvO.scale.x);
        if (k < 1) requestAnimationFrame(push);
      };
      push();
      (root.querySelector('#t-play') as HTMLButtonElement).click();
    }
  });
  let powerAnim: { start: number; on: boolean } | null = null;

  // ---- sizing: keep a 16:9 view, cover the window ----
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.fov = w / h < 16 / 9 ? 35 * ((16 / 9) / (w / h)) ** 0.75 : 35;
    cam.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // ---- glitch loop ----
  let running = true;
  let seed = 1;
  let burstUntil = 0;
  let forced = 0;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const frame = (t: number) => {
    if (!running) return;
    if (t > burstUntil && Math.random() < 0.02) burstUntil = t + 120 + Math.random() * 380;
    const amt = Math.max(forced, t < burstUntil ? 0.4 + Math.random() * 0.6 : 0.08 * Math.random());
    if (camMove.length) {
      let el = t - camMoveStart;
      for (const leg of camMove) {
        if (el <= leg.ms || leg === camMove[camMove.length - 1]) {
          const k = Math.min(1, el / leg.ms);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease in-out
          cam.position.lerpVectors(leg.from, leg.to, e);
          camLook.lerpVectors(leg.lookFrom, leg.lookTo, e);
          cam.lookAt(camLook);
          break;
        }
        el -= leg.ms;
      }
    }
    knobTurn.forEach((st, k) => {
      const d = (st.target - st.cur) * 0.2;
      if (Math.abs(d) > 1e-4) {
        k.rotateOnAxis(knobAxis.get(k)!, d);
        st.cur += d;
      }
    });
    // power: CRT collapse to a line when switching off, bloom back when on
    let pw = tvOn ? 1 : 0;
    if (powerAnim) {
      const k = Math.min(1, (t - powerAnim.start) / 350);
      pw = powerAnim.on ? k : 1 - k;
      if (k >= 1) powerAnim = null;
    }
    if (pw <= 0) {
      g.clearRect(0, 0, SCREEN_W, SCREEN_H);
      g.fillStyle = '#030102';
      g.fillRect(0, 0, SCREEN_W, SCREEN_H);
      roundedClip(g);
    } else {
      glitch(g, base, pw < 1 ? 1 : amt, rnd);
      if (pw < 1) {
        const h = SCREEN_H * pw * pw;
        g.fillStyle = '#030102';
        g.fillRect(0, 0, SCREEN_W, (SCREEN_H - h) / 2);
        g.fillRect(0, (SCREEN_H + h) / 2, SCREEN_W, (SCREEN_H - h) / 2 + 1);
      }
      if (t < osdUntil) {
        g.font = 'bold 64px "Courier New", monospace';
        g.textAlign = 'right';
        g.textBaseline = 'top';
        g.fillStyle = '#6cff6c';
        g.shadowColor = '#0f0';
        g.shadowBlur = 12;
        g.fillText(osd, SCREEN_W - 90, 70);
        g.shadowBlur = 0;
      }
    }
    tex.needsUpdate = true;
    screenGlow.intensity = pw * 8 * (0.75 + 0.5 * Math.random() * (amt > 0.2 ? 1 : 0.4));
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const destroy = () => {
    running = false;
    window.removeEventListener('resize', resize);
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
  };

  const fade = root.querySelector<HTMLDivElement>('#title-fade')!;
  let starting = false;
  const SLOW = location.search.includes('slowplay') ? 10 : 1; // debug: ?slowplay to inspect the camera move
  root.querySelector('#t-play')!.addEventListener('click', () => {
    if (starting) return;
    starting = true;
    (root.querySelector('#title-menu') as HTMLElement).style.opacity = '0';
    (root.querySelector('#title-hint') as HTMLElement).style.opacity = '0';
    tip.style.display = 'none';
    if (!tvOn) {
      tvOn = true;
      powerAnim = { start: performance.now(), on: true };
    }
    // 1) swing round to face the TV head-on, 2) push into the screen, then cut to the game
    const tvMid = new THREE.Vector3((tb.min.x + tb.max.x) / 2, (tb.min.y + tb.max.y) / 2, tb.max.z);
    const front = tvMid.clone().add(new THREE.Vector3(0, 0, (tb.max.y - tb.min.y) * 2.3));
    const inside = screen.position.clone().add(new THREE.Vector3(0, 0, 0.12));
    camMove = [
      { from: cam.position.clone(), to: front, lookFrom: camLook.clone(), lookTo: tvMid.clone(), ms: 1500 * SLOW },
      { from: front, to: inside, lookFrom: tvMid.clone(), lookTo: screen.position.clone(), ms: 900 * SLOW },
    ];
    camMoveStart = performance.now();
    setTimeout(() => {
      forced = 1;
      fade.style.opacity = '1';
    }, 1900 * SLOW);
    setTimeout(() => {
      destroy();
      cb.onPlay();
    }, 2600 * SLOW);
  });
  root.querySelector('#t-how')!.addEventListener('click', cb.onHowTo);
  root.querySelector('#t-set')!.addEventListener('click', cb.onSettings);
  root.querySelector<HTMLButtonElement>('#t-play')!.focus();
  return destroy;
}

/** A plain TV channel card: big label + channel number + "click the screen". */
function drawChannel(g: CanvasRenderingContext2D, label: string, ch: number): void {
  const grd = g.createRadialGradient(512, 384, 50, 512, 384, 620);
  grd.addColorStop(0, '#1d0608');
  grd.addColorStop(1, '#050102');
  g.fillStyle = grd;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let i = 0; i < 6000; i++) {
    const v = Math.random() * 80;
    g.fillStyle = `rgba(${v + 40},${v * 0.3},${v * 0.3},0.25)`;
    g.fillRect(Math.random() * SCREEN_W, Math.random() * SCREEN_H, 2, 2);
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${label.length > 8 ? 92 : 130}px "Courier New", monospace`;
  g.shadowColor = 'rgba(255,40,40,1)';
  g.shadowBlur = 40;
  g.fillStyle = '#ff5a4a';
  g.fillText(label, 512, 360);
  g.shadowBlur = 0;
  g.font = 'bold 40px "Courier New", monospace';
  g.fillStyle = '#e8c9b8';
  g.fillText('click the screen', 512, 520);
  g.textAlign = 'left';
  g.fillText(`CH ${String(ch).padStart(2, '0')}`, 110, 100);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = 0; y < SCREEN_H; y += 4) g.fillRect(0, y, SCREEN_W, 2);
  roundedClip(g);
}

function roundedClip(g: CanvasRenderingContext2D): void {
  const r = 110;
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(r, 0);
  g.lineTo(SCREEN_W - r, 0);
  g.quadraticCurveTo(SCREEN_W, 0, SCREEN_W, r);
  g.lineTo(SCREEN_W, SCREEN_H - r);
  g.quadraticCurveTo(SCREEN_W, SCREEN_H, SCREEN_W - r, SCREEN_H);
  g.lineTo(r, SCREEN_H);
  g.quadraticCurveTo(0, SCREEN_H, 0, SCREEN_H - r);
  g.lineTo(0, r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.fill();
  g.globalCompositeOperation = 'source-over';
}

function drawTipu(g: CanvasRenderingContext2D): void {
  const grd = g.createRadialGradient(512, 384, 50, 512, 384, 620);
  grd.addColorStop(0, '#2a0608');
  grd.addColorStop(1, '#050102');
  g.fillStyle = grd;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random() * 90;
    g.fillStyle = `rgba(${v + 40},${v * 0.3},${v * 0.3},0.3)`;
    g.fillRect(Math.random() * SCREEN_W, Math.random() * SCREEN_H, 2, 2);
  }
  g.save();
  g.translate(512, 360);
  g.rotate(-0.05);
  g.font = '330px Creepster, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,30,30,1)';
  g.shadowBlur = 70;
  g.fillStyle = '#9e0b0b';
  g.fillText('TIPU!', 0, 0);
  g.shadowBlur = 0;
  const tg = g.createLinearGradient(0, -150, 0, 150);
  tg.addColorStop(0, '#ff4a3a');
  tg.addColorStop(1, '#d00000');
  g.fillStyle = tg;
  g.fillText('TIPU!', 0, 0);
  g.fillStyle = '#d01010';
  for (let i = 0; i < 9; i++) {
    const x = -330 + Math.random() * 660;
    const y = 60 + Math.random() * 40;
    const len = 60 + Math.random() * 160;
    const w = 6 + Math.random() * 8;
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.lineTo(x + w / 2, y);
    g.lineTo(x + w * 0.35, y + len);
    g.arc(x, y + len, w * 0.75, 0, Math.PI * 2);
    g.lineTo(x - w * 0.35, y + len);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = 0; y < SCREEN_H; y += 4) g.fillRect(0, y, SCREEN_W, 2);
  roundedClip(g);
}

function glitch(g: CanvasRenderingContext2D, base: HTMLCanvasElement, amt: number, rnd: () => number): void {
  g.clearRect(0, 0, SCREEN_W, SCREEN_H);
  g.globalAlpha = 1;
  g.drawImage(base, 0, 0);
  if (amt > 0) {
    const sh = amt * 40 * (rnd() - 0.3);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35 * amt;
    g.drawImage(base, sh, 0);
    g.globalAlpha = 0.25 * amt;
    g.drawImage(base, -sh * 0.7, 2);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const n = Math.floor(3 + amt * 14);
    for (let i = 0; i < n; i++) {
      const y = rnd() * SCREEN_H;
      const h = 6 + rnd() * 60 * amt;
      const dx = (rnd() - 0.5) * 260 * amt;
      g.drawImage(base, 0, y, SCREEN_W, h, dx, y, SCREEN_W, h);
    }
    g.fillStyle = `rgba(255,${80 + rnd() * 80},${80 + rnd() * 60},${0.15 + 0.3 * amt})`;
    g.fillRect(0, rnd() * 700, SCREEN_W, 10 + 30 * amt);
    for (let i = 0; i < 2500 * amt; i++) {
      const v = rnd() * 255;
      g.fillStyle = `rgba(${v},${v * 0.35},${v * 0.35},0.5)`;
      g.fillRect(rnd() * SCREEN_W, rnd() * SCREEN_H, 2, 2);
    }
    if (amt > 0.8) {
      g.fillStyle = 'rgba(255,30,30,0.15)';
      g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
  }
  roundedClip(g);
}

function makeCdStack(): THREE.Group {
  const cds = new THREE.Group();
  const caseM = new THREE.MeshStandardMaterial({ color: 0x99aab0, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 });
  const spines = [0x1d1d22, 0x7a1414, 0x223355, 0xd8d0b8, 0x1d1d22, 0x2c4a2c, 0xb08a2a, 0x1d1d22, 0x553355];
  spines.forEach((c, i) => {
    const gp = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.022, 0.25), caseM);
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.25), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    sp.position.x = -0.14;
    gp.add(b, sp);
    gp.position.y = 0.011 + i * 0.023;
    gp.rotation.y = Math.sin(i * 2.3) * 0.25;
    gp.position.x = Math.sin(i * 1.7) * 0.02;
    gp.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true;
    });
    cds.add(gp);
  });
  const t1 = new THREE.Group();
  [0x1d1d22, 0xd8d0b8, 0x7a1414].forEach((_, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.022, 0.25), caseM);
    b.position.y = 0.011 + i * 0.023;
    b.rotation.y = 0.4 + i * 0.2;
    t1.add(b);
  });
  t1.position.set(0.32, 0, 0.08);
  cds.add(t1);
  cds.position.set(0.95, 0, 0.35);
  cds.rotation.y = -0.4;
  cds.scale.setScalar(0.85);
  return cds;
}
