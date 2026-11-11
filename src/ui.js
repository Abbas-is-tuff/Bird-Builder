// All HTML interface: main menu, HUD, joystick, building library, inspector,
// settings, dialogs and toasts.
import { CATEGORIES, LIBRARY, LIB, getThumbnails } from './library.js';
import { MATERIALS, PALETTE, getTex } from './textures.js';
import { BIRDS, BIRD, getBirdPortraits } from './birds.js';

const P = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  rotL: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  rotR: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  raise: '<path d="M12 19V5M5 12l7-7 7 7"/>', lower: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  drop: '<path d="M12 3v12M6 11l6 6 6-6M4 21h16"/>',
  cube: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  play: '<path d="M6 4l14 8-14 8z"/>', globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  aim: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM20 17v5H6.5A2.5 2.5 0 0 1 4 19.5"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
const fmt = (v, n = 2) => (Math.round(v * 10 ** n) / 10 ** n).toString();

export class UI {
  constructor(app) {
    this.app = app;
    this.build = app.build;
    this.root = $('#ui');
    this.joy = { x: 0, y: 0 };
    this.fly = 0;
    this.inMenu = true;
    this.libCat = 'structures';
    this.inspTab = 'move';
    this.root.innerHTML = this.template();
    this.bind();
    this.wireBuild();
    this.refreshMenu();
    this.layout();
  }

  template() {
    return `
    <div class="layer hidden" id="game">
      <div class="hud-top">
        <button class="btn" data-a="menu" aria-label="Main menu">${icon('menu')}</button>
        <button class="btn birdbtn" data-a="pickBird" aria-label="Change bird"><span class="bimg" id="hudBird"></span><span id="hudBirdName"></span></button>
        <div class="chip" id="modeChip">BUILD MODE</div>
        <div class="spacer"></div>
        <div class="hud-group">
          <button class="btn" data-a="undo" id="undoBtn" aria-label="Undo">${icon('undo')}</button>
          <button class="btn" data-a="redo" id="redoBtn" aria-label="Redo">${icon('redo')}</button>
          <button class="btn on" data-a="snap" id="snapBtn" aria-label="Grid snapping">${icon('grid')}<span>1m</span></button>
          <button class="btn" data-a="save" aria-label="Save">${icon('save')}</button>
          <button class="btn" data-a="settings" aria-label="Settings">${icon('gear')}</button>
        </div>
      </div>
      <div class="chip hidden" id="fps">-- FPS</div>
      <div class="hint hidden" id="hint"></div>
      <div class="joy" id="joy"><div class="knob"></div></div>
      <div class="crosshair hidden" id="crosshair"></div>
      <div class="flypad" id="flypad">
        <button class="btn fly lockbtn" data-a="shiftLock" id="lockBtn" aria-label="Shift lock">${icon('aim')}<span>LOCK</span></button>
        <button class="btn fly" id="flyUp" aria-label="Fly up">${icon('raise')}<span>FLY</span></button>
        <button class="btn fly" id="flyDown" aria-label="Fly down">${icon('lower')}<span>LAND</span></button>
      </div>
      <div class="hint hidden" id="placeLabel"></div>
      <div class="bottom-center with-joy" id="buildWrap">
        <button class="btn primary" id="buildBtn" data-a="library">${icon('plus')} BUILD</button>
      </div>
      <div class="placebar hidden" id="placebar">
        <button class="btn primary placebtn" data-a="place">${icon('check')} PLACE<span id="placeCount"></span></button>
        <div class="row pat">
          <button class="btn" data-a="patShape" id="patShape" aria-label="Repeat shape"></button>
          <button class="btn" data-a="patCount" id="patCount" aria-label="How many"></button>
          <button class="btn" data-a="patTall" id="patTall" aria-label="How tall"></button>
        </div>
        <div class="row">
          <button class="btn" data-a="ghostRotL" aria-label="Rotate left">${icon('rotL')}</button>
          <button class="btn" data-a="ghostRotR" aria-label="Rotate right">${icon('rotR')}</button>
          <button class="btn" data-a="library" aria-label="Choose another">${icon('cube')}</button>
          <button class="btn" data-a="stopPlace" aria-label="Done">${icon('x')}</button>
        </div>
      </div>
      <div class="sheet hidden" id="library">
        <div class="sheet-head"><div class="sheet-title">Building Library <small>${LIBRARY.length} objects</small></div>
          <button class="btn" data-a="closeLibrary" aria-label="Close">${icon('x')}</button></div>
        <div class="tabs" id="libTabs"></div>
        <div class="grid" id="libGrid"></div>
      </div>
      <div class="sheet hidden" id="inspector">
        <div class="sheet-head"><div class="sheet-title" id="inspTitle"></div>
          <button class="btn" data-a="deselect" aria-label="Close">${icon('x')}</button></div>
        <div class="body">
          <div class="seg" id="inspTabs">
            <button data-tab="move">Move</button><button data-tab="size">Size</button><button data-tab="look">Material</button>
          </div>
          <div id="inspBody"></div>
        </div>
        <div class="actions">
          <button class="btn" data-a="duplicate">${icon('copy')} Duplicate</button>
          <button class="btn danger" data-a="delete">${icon('trash')} Delete</button>
        </div>
      </div>
    </div>
    <div class="layer" id="menuLayer">
      <div id="menu"><div class="menu-inner">
        <div class="logo">BIRD<br><span>BUILDER</span></div>
        <div class="tagline">Ultimate Sandbox</div>
        <div class="menu-btns">
          <button class="btn primary" data-a="play">${icon('play')} Play <span class="sub" id="playSub"></span></button>
          <button class="btn" data-a="pickBird"><span class="bimg sm" id="menuBird"></span> Choose Bird <span class="sub" id="menuBirdName"></span></button>
          <button class="btn" data-a="newWorld">${icon('globe')} Create World <span class="sub">fresh map</span></button>
          <button class="btn" data-a="openLibraryFromMenu">${icon('book')} Building Library <span class="sub">${LIBRARY.length} objects</span></button>
          <button class="btn" data-a="settings">${icon('gear')} Settings <span class="sub">graphics · time</span></button>
        </div>
        <div class="menu-foot">Stage 1 build · your world saves automatically on this device.</div>
      </div></div>
    </div>
    <div class="layer hidden" id="modalLayer"></div>
    <div class="layer" id="toastLayer" style="pointer-events:none"></div>`;
  }

  // ---------------- wiring ----------------
  bind() {
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b || b.disabled) return;
      const fn = this.actions[b.dataset.a];
      if (fn) fn.call(this, b, e);
    });
    // prevent canvas gestures from starting on UI panels
    this.root.addEventListener('pointerdown', (e) => { if (e.target.closest('.btn,.sheet,.modal,.joy,.hint,#menu')) e.stopPropagation(); });

    const tabs = $('#libTabs');
    tabs.innerHTML = CATEGORIES.map((c) => `<button class="tab" data-cat="${c.id}">${c.label}</button>`).join('');
    tabs.addEventListener('click', (e) => { const t = e.target.closest('[data-cat]'); if (t) { this.libCat = t.dataset.cat; this.renderLibrary(); } });
    $('#libGrid').addEventListener('click', (e) => {
      const c = e.target.closest('[data-item]');
      if (!c) return;
      this.closeLibrary();
      this.build.startPlacing(c.dataset.item);
    });
    $('#inspTabs').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) { this.inspTab = t.dataset.tab; this.renderInspector(); } });

    // joystick
    const joy = $('#joy'), knob = joy.querySelector('.knob');
    let jid = null;
    const setJoy = (e) => {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const max = r.width / 2 - 16, l = Math.hypot(dx, dy);
      if (l > max) { dx *= max / l; dy *= max / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / max; this.joy.y = -dy / max;
    };
    joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(e.pointerId); setJoy(e); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJoy(e); });
    const end = (e) => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; this.joy.x = this.joy.y = 0; };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    const hold = (el, v) => {
      el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); this.fly = v; el.classList.add('on'); });
      const rel = () => { if (this.fly === v) this.fly = 0; el.classList.remove('on'); };
      el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel);
    };
    hold($('#flyUp'), 1); hold($('#flyDown'), -1);

    window.addEventListener('resize', () => this.layout());
    this.refreshBird();
    setTimeout(() => { this.portraits ??= getBirdPortraits(); this.refreshBird(); }, 120);
  }

  onShiftLock(on) {
    $('#lockBtn').classList.toggle('on', on);
    this.toast(on ? 'Shift Lock ON — aim with the +' : 'Shift Lock OFF');
    this.layout();
    if (this.build.mode === 'place') this.setPlaceLabel();
  }

  updatePattern() {
    const p = this.build.pattern;
    $('#patShape').innerHTML = `<small>REPEAT</small>${{ row: 'ROW', room: 'ROOM', grid: 'GRID' }[p.shape]}`;
    $('#patCount').innerHTML = `<small>${p.shape === 'row' ? 'PIECES' : 'PER SIDE'}</small>×${p.count}`;
    $('#patTall').innerHTML = `<small>LEVELS</small>↑${p.tall}`;
    const n = this.build.patternSize;
    $('#placeCount').textContent = n > 1 ? ` ×${n}` : '';
  }

  setPlaceLabel() {
    const name = this._placeName || '';
    const touch = matchMedia('(pointer:coarse)').matches;
    $('#placeLabel').innerHTML = this.app.isShiftLock?.()
      ? `<span><b>${esc(name)}</b> · aim with the <b>+</b> and ${touch ? 'tap anywhere' : 'click'} (or press <b>PLACE</b>)</span>`
      : `<span><b>${esc(name)}</b> · tap the ground to place it there, or walk and press <b>PLACE</b></span>`;
  }

  refreshBird() {
    const id = this.app.settings.bird || 'cookie';
    const def = BIRD[id];
    const p = this.portraits;
    for (const el of [$('#hudBird'), $('#menuBird')]) el.style.backgroundImage = p?.[id] ? `url(${p[id]})` : '';
    $('#hudBirdName').textContent = def.name;
    $('#menuBirdName').textContent = def.name;
  }

  openBirdPicker(thenPlay) {
    this.portraits ??= getBirdPortraits();
    this.refreshBird();
    const cur = this.app.settings.bird;
    const m = this.openModal(`<h2>Choose your bird</h2><p>Walk, fly and build as one of your birds. The others will hang out with you.</p>
      <div class="birds">${BIRDS.map((b) => `<button class="birdcard ${cur === b.id ? 'on' : ''}" data-bird="${b.id}">
        <img alt="" src="${this.portraits[b.id] || ''}"><b>${esc(b.name)}</b><small>${esc(b.species)}</small></button>`).join('')}</div>`);
    m.querySelector('.birds').addEventListener('click', (e) => {
      const c = e.target.closest('[data-bird]'); if (!c) return;
      this.app.settings.bird = c.dataset.bird; this.app.saveSettings();
      this.app.setPlayerBird(c.dataset.bird, true);
      this.refreshBird();
      this.closeModal();
      if (thenPlay || !this.inMenu) { this.showMenu(false); this.toast(`Playing as ${BIRD[c.dataset.bird].name}`); }
    });
  }

  showTutorial() {
    const name = BIRD[this.app.settings.bird || 'cookie'].name;
    const touch = matchMedia('(pointer:coarse)').matches;
    this.openModal(`<h2>Hi, ${esc(name)}!</h2>
      <div class="steps">
        <div><i>1</i><span><b>Move</b> with the joystick${touch ? '' : ' (or WASD)'}. Drag the screen to look around${touch ? ', pinch to zoom' : ', scroll to zoom'}.</span></div>
        <div><i>2</i><span>Hold <b>FLY</b> to take off, <b>LAND</b> to come down${touch ? '' : ' (Space / X)'}.</span></div>
        <div><i>3</i><span>Tap <b>BUILD</b>, pick something, then <b>tap the ground</b> to place it — or press <b>PLACE</b> to drop it in front of you.</span></div>
        <div><i>4</i><span><b>Tap anything</b> you built to move, recolour or delete it. Made a mistake? Press <b>Undo</b>.</span></div>
        <div><i>★</i><span>Tip: turn on <b>LOCK</b>${touch ? '' : ' (Shift)'} to aim with a <b>+</b> — whatever you're building goes exactly where you point.</span></div>
      </div>
      <div class="foot"><button class="btn primary" data-a="tutorialDone">Let's build!</button></div>`);
  }

  wireBuild() {
    const b = this.build;
    b.on('select', (d) => {
      this.layout();
      if (d) { this.renderInspector(); if (!this.isWide()) this.app.rig.flyTo(d.x, d.z); }
    });
    b.on('transform', () => this.updateInspectorValues());
    b.on('mode', (m, def) => {
      if (m === 'place') {
        this._placeName = def.name;
        this.setPlaceLabel();
        this.updatePattern();
      }
      this.layout();
    });
    b.on('history', () => {
      $('#undoBtn').disabled = !b.history.length;
      $('#redoBtn').disabled = !b.future.length;
    });
    b.on('placed', () => this.flashPlace());
    b.on('pattern', () => this.updatePattern());
  }

  actions = {
    menu() { this.app.save(); this.showMenu(true); },
    play() { if (!this.app.settings.bird) this.openBirdPicker(true); else this.showMenu(false); },
    pickBird() { this.openBirdPicker(false); },
    shiftLock() { this.app.setShiftLock(!this.app.isShiftLock()); },
    patShape() {
      const order = ['row', 'room', 'grid'];
      const p = this.build.pattern;
      const next = order[(order.indexOf(p.shape) + 1) % order.length];
      this.build.setPattern({ shape: next, count: p.count === 1 && next !== 'row' ? 2 : p.count });
      this.toast({ row: 'Row — pieces side by side', room: 'Room — 4 walls around a square', grid: 'Grid — fills a square (great for floors)' }[next]);
    },
    patCount() {
      const steps = [1, 2, 3, 4, 5, 6, 8, 10];
      const p = this.build.pattern;
      this.build.setPattern({ count: steps[(steps.indexOf(p.count) + 1) % steps.length] });
    },
    patTall() {
      const p = this.build.pattern;
      this.build.setPattern({ tall: p.tall % 4 + 1 });
      this.toast(p.tall === 1 ? '1 level' : `${p.tall} levels tall`);
    },
    newWorld() {
      const fresh = () => { this.app.newWorld(); this.toast('New world created'); this.actions.play.call(this); };
      if (this.app.hasSave()) this.confirm('Create a new world?', 'Your current world on this device will be replaced with a fresh map.', 'Create World', fresh);
      else fresh();
    },
    openLibraryFromMenu() { this.showMenu(false); this.openLibrary(); },
    tutorialDone() { this.app.settings.hintDone = true; this.app.saveSettings(); this.closeModal(); },
    settings() { this.openSettings(); },
    undo() { this.build.undo(); },
    redo() { this.build.redo(); },
    snap(btn) {
      const on = !this.build.snap;
      this.build.setSnap(on);
      this.app.settings.snap = on; this.app.saveSettings();
      this.updateSnapBtn();
      this.toast(on ? 'Grid snapping ON (1 m)' : 'Free placement');
      void btn;
    },
    save() { this.toast(this.app.save() ? 'World saved' : 'Could not save on this device'); },
    library() { this.openLibrary(); },
    closeLibrary() { this.closeLibrary(); },
    place() { this.build.placeGhost(); },
    ghostRotL() { this.build.rotateGhost(1); },
    ghostRotR() { this.build.rotateGhost(-1); },
    stopPlace() { this.build.stopPlacing(); },
    deselect() { this.build.deselect(); },
    duplicate() { this.build.duplicateSelected(); this.toast('Duplicated'); },
    delete() { this.build.deleteSelected(); },
    nudge(b) { this.build.nudge(b.dataset.dir); },
    rotSel(b) { this.build.rotateSelected(+b.dataset.dir); },
    drop() { this.build.dropToSurface(); },
    scale(b) { this.build.scaleSelected(+b.dataset.dir); },
    axis(b) { this.build.scaleAxis = b.dataset.axis; this.renderInspector(); },
    resetScale() { this.build.resetScale(); },
    mat(b) { this.build.setMaterial(b.dataset.mat); this.renderInspector(); },
    color(b) { this.build.setColor(b.dataset.color || null); this.renderInspector(); },
    closeModal() { this.closeModal(); },
    dismissHint() { this.app.settings.hintDone = true; this.app.saveSettings(); this.updateHint(); },
  };

  isWide() { return innerWidth >= 900 && innerHeight >= 500; }
  // pixels of screen hidden by a bottom sheet (used to shift the 3D view up)
  coveredBottom() {
    if (this.inMenu || this.isWide()) return 0;
    for (const id of ['inspector', 'library']) {
      const el = document.getElementById(id);
      if (!el.classList.contains('hidden')) return el.offsetHeight;
    }
    return 0;
  }

  // ---------------- layout / visibility ----------------
  layout() {
    const g = $('#game');
    g.classList.toggle('hidden', this.inMenu);
    $('#menuLayer').classList.toggle('hidden', !this.inMenu);
    const libOpen = !$('#library').classList.contains('hidden');
    const placing = this.build.mode === 'place';
    const sel = !!this.build.selected && !placing;
    const wide = innerWidth >= 900 && innerHeight >= 500;
    $('#inspector').classList.toggle('hidden', !sel || libOpen);
    $('#placebar').classList.toggle('hidden', !placing || libOpen);
    $('#placeLabel').classList.toggle('hidden', !placing || libOpen);
    $('#buildWrap').classList.toggle('hidden', placing || libOpen || (sel && !wide));
    g.classList.toggle('placing', placing);
    const joyOff = !wide && (libOpen || sel);
    $('#joy').classList.toggle('hidden', joyOff);
    $('#flypad').classList.toggle('hidden', joyOff);
    $('#crosshair').classList.toggle('hidden', !this.app.isShiftLock?.() || libOpen || this.inMenu);
    $('#modeChip').textContent = placing ? 'PLACING' : sel ? 'EDITING' : 'BUILD MODE';
    this.app.input.enabled = !this.inMenu;
    this.updateHint();
    if (!this.inMenu && !this.app.settings.hintDone && $('#modalLayer').classList.contains('hidden')) this.showTutorial();
  }

  showMenu(on) {
    this.inMenu = on;
    if (on) { if (this.app.isShiftLock?.()) this.app.setShiftLock(false); this.build.stopPlacing(); this.build.deselect(); this.closeLibrary(false); this.app.input.cancelAll(); }
    this.refreshMenu();
    this.layout();
  }
  refreshMenu() { $('#playSub').textContent = this.app.hasSave() ? 'continue' : 'start building'; }

  updateSnapBtn() {
    const b = $('#snapBtn');
    b.classList.toggle('on', this.build.snap);
    b.querySelector('span').textContent = this.build.snap ? '1m' : 'Free';
  }

  updateHint() { $('#hint').classList.add('hidden'); } // replaced by the tutorial card

  // ---------------- library ----------------
  openLibrary() {
    if (this.build.mode === 'place') this.build.stopPlacing();
    this.build.deselect();
    $('#library').classList.remove('hidden');
    this.renderLibrary();
    this.layout();
    if (!this.thumbs) {
      setTimeout(() => { this.thumbs = getThumbnails(); this.renderLibrary(); }, 30);
    }
  }
  closeLibrary(relayout = true) {
    $('#library').classList.add('hidden');
    if (relayout) this.layout();
  }
  renderLibrary() {
    $('#libTabs').querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.cat === this.libCat));
    const items = LIBRARY.filter((d) => d.cat === this.libCat);
    $('#libGrid').innerHTML = items.map((d) => {
      const src = this.thumbs?.[d.id];
      return `<button class="card" data-item="${d.id}">${src ? `<img alt="" src="${src}">` : `<div class="ph">${icon('cube')}</div>`}<span>${esc(d.name)}</span></button>`;
    }).join('');
  }

  // ---------------- inspector ----------------
  renderInspector() {
    const o = this.build.selected;
    if (!o) return;
    const d = o.data, def = LIB[d.type];
    $('#inspTitle').innerHTML = `${esc(def.name)} <small>#${d.id}</small>`;
    $('#inspTabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.inspTab));
    const body = $('#inspBody');
    if (this.inspTab === 'move') {
      body.innerHTML = `
        <div class="tools">
          <div class="dpad">
            <span></span><button class="btn" data-a="nudge" data-dir="forward" aria-label="Forward">${icon('up')}</button><span></span>
            <button class="btn" data-a="nudge" data-dir="left" aria-label="Left">${icon('left')}</button><span class="c">MOVE</span><button class="btn" data-a="nudge" data-dir="right" aria-label="Right">${icon('right')}</button>
            <span></span><button class="btn" data-a="nudge" data-dir="back" aria-label="Back">${icon('down')}</button><span></span>
          </div>
          <div class="col"><span class="lbl">HEIGHT</span>
            <button class="btn" data-a="nudge" data-dir="up" aria-label="Raise">${icon('raise')}</button>
            <button class="btn" data-a="nudge" data-dir="down" aria-label="Lower">${icon('lower')}</button></div>
          <div class="col"><span class="lbl">ROTATE</span>
            <button class="btn" data-a="rotSel" data-dir="1" aria-label="Rotate left">${icon('rotL')}</button>
            <button class="btn" data-a="rotSel" data-dir="-1" aria-label="Rotate right">${icon('rotR')}</button></div>
        </div>
        <div class="exact">
          ${['x', 'y', 'z', 'ry'].map((f) => `<label>${f === 'ry' ? 'ROT °' : f.toUpperCase()}<input inputmode="decimal" data-f="${f}" /></label>`).join('')}
        </div>
        <div class="row-btns"><button class="btn" data-a="drop">${icon('drop')} Drop to surface</button></div>`;
      body.querySelectorAll('input[data-f]').forEach((inp) => {
        const commit = () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) this.build.setExact(inp.dataset.f, v); else this.updateInspectorValues(true); };
        inp.addEventListener('change', commit);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
      });
    } else if (this.inspTab === 'size') {
      const ax = this.build.scaleAxis;
      body.innerHTML = `
        <div class="sizebox">
          <div class="axis">${[['all', 'Uniform'], ['x', 'Width'], ['y', 'Height'], ['z', 'Depth']].map(([k, l]) => `<button class="tab ${ax === k ? 'on' : ''}" data-a="axis" data-axis="${k}">${l}</button>`).join('')}</div>
          <div class="row">
            <button class="btn step" data-a="scale" data-dir="-1" aria-label="Smaller">${icon('minus')}</button>
            <div class="dims" id="dims"></div>
            <button class="btn step" data-a="scale" data-dir="1" aria-label="Bigger">${icon('plus')}</button>
          </div>
          <button class="btn" data-a="resetScale">Reset size</button>
        </div>`;
    } else {
      const matPrev = (k) => {
        const m = MATERIALS[k];
        if (m.tex) { try { return `background-image:url(${getTex(m.tex).image.toDataURL()})`; } catch { /* ignore */ } }
        return `background:${m.color}`;
      };
      this._matPrev ??= Object.fromEntries(Object.keys(MATERIALS).map((k) => [k, matPrev(k)]));
      body.innerHTML = `
        <div class="sub-h">Material</div>
        <div class="mats">${Object.entries(MATERIALS).map(([k, m]) => `<button class="mat ${d.mat === k ? 'on' : ''}" data-a="mat" data-mat="${k}"><i style="${this._matPrev[k]}"></i>${m.label}</button>`).join('')}</div>
        <div class="sub-h">Colour</div>
        <div class="swatches">${PALETTE.map((c) => `<button class="sw ${c ? '' : 'def'} ${(d.color || null) === c ? 'on' : ''}" data-a="color" data-color="${c || ''}" ${c ? `style="background:${c}"` : ''} aria-label="${c || 'Default colour'}"></button>`).join('')}</div>`;
    }
    this.updateInspectorValues(true);
  }

  updateInspectorValues(force = false) {
    const o = this.build.selected;
    if (!o) return;
    const d = o.data;
    document.querySelectorAll('#inspBody input[data-f]').forEach((inp) => {
      if (!force && document.activeElement === inp) return;
      inp.value = inp.dataset.f === 'ry' ? fmt((d.ry * 180) / Math.PI, 1) : fmt(d[inp.dataset.f]);
    });
    const dims = $('#dims');
    if (dims) {
      const e = this.build._extents(o.root);
      dims.innerHTML = `${fmt(e.max.x - e.min.x, 1)} × ${fmt(e.max.y - e.min.y, 1)} × ${fmt(e.max.z - e.min.z, 1)} m<br>scale ${fmt(d.sx)} / ${fmt(d.sy)} / ${fmt(d.sz)}`;
    }
  }

  flashPlace() {
    const b = document.querySelector('#placebar .btn.primary');
    if (!b) return;
    b.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 180 });
  }

  // ---------------- modals ----------------
  openModal(html) {
    const l = $('#modalLayer');
    l.innerHTML = `<div class="modal-wrap"><div class="modal">${html}</div></div>`;
    l.classList.remove('hidden');
    l.querySelector('.modal-wrap').addEventListener('click', (e) => { if (e.target.classList.contains('modal-wrap')) this.closeModal(); });
    this.app.input.enabled = false;
    return l.querySelector('.modal');
  }
  closeModal() {
    const l = $('#modalLayer');
    l.classList.add('hidden'); l.innerHTML = '';
    this.app.input.enabled = !this.inMenu;
  }
  confirm(title, text, okLabel, onOk) {
    const m = this.openModal(`<h2>${esc(title)}</h2><p>${esc(text)}</p>
      <div class="foot"><button class="btn" data-a="closeModal">Cancel</button><button class="btn primary" id="okBtn">${esc(okLabel)}</button></div>`);
    m.querySelector('#okBtn').addEventListener('click', () => { this.closeModal(); onOk(); });
  }
  openSettings() {
    const s = this.app.settings;
    const m = this.openModal(`
      <h2>Settings</h2>
      <div class="sect sub-h">Graphics quality</div>
      <div class="seg" id="qSeg">${['low', 'medium', 'high', 'ultra'].map((q) => `<button data-q="${q}" class="${s.quality === q ? 'on' : ''}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div>
      <p style="margin-top:0">Low and Medium are best for phones. Ultra adds sharper shadows, denser forests and more grass.</p>
      <div class="sect sub-h">Time of day <span class="time-val" id="tVal">${fmtTime(s.time)}</span></div>
      <input type="range" class="slider" id="tSlider" min="0" max="24" step="0.25" value="${s.time}">
      <div class="toggle-row">Show FPS counter <button class="switch ${s.showFps ? 'on' : ''}" id="fpsSw" aria-label="Show FPS"></button></div>
      <div class="sect sub-h">Controls</div>
      <div class="help">
        <b>Look around:</b> drag with one finger (mouse: left-drag)<br>
        <b>Zoom:</b> pinch (mouse: scroll wheel)<br>
        <b>Pan / twist:</b> two fingers (mouse: right-drag)<br>
        <b>Move:</b> joystick (keyboard: WASD, Q/E to turn)<br>
        <b>Build:</b> BUILD → pick an object → drag the preview → PLACE<br>
        <b>Edit:</b> tap an object, then drag it or use the panel<br>
        <b>Keys:</b> R rotate · Delete remove · Ctrl+Z / Ctrl+Y undo/redo
      </div>
      <div class="foot"><button class="btn primary" data-a="closeModal">Done</button></div>`);
    m.querySelector('#qSeg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      s.quality = b.dataset.q; this.app.applySettings(); this.app.saveSettings();
      m.querySelectorAll('#qSeg button').forEach((x) => x.classList.toggle('on', x === b));
    });
    const sl = m.querySelector('#tSlider');
    sl.addEventListener('input', () => { s.time = +sl.value; m.querySelector('#tVal').textContent = fmtTime(s.time); this.app.world.setTimeOfDay(s.time); });
    sl.addEventListener('change', () => { this.app.saveSettings(); this.app.world._updateEnv(s.time); });
    m.querySelector('#fpsSw').addEventListener('click', (e) => {
      s.showFps = !s.showFps; e.currentTarget.classList.toggle('on', s.showFps); this.app.applySettings(); this.app.saveSettings();
    });
  }

  toast(msg) {
    const l = $('#toastLayer');
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    l.innerHTML = ''; l.appendChild(t);
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.remove(), 1600);
  }

  setFps(v) { $('#fps').textContent = `${v} FPS`; }
}
