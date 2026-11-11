// Building system: placement preview, selection, dragging, transforms,
// materials/colours, duplicate/delete and undo/redo history.
import * as THREE from 'three';
import { LIB, buildItem } from './library.js';
import { getMaterial } from './textures.js';

const UP = new THREE.Vector3(0, 1, 0);
const r2 = (v) => Math.round(v * 1000) / 1000;

export class BuildSystem {
  constructor(scene, camera, world) {
    this.scene = scene; this.camera = camera; this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'creations';
    scene.add(this.group);
    this.objects = new Map();
    this.nextId = 1;
    this.mode = 'select';
    this.selectedId = null;
    this.ghost = null; this.ghostData = null;
    this.snap = true;
    this.scaleAxis = 'all';
    this.history = []; this.future = [];
    this.dragging = false;
    this.listeners = {};
    this.raycaster = new THREE.Raycaster();
    this.rotOffset = 0;
    // repeat pattern for fast building: row / grid / room, count per side, levels tall
    this.pattern = { shape: 'row', count: 1, tall: 1 };
    // mirror mode: everything placed is copied across a mirror line through (cx, cz)
    this.mirror = { mode: 'off', cx: 0, cz: 0 };
    this.animating = new Set();
    this._clock = performance.now();
    this.mirrorGhosts = [];
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xf5a623, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf5a623, transparent: true, opacity: 0.8, depthWrite: false });
    this.mirrorPlanes = ['x', 'z'].map((ax) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(80, 30), planeMat));
      const line = new THREE.Mesh(new THREE.BoxGeometry(80, 0.12, 0.12), edgeMat);
      line.position.y = -14.9;
      g.add(line);
      g.userData.axis = ax;
      g.visible = false;
      scene.add(g);
      return g;
    });
    this.bird = null; // set by main: the player's bird

    this.selHelper = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(0xf5a623));
    this.selHelper.material.depthTest = false;
    this.selHelper.material.transparent = true;
    this.selHelper.renderOrder = 20;
    this.selHelper.visible = false;
    scene.add(this.selHelper);

    this.grid = new THREE.GridHelper(40, 40, 0xf5a623, 0xffffff);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.22;
    this.grid.material.depthWrite = false;
    this.grid.visible = false;
    scene.add(this.grid);
  }

  on(evt, fn) { (this.listeners[evt] ??= []).push(fn); }
  emit(evt, ...a) { (this.listeners[evt] || []).forEach((f) => f(...a)); }

  get moveStep() { return this.snap ? 1 : 0.1; }
  get liftStep() { return this.snap ? 0.5 : 0.05; }
  get rotStep() { return this.snap ? Math.PI / 4 : Math.PI / 12; }
  snapv(v) { return this.snap ? Math.round(v) : v; }

  // ---------- data ----------
  defaults(type) {
    const def = LIB[type];
    return { type, mat: def.mat, color: null, x: 0, y: 0, z: 0, ry: 0, sx: 1, sy: 1, sz: 1 };
  }
  serialize() { return [...this.objects.values()].map((o) => ({ ...o.data })); }
  get(id) { return this.objects.get(id); }
  get selected() { return this.selectedId != null ? this.objects.get(this.selectedId) : null; }

  _build(data) {
    const def = LIB[data.type];
    if (!def) return null;
    const root = new THREE.Group();
    root.add(buildItem(def, data.mat, data.color));
    root.userData.oid = data.id;
    root.traverse((o) => {
      if (o.isMesh) {
        o.userData.oid = data.id;
        o.castShadow = !o.material.userData.glass;
        o.receiveShadow = true;
      }
    });
    // interactive parts: hinges/sliders and glowing bits
    root.userData.anims = [];
    root.userData.glows = [];
    root.traverse((o) => {
      if (o.userData.anim) root.userData.anims.push(o);
      if (o.userData.glow) root.userData.glows.push(o);
    });
    this._applyState(root, data, true);
    this._applyTransform(root, data);
    return root;
  }

  // ---------- interactables (doors, windows, lamps, ...) ----------
  isOn(d) { const it = LIB[d.type]?.interact; return d.open ?? (it?.initial || false); }
  _applyState(root, d, instant) {
    const on = this.isOn(d);
    root.userData.tTarget = on ? 1 : 0;
    if (instant) { root.userData.t = root.userData.tTarget; this._pose(root); }
    else if (root.userData.anims.length) this.animating.add(root);
    for (const g of root.userData.glows) {
      if (g.userData.glow === 'light') g.material = getMaterial(on ? 'light' : 'lightoff');
      else if (g.userData.glow === 'screen') g.material = on ? getMaterial('tvscreen') : getMaterial('plastic', '#0d1117');
    }
  }
  _pose(root) {
    const t = root.userData.t ?? 0;
    const e = t * t * (3 - 2 * t);
    for (const o of root.userData.anims) {
      const a = o.userData.anim;
      if (a.swing) continue;
      o[a.prop][a.axis] = a.closed + (a.open - a.closed) * e;
    }
  }
  canInteract(id) { const o = this.objects.get(id); return !!(o && LIB[o.data.type]?.interact); }
  interactLabel(id) {
    const o = this.objects.get(id); const it = o && LIB[o.data.type]?.interact;
    if (!it) return '';
    return this.isOn(o.data) ? it.verbs[1] : it.verbs[0];
  }
  interact(id) {
    const o = this.objects.get(id);
    const it = o && LIB[o.data.type]?.interact;
    if (!it) return;
    if (it.swing) { o.root.userData.swingT0 = performance.now() / 1000; this.animating.add(o.root); return; }
    o.data.open = !this.isOn(o.data);
    this._applyState(o.root, o.data, false);
    this.emit('change');
    this.emit('interact', o.data);
  }
  // closest usable thing near a point (the bird)
  nearestInteractable(pos, maxDist = 2.6) {
    let best = null, bestD = maxDist;
    const box = new THREE.Box3();
    for (const { data, root } of this.objects.values()) {
      if (!LIB[data.type]?.interact) continue;
      if (Math.abs(data.x - pos.x) > 12 || Math.abs(data.z - pos.z) > 12) continue;
      const dist = box.setFromObject(root).distanceToPoint(pos);
      if (dist < bestD) { bestD = dist; best = data.id; }
    }
    return best;
  }
  _animate(dt) {
    const now = performance.now() / 1000;
    for (const root of this.animating) {
      if (!root.parent) { this.animating.delete(root); continue; }
      let busy = false;
      const u = root.userData;
      if (u.t !== u.tTarget) {
        u.t += Math.sign(u.tTarget - u.t) * Math.min(Math.abs(u.tTarget - u.t), dt * 2.2);
        this._pose(root);
        busy = u.t !== u.tTarget;
      }
      if (u.swingT0 != null) {
        const s = now - u.swingT0;
        const ang = 0.75 * Math.sin(s * 3.2) * Math.exp(-s * 0.35);
        for (const o of u.anims) if (o.userData.anim.swing) o.rotation.x = ang;
        if (s < 14) busy = true; else u.swingT0 = null;
      }
      if (!busy) this.animating.delete(root);
    }
    // traffic lights run on their own: green 5 s, yellow 1.5 s, red 5 s
    if (now - (this._tlCheck || 0) > 0.25) {
      this._tlCheck = now;
      for (const { data, root } of this.objects.values()) {
        if (!LIB[data.type]?.cycle) continue;
        const t = (now + data.id * 1.7) % 11.5;
        const phase = t < 5 ? 2 : t < 6.5 ? 1 : 0; // 0 red (top), 1 yellow, 2 green
        if (root.userData.phase === phase) continue;
        root.userData.phase = phase;
        const on = ['glowred', 'glowyellow', 'glowgreen'], off = ['#4a1512', '#4a3d10', '#103a1c'];
        for (const g of root.userData.glows) {
          const k = +g.userData.glow.slice(2);
          g.material = k === phase ? getMaterial(on[k]) : getMaterial('plastic', off[k]);
        }
      }
    }
  }
  _applyTransform(root, d) {
    root.position.set(d.x, d.y, d.z);
    root.rotation.set(0, d.ry, 0);
    root.scale.set(d.sx, d.sy, d.sz);
    root.updateMatrixWorld(true);
  }
  _add(data) {
    if (data.id == null) data.id = this.nextId++;
    else this.nextId = Math.max(this.nextId, data.id + 1);
    const root = this._build(data);
    if (!root) return null;
    this.group.add(root);
    this.objects.set(data.id, { data, root });
    return data.id;
  }
  _remove(id) {
    const o = this.objects.get(id);
    if (!o) return;
    this.group.remove(o.root);
    this.objects.delete(id);
  }
  _rebuild(id) {
    const o = this.objects.get(id);
    this.group.remove(o.root);
    o.root = this._build(o.data);
    this.group.add(o.root);
  }

  clear() {
    for (const id of [...this.objects.keys()]) this._remove(id);
    this.deselect();
  }
  load(list, { resetHistory = true } = {}) {
    if (this.mode === 'place') this.stopPlacing();
    this.clear();
    this.nextId = 1;
    (list || []).forEach((d) => { if (LIB[d.type]) this._add({ ...this.defaults(d.type), ...d }); });
    if (resetHistory) { this.history = []; this.future = []; }
    this.emit('history');
  }

  // ---------- history ----------
  _snapshot() {
    this.history.push(JSON.stringify(this.serialize()));
    if (this.history.length > 100) this.history.shift();
    this.future.length = 0;
    this.emit('history');
  }
  _restore(json) {
    const sel = this.selectedId;
    for (const id of [...this.objects.keys()]) this._remove(id);
    JSON.parse(json).forEach((d) => this._add(d));
    if (sel != null && this.objects.has(sel)) this.select(sel); else this.deselect();
    this.emit('change');
    this.emit('history');
  }
  undo() {
    if (!this.history.length || this.dragging) return false;
    this.future.push(JSON.stringify(this.serialize()));
    this._restore(this.history.pop());
    return true;
  }
  redo() {
    if (!this.future.length || this.dragging) return false;
    this.history.push(JSON.stringify(this.serialize()));
    this._restore(this.future.pop());
    return true;
  }

  // ---------- selection ----------
  select(id) {
    if (!this.objects.has(id)) return;
    this.selectedId = id;
    this.emit('select', this.objects.get(id).data);
  }
  deselect() {
    if (this.selectedId == null) return;
    this.selectedId = null;
    this.emit('select', null);
  }

  // ---------- picking ----------
  _ray(ndc) { this.raycaster.setFromCamera(ndc, this.camera); return this.raycaster; }
  _hitOid(ndc) {
    const hits = this._ray(ndc).intersectObject(this.group, true);
    return hits.length ? hits[0].object.userData.oid : null;
  }
  _hitGhost(ndc) { return !!this.ghost && this._ray(ndc).intersectObject(this.ghost, true).length > 0; }

  pick(ndc, excludeId = null) {
    const rc = this._ray(ndc);
    let hit = null;
    for (const h of rc.intersectObject(this.group, true)) {
      if (excludeId != null && h.object.userData.oid === excludeId) continue;
      hit = h; break;
    }
    const t = this.world.raycastTerrain(rc.ray);
    if (hit && (!t || hit.distance < t.distance)) {
      const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : UP.clone();
      return { point: hit.point.clone(), normal: n, oid: hit.object.userData.oid };
    }
    if (t) return { point: t.point, normal: UP.clone(), oid: null };
    return null;
  }

  // local bounding box (rotation + scale applied, position at origin)
  _extents(root) {
    const p = root.position.clone();
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root);
    root.position.copy(p);
    root.updateMatrixWorld(true);
    return b;
  }

  // put object `d` (rendered by `root`) against a surface hit
  _positionData(d, root, hit) {
    const ext = this._extents(root);
    const n = hit.normal;
    let x, y, z;
    if (!hit.oid || n.y > 0.6) {
      x = this.snapv(hit.point.x); z = this.snapv(hit.point.z);
      if (hit.oid) y = hit.point.y - ext.min.y;
      else y = Math.max(this.world.getHeight(x, z), -20) - ext.min.y;
    } else if (n.y < -0.6) {
      // underside: hang below
      x = this.snapv(hit.point.x); z = this.snapv(hit.point.z);
      y = hit.point.y - ext.max.y;
    } else {
      // side face: sit flush against it, sharing its base height
      const other = this.objects.get(hit.oid)?.data;
      if (Math.abs(n.x) >= Math.abs(n.z)) {
        x = hit.point.x + (n.x > 0 ? -ext.min.x : -ext.max.x);
        z = this.snapv(hit.point.z);
      } else {
        z = hit.point.z + (n.z > 0 ? -ext.min.z : -ext.max.z);
        x = this.snapv(hit.point.x);
      }
      y = other ? other.y : hit.point.y;
    }
    d.x = r2(x); d.y = r2(y); d.z = r2(z);
    this._applyTransform(root, d);
  }

  // ---------- placement mode ----------
  startPlacing(type, centerNdc = new THREE.Vector2(0, -0.1)) {
    if (!LIB[type]) return;
    this.deselect();
    if (this.ghost) this._disposeGhost();
    this.mode = 'place';
    this.ghostData = { ...this.defaults(type) };
    this._makeGhost();
    if (this.bird) this.placeAhead(this.bird);
    else { const hit = this.pick(centerNdc); if (hit) this._positionData(this.ghostData, this.ghost, hit); }
    this.emit('mode', 'place', LIB[type]);
  }
  // offsets (in the object's own space) for every copy in the current pattern
  _patternOffsets(w, d, h) {
    const { shape, count: n, tall } = this.pattern;
    const out = [];
    const c = (i, m) => (i - (m - 1) / 2);
    for (let k = 0; k < tall; k++) {
      const y = k * h;
      if (shape === 'grid') {
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push({ x: c(i, n) * w, y, z: c(j, n) * d, ry: 0 });
      } else if (shape === 'room') {
        const L = n * w;
        for (let i = 0; i < n; i++) {
          out.push({ x: c(i, n) * w, y, z: L / 2, ry: 0 }, { x: c(i, n) * w, y, z: -L / 2, ry: 0 });
          out.push({ x: L / 2, y, z: c(i, n) * w, ry: Math.PI / 2 }, { x: -L / 2, y, z: c(i, n) * w, ry: Math.PI / 2 });
        }
      } else {
        for (let i = 0; i < n; i++) out.push({ x: c(i, n) * w, y, z: 0, ry: 0 });
      }
    }
    return out.slice(0, 400);
  }

  _makeGhost() {
    const single = this._build({ ...this.ghostData, id: -1, x: 0, y: 0, z: 0, ry: 0, sx: 1, sy: 1, sz: 1 });
    single.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = Math.min(o.material.opacity, 0.62);
        o.material.depthWrite = false;
        if (o.material.emissive) { o.material.emissive.set(0xf5a623); o.material.emissiveIntensity = 0.25; }
        o.castShadow = false;
        o.userData.oid = undefined;
      }
    });
    const size = new THREE.Box3().setFromObject(single).getSize(new THREE.Vector3());
    const g = new THREE.Group();
    this._patternOffsets(size.x, size.z, size.y).forEach((off, i) => {
      const c = i === 0 ? single : single.clone();
      c.position.set(off.x, off.y, off.z);
      c.rotation.set(0, off.ry, 0);
      g.add(c);
    });
    this.ghost = g;
    this._applyTransform(g, this.ghostData);
    this.scene.add(g);
    this._rebuildMirrorGhosts();
  }

  // ---------- mirror mode ----------
  _mirrorList() { return { off: [], x: ['x'], z: ['z'], xz: ['x', 'z', 'xz'] }[this.mirror.mode]; }
  _mirrorMatrix(m) {
    const { cx, cz } = this.mirror;
    const sx = m === 'x' || m === 'xz' ? -1 : 1, sz = m === 'z' || m === 'xz' ? -1 : 1;
    return new THREE.Matrix4().makeTranslation(cx, 0, cz)
      .multiply(new THREE.Matrix4().makeScale(sx, 1, sz))
      .multiply(new THREE.Matrix4().makeTranslation(-cx, 0, -cz));
  }
  _mirrorData(d, m) {
    const o = { ...d };
    const { cx, cz } = this.mirror;
    if (m === 'x' || m === 'xz') o.x = r2(2 * cx - d.x);
    if (m === 'z' || m === 'xz') o.z = r2(2 * cz - d.z);
    // a reflection = rotation by -ry plus a flip of one local axis (both flips = half turn)
    if (m === 'x') { o.ry = this._normAngle(-d.ry); o.sx = -d.sx; }
    else if (m === 'z') { o.ry = this._normAngle(-d.ry); o.sz = -d.sz; }
    else o.ry = this._normAngle(d.ry + Math.PI);
    return o;
  }
  _rebuildMirrorGhosts() {
    this.mirrorGhosts.forEach((g) => this.scene.remove(g));
    this.mirrorGhosts = [];
    if (!this.ghost) return;
    for (const m of this._mirrorList()) {
      const c = this.ghost.clone();
      c.matrixAutoUpdate = false;
      c.userData.mirror = m;
      this.scene.add(c);
      this.mirrorGhosts.push(c);
    }
  }
  setMirror(mode, center) {
    this.mirror.mode = mode;
    if (center) { this.mirror.cx = Math.round(center.x); this.mirror.cz = Math.round(center.z); }
    this._rebuildMirrorGhosts();
    this.emit('mirror', this.mirror);
  }

  setPattern(p) {
    Object.assign(this.pattern, p);
    if (this.ghost) {
      this._disposeGhost();
      this._makeGhost();
      if (this.bird && !this.aimMode) this.placeAhead(this.bird);
    }
    this.emit('pattern', this.pattern);
  }
  get patternSize() { return this.ghost ? this.ghost.children.length : 1; }

  _disposeGhost() {
    this.mirrorGhosts.forEach((g) => this.scene.remove(g));
    this.mirrorGhosts = [];
    this.ghost.traverse((o) => { if (o.isMesh) o.material.dispose(); });
    this.scene.remove(this.ghost);
    this.ghost = null;
  }
  stopPlacing() {
    if (this.ghost) this._disposeGhost();
    this.ghostData = null;
    this.mode = 'select';
    this.emit('mode', 'select');
  }
  rotateGhost(dir) {
    if (!this.ghost) return;
    this.rotOffset = this._normAngle(this.rotOffset + dir * this.rotStep);
    this.ghostData.ry = this._normAngle(this.ghostData.ry + dir * this.rotStep);
    this._applyTransform(this.ghost, this.ghostData);
  }

  // straight-down probe: top of whatever is built at (x,z), else the terrain
  pickDown(x, z, fromY) {
    const rc = this.raycaster;
    rc.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0));
    const hits = rc.intersectObject(this.group, true);
    const tg = this.world.getHeight(x, z);
    if (hits.length && hits[0].point.y > tg) return { point: hits[0].point.clone(), normal: UP.clone(), oid: hits[0].object.userData.oid };
    return { point: new THREE.Vector3(x, tg, z), normal: UP.clone(), oid: null };
  }

  // put the preview just in front of the bird, facing the way the bird looks
  placeAhead(bird) {
    if (!this.ghost || this.dragging) return;
    const quarter = Math.PI / 2;
    const snapped = Math.round(bird.heading / quarter) * quarter;
    this.ghostData.ry = this._normAngle((this.snap ? snapped : bird.heading) + this.rotOffset);
    this._applyTransform(this.ghost, this.ghostData);
    const ext = this._extents(this.ghost);
    const depth = Math.max(ext.max.x - ext.min.x, ext.max.z - ext.min.z);
    const f = bird.forwardVec();
    const dist = 1.6 + depth / 2;
    const x = bird.pos.x + f.x * dist, z = bird.pos.z + f.z * dist;
    this._positionData(this.ghostData, this.ghost, this.pickDown(x, z, bird.pos.y + 2.5));
  }
  placeGhost() {
    if (!this.ghostData || !this.ghost) return null;
    this._snapshot();
    this.ghost.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    const pieces = [];
    for (const c of this.ghost.children) {
      c.getWorldPosition(p);
      const d = { ...this.ghostData, x: r2(p.x), y: r2(p.y), z: r2(p.z), ry: this._normAngle(this.ghostData.ry + c.rotation.y) };
      delete d.id;
      pieces.push(d);
    }
    const base = pieces.slice();
    for (const m of this._mirrorList()) for (const d of base) pieces.push(this._mirrorData(d, m));
    const seen = new Set();
    let id = null;
    for (const d of pieces) {
      const key = `${d.x.toFixed(2)}|${d.y.toFixed(2)}|${d.z.toFixed(2)}`;
      if (seen.has(key)) continue; // a piece sitting on the mirror line isn't doubled
      seen.add(key);
      id = this._add(d);
    }
    this.emit('change');
    this.emit('placed', this.ghostData, seen.size);
    return id;
  }

  // ---------- pointer callbacks (from Input) ----------
  beginDrag(ndc) {
    if (this.mode === 'place') {
      if (this._hitGhost(ndc)) { this.dragging = 'ghost'; this._grab(ndc, this.ghostData); return true; }
      return false;
    }
    if (this.selectedId != null && this._hitOid(ndc) === this.selectedId) {
      this._snapshot();
      this.dragging = 'object';
      this.dragMoved = false;
      this._grab(ndc, this.selected.data);
      return true;
    }
    return false;
  }
  // remember finger offset so the object doesn't jump under the finger
  _grab(ndc, d) {
    const v = new THREE.Vector3(d.x, d.y, d.z).project(this.camera);
    this.grabOffset = new THREE.Vector2(v.x - ndc.x, v.y - ndc.y);
  }
  dragMove(ndc) {
    const p = ndc.clone().add(this.grabOffset || new THREE.Vector2());
    if (this.dragging === 'ghost') {
      const hit = this.pick(p);
      if (hit) this._positionData(this.ghostData, this.ghost, hit);
    } else if (this.dragging === 'object') {
      const o = this.selected;
      const hit = this.pick(p, o.data.id);
      if (hit) { this._positionData(o.data, o.root, hit); this.dragMoved = true; this.emit('transform', o.data); }
    }
  }
  endDrag() {
    if (this.dragging === 'object') {
      if (!this.dragMoved) { this.history.pop(); this.emit('history'); }
      else this.emit('change');
    }
    this.dragging = false;
    this.grabOffset = null;
  }
  tap(ndc, pointerType) {
    if (this.mode === 'place') {
      const hit = this.pick(ndc);
      if (!hit) return;
      this._positionData(this.ghostData, this.ghost, hit);
      this.placeGhost(); // one tap = placed (undo is one tap away)
      void pointerType;
      return;
    }
    const oid = this._hitOid(ndc);
    if (oid != null) this.select(oid); else this.deselect();
  }
  // shift lock: preview follows the centre crosshair (ignores far-away hits)
  aim(ndc, maxDist = 70) {
    if (this.mode !== 'place' || this.dragging || !this.ghost) return;
    const hit = this.pick(ndc);
    if (hit && hit.point.distanceTo(this.camera.position) < maxDist) this._positionData(this.ghostData, this.ghost, hit);
  }
  hover(ndc) {
    if (this.mode !== 'place' || this.dragging) return;
    const hit = this.pick(ndc);
    if (hit) this._positionData(this.ghostData, this.ghost, hit);
  }

  // ---------- transform tools for the selected object ----------
  _edit(fn, rebuild = false) {
    const o = this.selected;
    if (!o) return;
    this._snapshot();
    fn(o.data, o.root);
    if (rebuild) this._rebuild(o.data.id); else this._applyTransform(o.root, o.data);
    this.emit('transform', o.data);
    this.emit('change');
  }
  _normAngle(a) { a %= Math.PI * 2; if (a < 0) a += Math.PI * 2; return Math.round(a * 1e6) / 1e6; }
  _axisDir(name) {
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f); f.y = 0;
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const v = { forward: f, back: f.clone().negate(), right: r, left: r.clone().negate() }[name];
    return Math.abs(v.x) >= Math.abs(v.z) ? new THREE.Vector3(Math.sign(v.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(v.z));
  }
  nudge(dir) {
    this._edit((d) => {
      if (dir === 'up') d.y = r2(d.y + this.liftStep);
      else if (dir === 'down') d.y = r2(d.y - this.liftStep);
      else { const a = this._axisDir(dir); d.x = r2(d.x + a.x * this.moveStep); d.z = r2(d.z + a.z * this.moveStep); }
    });
  }
  dropToSurface() {
    const o = this.selected; if (!o) return;
    this._edit((d, root) => {
      const ext = this._extents(root);
      const rc = this.raycaster;
      rc.set(new THREE.Vector3(d.x, d.y + ext.min.y + 0.01, d.z), new THREE.Vector3(0, -1, 0));
      let y = this.world.getHeight(d.x, d.z);
      for (const h of rc.intersectObject(this.group, true)) { if (h.object.userData.oid !== d.id) { y = Math.max(y, h.point.y); break; } }
      d.y = r2(y - ext.min.y);
    });
  }
  rotateSelected(dir) {
    if (this.mode === 'place') return this.rotateGhost(dir);
    this._edit((d) => { d.ry = this._normAngle(d.ry + dir * this.rotStep); });
  }
  scaleSelected(dir) {
    const f = dir > 0 ? 1.25 : 0.8;
    const ax = this.scaleAxis;
    this._edit((d) => {
      const c = (v) => Math.sign(v || 1) * r2(THREE.MathUtils.clamp(Math.abs(v) * f, 0.1, 30));
      if (ax === 'all' || ax === 'x') d.sx = c(d.sx);
      if (ax === 'all' || ax === 'y') d.sy = c(d.sy);
      if (ax === 'all' || ax === 'z') d.sz = c(d.sz);
    });
  }
  flipSelected() { this._edit((d) => { d.sx = -d.sx; }); }
  resetScale() { this._edit((d) => { d.sx = d.sy = d.sz = 1; }); }
  setExact(field, value) {
    if (!Number.isFinite(value)) return;
    this._edit((d) => {
      if (field === 'ry') d.ry = this._normAngle(THREE.MathUtils.degToRad(value));
      else d[field] = r2(value);
    });
  }
  setMaterial(mat) { this._edit((d) => { d.mat = mat; d.color = null; }, true); }
  setColor(color) { this._edit((d) => { d.color = color; }, true); }
  duplicateSelected() {
    const o = this.selected; if (!o) return;
    this._snapshot();
    const ext = this._extents(o.root);
    const a = this._axisDir('right');
    const w = a.x ? ext.max.x - ext.min.x : ext.max.z - ext.min.z;
    const d = { ...o.data, x: r2(o.data.x + a.x * w), z: r2(o.data.z + a.z * w) };
    delete d.id;
    const id = this._add(d);
    this.select(id);
    this.emit('change');
  }
  deleteSelected() {
    const o = this.selected; if (!o) return;
    this._snapshot();
    this._remove(o.data.id);
    this.deselect();
    this.emit('change');
  }
  setSnap(on) { this.snap = on; }

  update() {
    const now = performance.now();
    this._animate(Math.min(0.05, (now - this._clock) / 1000));
    this._clock = now;
    const o = this.selected;
    this.selHelper.visible = !!o;
    if (o) this.selHelper.box.setFromObject(o.root).expandByScalar(0.03);
    // mirror previews + mirror line
    for (const c of this.mirrorGhosts) {
      c.matrix.multiplyMatrices(this._mirrorMatrix(c.userData.mirror), this.ghost.matrix);
      c.matrixWorldNeedsUpdate = true;
    }
    const mm = this.mirror.mode, showM = this.mode === 'place' && mm !== 'off';
    const gy = this.world.getHeight(this.mirror.cx, this.mirror.cz);
    for (const pl of this.mirrorPlanes) {
      const ax = pl.userData.axis;
      pl.visible = showM && (mm === 'xz' || mm === ax);
      if (!pl.visible) continue;
      const y = Math.max(gy, this.ghostData?.y ?? gy) + 15;
      if (ax === 'x') { pl.position.set(this.mirror.cx, y, this.ghostData?.z ?? this.mirror.cz); pl.rotation.set(0, Math.PI / 2, 0); }
      else { pl.position.set(this.ghostData?.x ?? this.mirror.cx, y, this.mirror.cz); pl.rotation.set(0, 0, 0); }
    }
    const focus = this.mode === 'place' ? this.ghostData : o?.data;
    this.grid.visible = this.snap && !!focus;
    if (focus) this.grid.position.set(Math.round(focus.x), focus.y + 0.03, Math.round(focus.z));
  }
}
