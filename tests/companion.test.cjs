const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { parsePlaceLink } = require('../app/companionLinks.ts');
const { JOURNEY_STOPS } = require('../app/journeyStops.ts');

test('shared app, universal and browser preview links resolve to the same known place', () => {
  for (const place of JOURNEY_STOPS) {
    for (const url of [`fromabove://place/${place.id}`, `https://iowa-from-above.vercel.app/places/${place.id}`, `http://localhost:3000/?place=${place.id}`]) {
      assert.equal(parsePlaceLink(url), place.id);
    }
  }
  for (const url of ['javascript:alert(1)', 'https://evil.example/places/capitol', 'fromabove://place/unknown', 'https://iowa-from-above.vercel.app.evil.example/places/capitol', 'https://evil@iowa-from-above.vercel.app/places/capitol']) {
    assert.equal(parsePlaceLink(url), null);
  }
  assert.equal(parsePlaceLink('https://school.example/places/capitol', 'https://school.example'), 'capitol');
});

test('every generated place QR decodes with the browser decoder', async () => {
  const sharp = require('sharp');
  const jsQR = require('jsqr');
  for (const place of JOURNEY_STOPS) {
    const { data, info } = await sharp(`public/companion/${place.id}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    assert.ok(code, `QR must decode for ${place.id}`);
    assert.equal(parsePlaceLink(code.data), place.id);
  }
});
