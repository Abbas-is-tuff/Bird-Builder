// FORGE — entry point: renderer, world, systems, persistence and the main loop.
import * as THREE from 'three';
import './style.css';
import { World, FLAT_H } from './world.js';
import { CameraRig, Input } from './controls.js';
import { BuildSystem } from './build.js';
import { UI } from './ui.js';
import { setAnisotropy } from './textures.js';
import { starterWorld } from './library.js';
import { Bird, BIRD, BIRDS } from './birds.js';

const SAVE_KEY = 'forge.world.v1';
const SET_KEY = 'forge.settings.v1';
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

const QUALITY = {
  low: { pr: 0.75, shadows: false, shadowSize: 512, range: 40, trees: 0.3, grass: 0 },
  medium: { pr: 1.0, shadows: true, shadowSize: 1024, range: 45, trees: 0.55, grass: 0.3 },
  high: { pr: 1.5, shadows: true, shadowSize: 2048, range: 65, trees: 0.8, grass: 0.65 },
  ultra: { pr: 2.0, shadows: true, shadowSize: 4096, range: 85, trees: 1, grass: 1 },
};
const isTouch = matchMedia('(pointer:coarse)').matches;

const settings = Object.assign(
  { quality: isTouch ? 'medium' : 'high', time: 10.5, showFps: false, snap: true, hintDone: false, bird: null },
  lsGet(SET_KEY) || {},
);

// ---------- renderer ----------
const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('boot').innerHTML = '<div class="boot-logo">BIRD BUILDER</div><div class="boot-sub">This browser could not start 3D graphics (WebGL2). Try Safari or Chrome.</div>';
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 12000);

const world = new World(scene, renderer);
const rig = new CameraRig(camera, world);
const build = new BuildSystem(scene, camera, world);
const input = new Input(canvas, rig, build);

// ---------- birds ----------
let player = null;
const npcs = [];
function setPlayerBird(id, keepPos = true) {
  const def = BIRD[id] || BIRDS[0];
  const old = player;
  player = new Bird(def, scene, world, build);
  if (old && keepPos) { player.pos.copy(old.pos); player.heading = old.heading; player.flying = old.flying; }
  else { player.pos.set(0, world.getHeight(0, 8), 8); player.heading = Math.PI; }
  old?.dispose();
  build.bird = player;
  rig.follow = player.pos;
  app.player = player;
  // the other birds hang around the plaza
  npcs.splice(0).forEach((b) => b.dispose());
  BIRDS.filter((b) => b.id !== def.id).slice(0, 5).forEach((b, i) => {
    const n = new Bird(b, scene, world, build, { npc: true });
    const a = (i / 5) * Math.PI * 2;
    n.pos.set(Math.cos(a) * 12, 0, 6 + Math.sin(a) * 12);
    n.pos.y = world.getHeight(n.pos.x, n.pos.z);
    n.heading = Math.random() * 6.28;
    npcs.push(n);
  });
}

// ---------- persistence ----------
function save() {
  const b = player ? { x: player.pos.x, y: player.pos.y, z: player.pos.z, h: player.heading } : null;
  return lsSet(SAVE_KEY, { v: 1, savedAt: Date.now(), objects: build.serialize(), cam: rig.toJSON(), bird: b });
}
function saveSettings() { lsSet(SET_KEY, settings); }
function hasSave() { return !!lsGet(SAVE_KEY); }
function newWorld() {
  build.load(starterWorld(FLAT_H));
  rig.fromJSON({ x: 0, y: FLAT_H, z: 8, yaw: 0, pitch: 0.38, dist: 13 });
  if (player) { player.pos.set(0, world.getHeight(0, 8), 8); player.vel.set(0, 0, 0); player.heading = Math.PI; player.flying = false; }
  save();
}
let saveTimer = null;
build.on('change', () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); });
const flush = () => { if (!ui.inMenu || build.objects.size) save(); };
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

// ---------- settings ----------
let lastShadow = null;
function applySettings() {
  const q = QUALITY[settings.quality] || QUALITY.medium;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
  renderer.setSize(innerWidth, innerHeight, false);
  if (lastShadow !== q.shadows) {
    renderer.shadowMap.enabled = q.shadows;
    world.sun.castShadow = q.shadows;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    lastShadow = q.shadows;
  }
  world.setShadowMapSize(q.shadowSize);
  world.setShadowRange(q.range);
  world.setVegetationDensity(q.trees, q.grass);
  world.setTimeOfDay(settings.time);
  build.setSnap(settings.snap);
  ui?.updateSnapBtn();
  document.getElementById('fps')?.classList.toggle('hidden', !settings.showFps);
}

const app = { setPlayerBird, renderer, scene, camera, world, rig, build, input, settings, save, saveSettings, hasSave, newWorld, applySettings };
let ui = null;
ui = new UI(app);
app.ui = ui;

// load saved world (or a starter one)
const saved = lsGet(SAVE_KEY);
if (saved?.objects) { build.load(saved.objects); rig.fromJSON(saved.cam); }
else { build.load(starterWorld(FLAT_H)); rig.fromJSON({ x: 0, y: FLAT_H, z: 8, yaw: 0, pitch: 0.38, dist: 13 }); }
setPlayerBird(settings.bird || 'cookie', false);
if (saved?.bird) { player.pos.set(saved.bird.x, saved.bird.y, saved.bird.z); player.heading = saved.bird.h || 0; }
if (rig.dist > 40) rig.dist = 13;
rig.target.copy(player.pos);
applySettings();
ui.refreshMenu();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});

// ---------- shift lock ----------
const CENTER = new THREE.Vector2(0, 0);
let shiftLock = false;
function setShiftLock(on) {
  shiftLock = on;
  input.shiftLock = on;
  build.aimMode = on;
  rig.shoulderGoal = on ? 1 : 0;
  if (on) { rig.pitch = Math.min(rig.pitch, 0.45); rig.dist = Math.min(Math.max(rig.dist, 7), 16); }
  const fine = matchMedia('(pointer:fine)').matches;
  try {
    if (on && fine) canvas.requestPointerLock?.()?.catch?.(() => {});
    else if (!on && document.pointerLockElement) document.exitPointerLock();
  } catch { /* pointer lock not allowed here: drag to look instead */ }
  ui.onShiftLock(on);
}
app.setShiftLock = setShiftLock;
app.isShiftLock = () => shiftLock;
input.onShiftKey = () => { if (!ui.inMenu) setShiftLock(!shiftLock); };
// leaving pointer lock with Esc on desktop turns shift lock off, like Roblox
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && shiftLock && matchMedia('(pointer:fine)').matches) setShiftLock(false); });

// ---------- main loop ----------
let last = performance.now(), fpsT = 0, fpsN = 0, viewShift = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (ui.inMenu) rig.yaw += dt * 0.05;
  const intent = input.update(ui.inMenu ? { x: 0, y: 0 } : ui.joy, ui.inMenu ? 0 : ui.fly);
  // joystick is relative to the camera: up = away from camera
  const f = rig.forward(), r = rig.right();
  const move = new THREE.Vector3().addScaledVector(r, intent.x).addScaledVector(f, intent.y);
  const before = player.pos.clone(), hBefore = player.heading;
  player.lockHeading = shiftLock ? Math.atan2(-Math.sin(rig.yaw), -Math.cos(rig.yaw)) : null;
  player.step(dt, move, intent.vert);
  for (const n of npcs) n.think(dt, ui.inMenu ? new THREE.Vector3(0, 0, 6) : player.pos);
  rig.update(dt);
  if (build.mode === 'place') {
    if (shiftLock) { camera.updateMatrixWorld(); build.aim(CENTER); }
    else if (before.distanceToSquared(player.pos) > 1e-6 || Math.abs(hBefore - player.heading) > 1e-4) build.placeAhead(player);
  }
  const want = ui.coveredBottom() / 2;
  viewShift += (want - viewShift) * Math.min(1, dt * 8);
  if (Math.abs(viewShift) > 0.5) camera.setViewOffset(innerWidth, innerHeight, 0, viewShift, innerWidth, innerHeight);
  else if (camera.view?.enabled) camera.clearViewOffset();
  world.update(dt, rig.target);
  build.update();
  renderer.render(scene, camera);
  fpsT += dt; fpsN++;
  if (fpsT > 0.5) { if (settings.showFps) ui.setFps(Math.round(fpsN / fpsT)); fpsT = 0; fpsN = 0; }
});

const boot = document.getElementById('boot');
requestAnimationFrame(() => { boot.classList.add('fade'); setTimeout(() => boot.remove(), 600); });

// offline play: cache the game on the device (works on the GitHub Pages site)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// handy for debugging / automated tests
window.FORGE = app;
