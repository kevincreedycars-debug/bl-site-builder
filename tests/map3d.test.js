import test from 'node:test';
import assert from 'node:assert/strict';

import { createMap, toneColour } from '../js/map3d.js';
import { buildPortfolioScene } from '../js/scene.js';

const TONES = ['ok', 'low', 'medium', 'high', 'muted', 'accent', 'unknown'];
const model = buildPortfolioScene({}, { now: 0 });

test('a tone is a colour from the stylesheet, and there is always an answer', () => {
  // There is no window here, so this is the case where the page is absent:
  // every tone must still come back as a colour rather than undefined.
  for (const tone of TONES) {
    const value = toneColour(tone);
    assert.match(value, /^#[0-9a-f]{6}$/i, `${tone} should be a hex colour, not "${value}"`);
  }

  assert.equal(toneColour('not-a-tone'), toneColour('unknown'), 'a tone the core does not know uses the unknown colour');
  assert.equal(toneColour(undefined), toneColour('unknown'));

  const distinct = new Set(TONES.map((tone) => toneColour(tone).toLowerCase()));
  assert.equal(distinct.size, TONES.length, 'two tones must never be drawn in the same colour');
});

test('the canvas refuses to draw without a canvas, and says why', () => {
  assert.throws(() => createMap({}), /canvas and a scene model/);
  assert.throws(() => createMap({ canvas: {}, model }), /cannot draw a canvas/);
  assert.throws(() => createMap({ canvas: { getContext() {} }, model: null }), /canvas and a scene model/);
});
