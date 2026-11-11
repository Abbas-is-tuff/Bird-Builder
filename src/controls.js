// Camera rig (orbit around a ground target) + unified touch/mouse/keyboard input.
import * as THREE from 'three';
import { HALF } from './world.js';

export class CameraRig {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.target = new THREE.Vector3(0, world.getHeight(0, 0), 12);
    this.yaw = 0.7;
    this.pitch = 0.5;
    this.dist = 42;
    this.move = new THREE.Vector2(); // joystick/keyboard (-1..1)
    this.shoulder = 0; // 0..1, over-the-shoulder offset used by shift lock
    this.shoulderGoal = 0;
    this.turn = 0;
  }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  orbit(dx, dy) {
    this.yaw -= dx * 0.0055;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0045, 0.06, 1.5);
  }
  flyTo(x, z) { this.goal = { x, z }; }
  pan(dx, dy) {
    if (this.follow) return; // camera is attached to the bird
    this.goal = null;
    const k = this.dist * 0.0016;
    this.target.addScaledVector(this.right(), -dx * k).addScaledVector(this.forward(), dy * k);
  }
  zoom(f) { this.dist = THREE.MathUtils.clamp(this.dist * f, 2.5, 420); }
  toJSON() { return { x: this.target.x, y: this.target.y, z: this.target.z, yaw: this.yaw, pitch: this.pitch, dist: this.dist }; }
  fromJSON(j) {
    if (!j) return;
    this.target.set(j.x, j.y, j.z); this.yaw = j.yaw; this.pitch = j.pitch; this.dist = j.dist;
  }
  update(dt) {
    if (this.follow) {
      this.shoulder += (this.shoulderGoal - this.shoulder) * Math.min(1, dt * 8);
      const r = this.right().multiplyScalar(this.shoulder * 1.4);
      const f = this.follow;
      const k = Math.min(1, dt * (this.shoulderGoal ? 20 : 9));
      this.target.x += (f.x + r.x - this.target.x) * k;
      this.target.z += (f.z + r.z - this.target.z) * k;
      this.target.y += (f.y + 0.9 - this.target.y) * k;
      this.yaw -= this.turn * dt * 1.6;
      return this._place();
    }
    const speed = (12 + this.dist * 0.9) * dt;
    if (this.goal) {
      this.target.x += (this.goal.x - this.target.x) * Math.min(1, dt * 5);
      this.target.z += (this.goal.z - this.target.z) * Math.min(1, dt * 5);
      if (Math.hypot(this.goal.x - this.target.x, this.goal.z - this.target.z) < 0.05) this.goal = null;
    }
    if (this.move.lengthSq() > 0) {
      this.goal = null;
      this.target.addScaledVector(this.right(), this.move.x * speed).addScaledVector(this.forward(), this.move.y * speed);
    }
    this.yaw -= this.turn * dt * 1.6;
    const lim = HALF - 5;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -lim, lim);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -lim, lim);
    const ground = Math.max(0, this.world.getHeight(this.target.x, this.target.z));
    this.target.y += (ground - this.target.y) * Math.min(1, dt * 6);

    this._place();
  }
  _place() {
    const cp = Math.cos(this.pitch);
    const pos = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.dist).add(this.target);
    const g = this.world.getHeight(pos.x, pos.z) + 1.2;
    if (pos.y < g) pos.y = g;
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }
}

export class Input {
  constructor(canvas, rig, build) {
    this.canvas = canvas; this.rig = rig; this.build = build;
    this.pointers = new Map();
    this.state = 'none';
    this.keys = new Set();
    this.shiftLock = false;
    this.onShiftKey = null; // set by main
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    this.enabled = true;
    const on = (t, f, o) => canvas.addEventListener(t, f, o);
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.moveEv(e));
    on('pointerup', (e) => this.up(e, false));
    on('pointercancel', (e) => this.up(e, true));
    on('wheel', (e) => { e.preventDefault(); if (this.enabled) this.rig.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    on('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? build.redo() : build.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); build.redo(); }
      else if (e.code === 'Delete' || e.code === 'Backspace') build.deleteSelected();
      else if (e.code === 'KeyE') this.onUseKey?.();
      else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) this.onShiftKey?.();
      else if (e.code === 'KeyR') build.rotateSelected(e.shiftKey ? -1 : 1);
      else if (e.code === 'Escape') { build.mode === 'place' ? build.stopPlacing() : build.deselect(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  ndc(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  down(e) {
    if (!this.enabled) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (this.pointers.size === 1) {
      this.state = 'pending';
      this.pType = e.pointerType;
      this.button = e.button;
      this.shift = e.shiftKey && !this.shiftLock;
    } else if (this.pointers.size === 2) {
      if (this.state === 'buildDrag') this.build.endDrag();
      this.state = 'gesture';
      this.gesture = this.gestureInfo();
    }
  }

  gestureInfo() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  moveEv(e) {
    if (!this.enabled) return;
    if (this.locked) { this.rig.orbit(e.movementX * 0.7, e.movementY * 0.7); return; } // mouse look
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse' && e.buttons === 0 && !this.shiftLock) this.build.hover(this.ndc(e.clientX, e.clientY));
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;

    if (this.state === 'pending') {
      const moved = Math.hypot(p.x - p.sx, p.y - p.sy);
      if (moved > (this.pType === 'mouse' ? 4 : 9)) {
        if (this.button === 0 && !this.shift && this.build.beginDrag(this.ndc(p.sx, p.sy))) {
          this.state = 'buildDrag';
          this.build.dragMove(this.ndc(p.x, p.y));
        } else {
          this.state = this.button === 2 || this.button === 1 || this.shift ? 'pan' : 'orbit';
        }
      }
      return;
    }
    if (this.state === 'orbit') this.rig.orbit(dx, dy);
    else if (this.state === 'pan') this.rig.pan(dx, dy);
    else if (this.state === 'buildDrag') this.build.dragMove(this.ndc(p.x, p.y));
    else if (this.state === 'gesture' && this.pointers.size >= 2) {
      const g = this.gestureInfo();
      if (g.d > 10 && this.gesture.d > 10) this.rig.zoom(this.gesture.d / g.d);
      this.rig.pan(g.mx - this.gesture.mx, g.my - this.gesture.my);
      let da = g.ang - this.gesture.ang;
      if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
      this.rig.yaw += da;
      this.gesture = g;
    }
  }

  up(e, cancelled) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (!cancelled && this.state === 'pending') {
      // shift lock: aim with the centre "+" (always with a locked mouse, and when placing on touch)
      const aim = this.locked || (this.shiftLock && this.build.mode === 'place');
      this.build.tap(aim ? new THREE.Vector2(0, 0) : this.ndc(p.x, p.y), e.pointerType);
    }
    if (this.state === 'buildDrag') this.build.endDrag();
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 1) {
      // one finger left after a pinch: continue as orbit
      const q = [...this.pointers.values()][0];
      q.sx = q.x; q.sy = q.y;
      this.state = 'orbit';
    } else if (this.pointers.size === 0) this.state = 'none';
  }

  cancelAll() {
    if (this.state === 'buildDrag') this.build.endDrag();
    this.pointers.clear();
    this.state = 'none';
  }

  // returns movement intent: x/y from joystick + keys, vert from fly buttons + keys
  update(joy, fly = 0) {
    const k = this.keys;
    let x = joy.x, y = joy.y;
    let vert = fly;
    if (k.has('Space')) vert += 1;
    if (k.has('KeyX') || k.has('KeyC')) vert -= 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    this.rig.turn = 0;
    if (!this.enabled) { x = y = vert = 0; }
    const v = new THREE.Vector2(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
    if (v.length() > 1) v.normalize();
    return { x: v.x, y: v.y, vert: THREE.MathUtils.clamp(vert, -1, 1) };
  }
}
