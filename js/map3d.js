// js/map3d.js
// The canvas. It takes the model js/scene.js built and draws it with three.js.
// Every decision above this file is already made: the objects, their positions,
// their tone and the words about them come from the model. This file chooses
// geometry, camera and colour, and nothing else.
//
// Rules kept here:
//   1. Colour comes from a CSS token, so the canvas follows the stylesheet and
//      the same tone cannot look like two different things on one page.
//   2. A state the core has no tone for is drawn as an outline, not as a colour.
//   3. Everything this file allocates, it also frees in dispose().

import * as THREE from '../vendor/three.module.js';

const TONE_VAR = {
  ok: '--ok',
  low: '--low',
  medium: '--medium',
  high: '--high',
  muted: '--ink-3',
  accent: '--accent',
  unknown: '--unknown'
};

// Used when there is no stylesheet to read, which happens only outside a page.
const TONE_FALLBACK = {
  ok: '#1f6b45',
  low: '#3f5a72',
  medium: '#8a5a06',
  high: '#a3231d',
  muted: '#6d7c8b',
  accent: '#1b496b',
  unknown: '#6b5b7b'
};

function cssValue(name, fallback) {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
  if (typeof document === 'undefined' || !document.documentElement) return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function toneColour(tone) {
  const key = Object.prototype.hasOwnProperty.call(TONE_VAR, tone) ? tone : 'unknown';
  return cssValue(TONE_VAR[key], TONE_FALLBACK[key]);
}

const SIZES = { sphereSegments: 24, sphereRings: 16, lineOpacity: 0.32 };

// One camera, moved by spherical angles. Kept out of three.js's own controls
// because there is nothing to install: this is a drag and a wheel.
const VIEW = {
  yaw: -0.62,
  pitch: 0.72,
  distance: 30,
  minDistance: 8,
  maxDistance: 64,
  minPitch: 0.08,
  maxPitch: 1.45
};

export function createMap(options = {}) {
  const { canvas, overlay, model } = options;
  if (!canvas || !model || !Array.isArray(model.nodes)) {
    throw new Error('createMap needs a canvas and a scene model');
  }
  if (typeof canvas.getContext !== 'function' || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    throw new Error('this browser cannot draw a canvas');
  }

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const groups = new Map(); // layer id -> Group
  const materials = new Map(); // tone -> material
  const meshes = []; // raycast targets
  const byMeshId = new Map(); // mesh uuid -> node
  const pulses = []; // nodes that throb while they ask for a person
  const labels = []; // { node, element, position }
  const reduced = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const listeners = [];
  let frame = 0;
  let stopped = false;
  let hovered = null;
  let selected = null;
  let dragging = false;
  let moved = 0;
  let lastPointer = { x: 0, y: 0 };
  const pointers = new Map();
  let pinchStart = 0;

  const geometry = {
    sphere: new THREE.SphereGeometry(1, SIZES.sphereSegments, SIZES.sphereRings),
    tick: new THREE.SphereGeometry(1, 10, 8)
  };

  function addListener(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    listeners.push(() => target.removeEventListener(type, handler, opts));
  }

  function material(tone) {
    const key = Object.prototype.hasOwnProperty.call(TONE_VAR, tone) ? tone : 'unknown';
    if (!materials.has(key)) {
      const colour = toneColour(key);
      materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(colour),
          roughness: 0.42,
          metalness: 0.08,
          // A state with no tone is drawn as an outline, so it cannot be
          // mistaken for one that has a meaning.
          wireframe: key === 'unknown',
          transparent: key === 'unknown',
          opacity: key === 'unknown' ? 0.85 : 1
        })
      );
    }
    return materials.get(key);
  }

  function group(layer) {
    if (!groups.has(layer)) {
      const created = new THREE.Group();
      created.name = layer;
      scene.add(created);
      groups.set(layer, created);
    }
    return groups.get(layer);
  }

  // -- light --------------------------------------------------------------
  // Flat and even. A highlight here is a shadow, and a shadow on a map would
  // read as a meaning nobody wrote down.
  scene.add(new THREE.AmbientLight(0xffffff, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
  keyLight.position.set(14, 26, 18);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.7);
  fillLight.position.set(-18, -10, -16);
  scene.add(fillLight);

  // -- the objects --------------------------------------------------------
  for (const node of model.nodes) {
    const mesh = new THREE.Mesh(node.kind === 'citation' ? geometry.tick : geometry.sphere, material(node.tone));
    mesh.position.set(node.position.x, node.position.y, node.position.z);
    mesh.scale.setScalar(node.radius);
    mesh.userData.nodeId = node.id;
    group(node.layer).add(mesh);
    meshes.push(mesh);
    byMeshId.set(mesh.uuid, node);
    if (node.pulse) pulses.push({ mesh, base: node.radius, phase: meshes.length * 0.7 });
  }

  // -- the connectors -----------------------------------------------------
  // A line is only drawn when both of the objects it joins are drawn, so a
  // connector never points at something the reader has switched off.
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const byTone = new Map();
  for (const edge of model.edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) continue;
    const tone = Object.prototype.hasOwnProperty.call(TONE_VAR, edge.tone) ? edge.tone : 'muted';
    if (!byTone.has(tone)) byTone.set(tone, []);
    byTone.get(tone).push({ from, to });
  }

  const lineParts = [];
  for (const [tone, joined] of byTone) {
    const positions = new Float32Array(joined.length * 6);
    const lineGeometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    lineGeometry.setAttribute('position', attribute);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(toneColour(tone)),
      transparent: true,
      opacity: SIZES.lineOpacity,
      depthWrite: false
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    group('edges').add(lines);
    lineParts.push({ tone, joined, lineGeometry, lineMaterial, attribute, positions });
  }

  // The visible lines are packed to the front of the buffer and the rest is cut
  // off with a draw range, so switching a layer off costs one pass and no
  // allocation.
  function refreshEdges() {
    for (const part of lineParts) {
      let count = 0;
      for (const { from, to } of part.joined) {
        if (!isLayerVisible(from.layer) || !isLayerVisible(to.layer)) continue;
        const offset = count * 6;
        part.positions[offset] = from.position.x;
        part.positions[offset + 1] = from.position.y;
        part.positions[offset + 2] = from.position.z;
        part.positions[offset + 3] = to.position.x;
        part.positions[offset + 4] = to.position.y;
        part.positions[offset + 5] = to.position.z;
        count += 1;
      }
      part.lineGeometry.setDrawRange(0, count * 2);
      part.attribute.needsUpdate = true;
    }
  }
  refreshEdges();

  // -- the names ----------------------------------------------------------
  // Labels are HTML, not textures: they stay sharp at any zoom, they use the
  // page's own font, and the table under the canvas carries the same names for
  // a reader who cannot see the picture at all.
  function makeLabel(node) {
    if (!overlay || !node.showLabel) return;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'map-label';
    element.dataset.nodeId = node.id;
    element.textContent = node.label;
    element.title = `${node.label} — ${node.sublabel}`;
    element.style.color = toneColour(node.tone);
    element.addEventListener('click', () => {
      select(node);
    });
    overlay.appendChild(element);
    labels.push({ node, element });
  }
  for (const node of model.nodes) makeLabel(node);

  // -- camera -------------------------------------------------------------
  function placeCamera() {
    const radius = VIEW.distance;
    camera.position.set(
      Math.cos(VIEW.pitch) * Math.sin(VIEW.yaw) * radius,
      Math.sin(VIEW.pitch) * radius,
      Math.cos(VIEW.pitch) * Math.cos(VIEW.yaw) * radius
    );
    camera.lookAt(0, 0.8, 0);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const width = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 720;
    const height = canvas.clientHeight || 460;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  // -- what the pointer is over ------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const projected = new THREE.Vector3();

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const reachable = meshes.filter((mesh) => !mesh.parent || mesh.parent.visible);
    const hits = raycaster.intersectObjects(reachable, false);
    return hits.length ? byMeshId.get(hits[0].object.uuid) || null : null;
  }

  function report(node) {
    if (hovered === node) return;
    hovered = node;
    canvas.style.cursor = node ? 'pointer' : 'grab';
    if (typeof options.onHover === 'function') options.onHover(node);
  }

  function select(node) {
    selected = node;
    if (typeof options.onSelect === 'function') options.onSelect(node);
  }

  // -- what can be switched off ------------------------------------------
  function setLayerVisible(layer, on) {
    const target = groups.get(layer);
    if (target) target.visible = !!on;
    // A connector is only drawn while both of the objects it joins are drawn.
    refreshEdges();
    placeLabels();
  }

  function isLayerVisible(layer) {
    const target = groups.get(layer);
    return target ? target.visible : false;
  }

  function placeLabels() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    for (const { node, element } of labels) {
      if (!isLayerVisible(node.layer)) {
        element.style.display = 'none';
        continue;
      }
      projected.set(node.position.x, node.position.y + node.radius + 0.4, node.position.z).project(camera);
      const onScreen = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
      element.style.display = onScreen ? '' : 'none';
      if (!onScreen) continue;
      const x = ((projected.x + 1) / 2) * width;
      const y = ((1 - projected.y) / 2) * height;
      element.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  function zoom(factor) {
    VIEW.distance = Math.min(VIEW.maxDistance, Math.max(VIEW.minDistance, VIEW.distance * factor));
    placeCamera();
    placeLabels();
  }

  function turn(dx, dy) {
    VIEW.yaw -= dx * 0.005;
    VIEW.pitch = Math.min(VIEW.maxPitch, Math.max(VIEW.minPitch, VIEW.pitch + dy * 0.005));
    placeCamera();
    placeLabels();
  }

  // -- the pointer, the wheel and the keys --------------------------------
  // Orbit is a drag, zoom is the wheel or a pinch, and the same three moves are
  // on the arrow keys and plus/minus, because not every reader has a mouse.
  function pointOf(event) {
    return { x: event.clientX, y: event.clientY };
  }

  addListener(canvas, 'pointerdown', (event) => {
    if (typeof canvas.setPointerCapture === 'function' && event.pointerId !== undefined) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // A capture that is refused is not a reason to stop listening.
      }
    }
    pointers.set(event.pointerId === undefined ? 1 : event.pointerId, pointOf(event));
    dragging = true;
    moved = 0;
    lastPointer = pointOf(event);
    if (pointers.size === 2) pinchStart = pinchDistance();
  });

  function pinchDistance() {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  addListener(canvas, 'pointermove', (event) => {
    const key = event.pointerId === undefined ? 1 : event.pointerId;
    if (pointers.has(key)) pointers.set(key, pointOf(event));
    if (pointers.size >= 2) {
      const next = pinchDistance();
      if (pinchStart > 0 && next > 0) zoom(pinchStart / next);
      pinchStart = next;
      moved += 4;
      return;
    }
    const point = pointOf(event);
    const dx = point.x - lastPointer.x;
    const dy = point.y - lastPointer.y;
    lastPointer = point;
    if (!dragging) {
      report(pick(event));
      return;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 3) turn(dx, dy);
  });

  addListener(canvas, 'pointerup', (event) => {
    const key = event.pointerId === undefined ? 1 : event.pointerId;
    pointers.delete(key);
    if (pointers.size < 2) pinchStart = 0;
    if (pointers.size === 0) dragging = false;
    // A press that did not move is a choice, not a drag.
    if (moved <= 3) select(pick(event));
  });

  addListener(canvas, 'pointerleave', () => {
    dragging = false;
    pointers.clear();
    report(null);
  });

  addListener(
    canvas,
    'wheel',
    (event) => {
      event.preventDefault();
      zoom(1 + Math.max(-0.4, Math.min(0.4, event.deltaY * 0.0012)));
    },
    { passive: false }
  );

  addListener(canvas, 'keydown', (event) => {
    const step = event.shiftKey ? 60 : 20;
    if (event.key === 'ArrowLeft') turn(step, 0);
    else if (event.key === 'ArrowRight') turn(-step, 0);
    else if (event.key === 'ArrowUp') turn(0, step);
    else if (event.key === 'ArrowDown') turn(0, -step);
    else if (event.key === '+' || event.key === '=') zoom(0.9);
    else if (event.key === '-' || event.key === '_') zoom(1.1);
    else if (event.key === 'Home') {
      VIEW.yaw = -0.62;
      VIEW.pitch = 0.72;
      VIEW.distance = 30;
      placeCamera();
      placeLabels();
    } else if (event.key === 'Enter' && hovered) select(hovered);
    else return;
    event.preventDefault();
  });

  // -- the theme ----------------------------------------------------------
  // The tokens are read again on a theme change, so a light page never keeps
  // dark paint on its canvas.
  function repaint() {
    for (const [tone, mat] of materials) mat.color.set(toneColour(tone));
    for (const part of lineParts) part.lineMaterial.color.set(toneColour(part.tone));
    for (const { node, element } of labels) element.style.color = toneColour(node.tone);
    renderer.render(scene, camera);
  }

  const themeQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (themeQuery) {
    addListener(themeQuery, 'change', repaint);
  }

  // -- the loop -----------------------------------------------------------
  // The only moving part is the pulse on an object that is asking for a person.
  // Motion is switched off entirely when the reader has asked for less of it.
  function tick(time) {
    if (stopped) return;
    frame = window.requestAnimationFrame(tick);
    if (!reduced && pulses.length) {
      const seconds = (time || 0) / 1000;
      for (const pulse of pulses) {
        if (!isLayerVisible(pulse.mesh.parent ? pulse.mesh.parent.name : '')) continue;
        pulse.mesh.scale.setScalar(pulse.base * (1 + Math.sin(seconds * 2.2 + pulse.phase) * 0.17));
      }
    }
    placeLabels();
    renderer.render(scene, camera);
  }

  const observer =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          resize();
          placeLabels();
        })
      : null;
  if (observer && canvas.parentElement) observer.observe(canvas.parentElement);
  addListener(window, 'resize', () => {
    resize();
    placeLabels();
  });

  placeCamera();
  resize();
  placeLabels();
  renderer.render(scene, camera);
  frame = window.requestAnimationFrame(tick);

  // -- what the page may do with it --------------------------------------
  function dispose() {
    stopped = true;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (observer) observer.disconnect();
    for (const off of listeners.splice(0)) off();
    for (const { element } of labels) {
      if (element.parentElement) element.parentElement.removeChild(element);
    }
    labels.length = 0;
    pulses.length = 0;
    meshes.length = 0;
    byMeshId.clear();
    geometry.sphere.dispose();
    geometry.tick.dispose();
    for (const mat of materials.values()) mat.dispose();
    materials.clear();
    for (const part of lineParts) {
      part.lineGeometry.dispose();
      part.lineMaterial.dispose();
    }
    lineParts.length = 0;
    scene.clear();
    renderer.dispose();
    // A WebGL context is a limited resource. Leaving this tab and coming back
    // must not run the browser out of them.
    if (typeof renderer.forceContextLoss === 'function') renderer.forceContextLoss();
  }

  return {
    dispose,
    resize,
    repaint,
    setLayerVisible,
    isLayerVisible,
    select,
    zoom,
    turn,
    // For the page to report honestly whether motion is on, and how many
    // objects are drawn.
    counts: {
      meshes: meshes.length,
      labels: labels.length,
      pulses: pulses.length,
      lines: lineParts.length,
      reducedMotion: reduced
    },
    selected: () => selected
  };
}

