// Playable birds: procedural 3D models, walking/hopping/flying, and wandering NPC birds.
import * as THREE from 'three';
import { HALF } from './world.js';

export const BIRDS = [
  { id: 'cookie', name: 'Cookie', species: 'Cockatiel', tail: 'long', crest: '#f3d64a',
    c: { body: '#e4dfd2', belly: '#ece7dc', head: '#efe7cf', face: '#f3d64a', cheek: '#f08a24', wing: '#d9d3c4', tail: '#d3ccb9', beak: '#b9aa9a' } },
  { id: 'lightning', name: 'Lightning', species: 'Grey Cockatiel', tail: 'long', crest: '#d8c46a',
    c: { body: '#86888b', belly: '#97989a', head: '#a29f8f', face: '#f0d24a', cheek: '#f08a24', wing: '#76787b', tail: '#66686b', beak: '#9b938c', patch: '#f1f1ee' } },
  { id: 'pikachu', name: 'Pikachu', species: 'Lutino Cockatiel', tail: 'long', crest: '#f7d84a',
    c: { body: '#fbf0c2', belly: '#fdf5d6', head: '#fbeaa0', face: '#f7d84a', cheek: '#f3963a', wing: '#f6e8b0', tail: '#f2e19c', beak: '#d8c8b0' } },
  { id: 'abbas', name: 'Abbas', species: 'Lovebird', tail: 'short',
    c: { body: '#57ad47', belly: '#7cc35b', head: '#62b74e', face: '#f05a36', wing: '#469a3b', tail: '#3f7fc8', beak: '#f2e4c6' } },
  { id: 'silver', name: 'Silver', species: 'Lovebird', tail: 'short',
    c: { body: '#c9cdd1', belly: '#dfe2e4', head: '#d6d9dc', face: '#f4f4f2', wing: '#b4b9be', tail: '#9aa0a6', beak: '#f2e4c6' } },
  { id: 'salman', name: 'Salman', species: 'African Grey', tail: 'short',
    c: { body: '#8c9197', belly: '#a2a7ac', head: '#9aa0a6', face: '#dfe2e5', wing: '#7a7f85', tail: '#c8202a', beak: '#262626' } },
  { id: 'lemon', name: 'Lemon', species: 'Rainbow Lorikeet', tail: 'mid',
    c: { body: '#3aa24a', belly: '#f26b1f', head: '#2d4fb8', face: '#2d4fb8', wing: '#2e8d3c', tail: '#3aa24a', beak: '#e8402a', collar: '#c7e04a' } },
  { id: 'aziz', name: 'Aziz', species: 'Indian Ringneck', tail: 'long',
    c: { body: '#6cc24a', belly: '#86d062', head: '#74c852', face: '#7fd05a', wing: '#5aae3e', tail: '#4f9f39', beak: '#d8312a', collar: '#1f1f1f' } },
  { id: 'kiwi', name: 'Kiwi', species: 'Canary', tail: 'mid',
    c: { body: '#f7d53a', belly: '#fadf5e', head: '#f8d846', face: '#f8d846', wing: '#e8c22a', tail: '#e2bb26', beak: '#e9c8a0' } },
];
export const BIRD = Object.fromEntries(BIRDS.map((b) => [b.id, b]));

const matCache = new Map();
const mat = (hex, rough = 0.75) => {
  const k = hex + rough;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 }));
  return matCache.get(k);
};
const SPH = new THREE.SphereGeometry(1, 24, 16);
const CONE = new THREE.ConeGeometry(1, 1, 16);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);

function ell(hex, sx, sy, sz, x, y, z, rough) {
  const m = new THREE.Mesh(SPH, mat(hex, rough));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  return m;
}

// Builds a bird ~1.4 m tall, facing +Z, feet at y = 0.
export function makeBirdModel(def) {
  const c = def.c;
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while hopping
  root.add(body);

  body.add(ell(c.body, 0.46, 0.52, 0.6, 0, 0.78, -0.05));
  body.add(ell(c.belly, 0.39, 0.42, 0.42, 0, 0.7, 0.14));
  if (c.collar) body.add(ell(c.collar, 0.3, 0.08, 0.3, 0, 1.08, 0.18));

  const head = new THREE.Group();
  head.position.set(0, 1.25, 0.22);
  body.add(head);
  head.add(ell(c.head, 0.33, 0.33, 0.33, 0, 0, 0));
  head.add(ell(c.face, 0.27, 0.25, 0.22, 0, -0.02, 0.15));
  if (c.cheek) for (const s of [-1, 1]) head.add(ell(c.cheek, 0.09, 0.09, 0.05, s * 0.2, -0.07, 0.22, 0.6));
  for (const s of [-1, 1]) {
    head.add(ell('#111111', 0.06, 0.065, 0.05, s * 0.17, 0.06, 0.24, 0.2));
    head.add(ell('#ffffff', 0.018, 0.018, 0.012, s * 0.18, 0.09, 0.285, 0.2));
  }
  const beak = new THREE.Mesh(CONE, mat(c.beak, 0.5));
  beak.scale.set(0.1, 0.22, 0.1);
  beak.rotation.x = Math.PI / 2 + 0.55; // hooked downward
  beak.position.set(0, -0.06, 0.33);
  head.add(beak);
  if (def.crest) {
    [[0, 0.32, -0.05, -0.5, 0.34], [0.07, 0.29, -0.08, -0.65, 0.28], [-0.07, 0.29, -0.08, -0.65, 0.28]].forEach(([x, y, z, rx, h]) => {
      const f = new THREE.Mesh(CONE, mat(def.crest, 0.7));
      f.scale.set(0.045, h, 0.045); f.position.set(x, y, z); f.rotation.x = rx;
      head.add(f);
    });
  }

  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.38, 1.0, -0.02);
    const w = ell(c.wing, 0.09, 0.34, 0.5, s * 0.05, -0.2, -0.1);
    pivot.add(w);
    if (c.patch) pivot.add(ell(c.patch, 0.095, 0.12, 0.2, s * 0.06, -0.12, 0.12));
    body.add(pivot);
    wings.push(pivot);
  }

  const tailLen = def.tail === 'long' ? 0.75 : def.tail === 'mid' ? 0.5 : 0.32;
  const tail = ell(c.tail, 0.17, 0.05, tailLen, 0, 0.6, -0.55 - tailLen * 0.55);
  tail.rotation.x = -0.45;
  body.add(tail);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.15, 0.36, 0.05);
    const shin = new THREE.Mesh(CYL, mat('#b89a8c', 0.8));
    shin.scale.set(0.035, 0.36, 0.035); shin.position.y = -0.18;
    const foot = ell('#b89a8c', 0.08, 0.03, 0.13, 0, -0.35, 0.05, 0.8);
    leg.add(shin, foot);
    root.add(leg);
    legs.push(leg);
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.userData = { body, head, wings, legs };
  return root;
}

const DOWN = new THREE.Vector3(0, -1, 0);

export class Bird {
  constructor(def, scene, world, build, { npc = false } = {}) {
    this.def = def; this.world = world; this.build = build; this.npc = npc;
    this.model = makeBirdModel(def);
    scene.add(this.model);
    this.scene = scene;
    this.pos = new THREE.Vector3(0, world.getHeight(0, 0), 8);
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.flying = false;
    this.t = Math.random() * 10;
    this.moving = false;
    this.ray = new THREE.Raycaster();
    this.ray.far = 60;
    this.ai = { goal: null, wait: Math.random() * 3 };
  }

  dispose() { this.scene.remove(this.model); }

  forwardVec() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  // ground height under the bird: terrain, water surface, or the top of something built
  groundAt(x, z, fromY) {
    let g = Math.max(this.world.getHeight(x, z), 0);
    this.ray.set(new THREE.Vector3(x, fromY + 0.6, z), DOWN);
    const hits = this.ray.intersectObject(this.build.group, true);
    if (hits.length) g = Math.max(g, hits[0].point.y);
    return g;
  }

  blocked(dir, dist) {
    this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + 0.7, this.pos.z), dir);
    this.ray.far = dist;
    const hit = this.ray.intersectObject(this.build.group, true).length > 0;
    this.ray.far = 60;
    return hit;
  }

  // move: Vector3 (world, length 0..1); vert: -1..1 (fly down / up)
  step(dt, move, vert) {
    this.t += dt;
    const speed = this.flying ? 13 : 6.5;
    const want = move.clone().multiplyScalar(speed);
    const k = Math.min(1, dt * (this.flying ? 3 : 8));
    this.vel.x += (want.x - this.vel.x) * k;
    this.vel.z += (want.z - this.vel.z) * k;

    // simple collision with buildings
    const h = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    const hl = h.length();
    if (hl > 0.01 && !this.npc && this.blocked(h.clone().normalize(), hl * dt + 0.55)) { this.vel.x = 0; this.vel.z = 0; }

    const ground = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (vert > 0.1) { this.flying = true; this.vel.y += (9 * vert - this.vel.y) * Math.min(1, dt * 5); }
    else if (this.flying) {
      const target = vert < -0.1 ? 9 * vert : 0; // hover when nothing pressed
      this.vel.y += (target - this.vel.y) * Math.min(1, dt * 4);
    } else this.vel.y -= 28 * dt;

    this.pos.addScaledVector(this.vel, dt);
    const lim = HALF - 6;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
    this.pos.y = Math.min(this.pos.y, 260);

    const g2 = this.groundAt(this.pos.x, this.pos.z, Math.max(this.pos.y, ground));
    if (this.pos.y <= g2) {
      if (!this.flying || this.vel.y <= 0) { this.pos.y = g2; this.vel.y = 0; this.flying = false; }
    } else if (!this.flying && this.pos.y - g2 < 0.7 && this.vel.y <= 0) {
      this.pos.y = g2; this.vel.y = 0; // walk down steps
    }

    this.moving = hl > 0.4;
    if (move.lengthSq() > 0.01) {
      const target = Math.atan2(move.x, move.z);
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 10);
    }
    this.animate(dt);
  }

  animate() {
    const { body, head, wings, legs } = this.model.userData;
    const t = this.t;
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.heading;
    if (this.flying) {
      const f = Math.sin(t * 16);
      wings[0].rotation.z = -0.3 - f * 0.9; wings[1].rotation.z = 0.3 + f * 0.9;
      body.position.y = Math.sin(t * 16) * 0.04;
      body.rotation.x = this.moving ? 0.35 : 0.1;
      legs.forEach((l) => { l.rotation.x = -0.9; });
      head.rotation.x = this.moving ? -0.3 : 0;
    } else {
      wings[0].rotation.z = -0.05; wings[1].rotation.z = 0.05;
      body.rotation.x = 0;
      if (this.moving) {
        const hop = Math.abs(Math.sin(t * 11));
        body.position.y = hop * 0.14;
        legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 11 + i * Math.PI) * 0.5; });
        head.rotation.x = Math.sin(t * 22) * 0.08;
      } else {
        body.position.y = Math.sin(t * 2) * 0.012;
        legs.forEach((l) => { l.rotation.x = 0; });
        head.rotation.x = Math.max(0, Math.sin(t * 1.3)) * 0.15;
        head.rotation.y = Math.sin(t * 0.7) * 0.4;
      }
    }
  }

  // wandering behaviour for NPC birds
  think(dt, home) {
    const ai = this.ai;
    const move = new THREE.Vector3();
    let vert = 0;
    if (!ai.goal) {
      ai.wait -= dt;
      if (ai.wait <= 0) {
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 22;
        ai.goal = new THREE.Vector3(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r);
        ai.fly = Math.random() < 0.25;
        ai.time = 0;
      }
    } else {
      ai.time += dt;
      const d = new THREE.Vector3(ai.goal.x - this.pos.x, 0, ai.goal.z - this.pos.z);
      const L = d.length();
      if (L < 1 || ai.time > 12) { ai.goal = null; ai.wait = 1.5 + Math.random() * 4; }
      else {
        move.copy(d.normalize()).multiplyScalar(ai.fly ? 0.8 : 0.45);
        if (ai.fly) vert = L > 5 && this.pos.y - this.world.getHeight(this.pos.x, this.pos.z) < 6 ? 0.8 : L < 5 ? -1 : 0;
      }
    }
    if (!ai.goal && this.flying) vert = -1;
    this.step(dt, move, vert);
  }
}

// render small portraits of each bird for the picker
let portraits = null;
export function getBirdPortraits() {
  if (portraits) return portraits;
  portraits = {};
  let r;
  try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return portraits; }
  r.setSize(200, 200);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 4, 5); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(2.2, 1.6, 3.6); cam.lookAt(0, 0.85, 0);
  for (const def of BIRDS) {
    const m = makeBirdModel(def);
    m.rotation.y = 0.35;
    m.userData.head.rotation.y = 0.25;
    scene.add(m);
    r.render(scene, cam);
    portraits[def.id] = r.domElement.toDataURL('image/png');
    scene.remove(m);
  }
  r.dispose(); r.forceContextLoss?.();
  return portraits;
}
