/* eslint-disable @typescript-eslint/no-require-imports -- Node's CJS loader substitutes browser plumbing while testing real Cesium geometry. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const Cesium = require('cesium');

// Exercise the actual controller and Cesium geometry without requesting Google
// tiles. Only browser event/canvas plumbing and the camera renderer are mocked.
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === 'cesium') return { ...Cesium, ScreenSpaceEventHandler: class {
    setInputAction() {} destroy() {}
  } };
  return originalLoad.call(this, name, ...args);
};
const { createJourneyController } = require('../app/journeyController.ts');
const { JOURNEY_STOPS } = require('../app/journeyStops.ts');
const { loadFlightSession, saveFlightSession, clearFlightSession } = require('../app/flightSession.ts');
const { createLandmarkProximity } = require('../app/landmarkProximity.ts');
const { clearJourneyCheckpoint, loadJourneyCheckpoint, saveJourneyCheckpoint } = require('../app/journeyProgress.ts');
Module._load = originalLoad;

function setup(options = {}) {
  global.window = new EventTarget();
  window.matchMedia = () => ({ matches: false });
  const storage = new Map();
  window.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  global.Audio = options.AudioClass ?? class extends EventTarget {
    constructor(src) { super(); this.src = src; this.currentTime = 0; this.duration = Number.NaN; this.paused = true; }
    load() {}
    play() {
      this.paused = false;
      return { catch: callback => { this.paused = true; callback(); } };
    }
    pause() { this.paused = true; }
  };
  global.HTMLElement = class {};
  global.HTMLCanvasElement = class {};
  global.HTMLVideoElement = class {};
  global.document = { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: () => ({
    getContext: () => new Proxy({}, { get: (_, key) => key === 'createLinearGradient'
      ? () => ({ addColorStop() {} }) : () => {} }),
    toDataURL: () => 'data:image/png;base64,AA==',
  }) };
  const drone = { lat: 41.590364, lng: -93.607976, height: 150, heading: 1.3 };
  const camera = {
    positionWC: Cesium.Cartesian3.fromDegrees(drone.lng, drone.lat, 600),
    directionWC: new Cesium.Cartesian3(0, 0, -1),
    upWC: new Cesium.Cartesian3(0, 1, 0), rightWC: new Cesium.Cartesian3(1, 0, 0),
    lookAt(center, offset) {
      this.lastCenter = Cesium.Cartesian3.clone(center);
      this.lastOffset = offset;
      const frame = Cesium.Transforms.eastNorthUpToFixedFrame(center);
      const horizontal = offset.range * Math.cos(offset.pitch);
      const local = new Cesium.Cartesian3(-Math.sin(offset.heading) * horizontal,
        -Math.cos(offset.heading) * horizontal, -Math.sin(offset.pitch) * offset.range);
      this.positionWC = Cesium.Matrix4.multiplyByPoint(frame, local, new Cesium.Cartesian3());
      this.directionWC = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(center, this.positionWC, new Cesium.Cartesian3()), new Cesium.Cartesian3());
      const normal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(center);
      this.rightWC = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(this.directionWC, normal, new Cesium.Cartesian3()), new Cesium.Cartesian3());
      this.upWC = Cesium.Cartesian3.cross(this.rightWC, this.directionWC, new Cesium.Cartesian3());
    },
    lookAtTransform() {},
    setView({ destination, orientation }) { this.positionWC = destination; this.directionWC = orientation.direction; this.upWC = orientation.up; },
  };
  const viewer = { entities: new Cesium.EntityCollection(), canvas: {}, camera,
    scene: { screenSpaceCameraController: { enableInputs: true }, requestRender() {} } };
  let status, visible = true, warps = 0, rewards = 0, checkpoint;
  let sampledSurfaceHeight;
  const controller = createJourneyController({ viewer, drone,
    onStatus: value => { status = value; }, setFlightVisible: value => { visible = value; },
    warp: value => { Object.assign(drone, value); warps++; }, surfaceHeight: () => sampledSurfaceHeight,
    onCorrectAnswer() { rewards++; },
    onLandmarkCompleted(completed, position) { checkpoint = { completed, position }; },
    resumeCheckpoint: options.resumeCheckpoint,
    resumeSession: options.resumeSession,
    previewStopId: options.previewStopId,
  });
  return {
    controller, viewer, drone,
    setSurfaceHeight(value) { sampledSurfaceHeight = value; },
    get status() { return status; }, get visible() { return visible; },
    get warps() { return warps; }, get rewards() { return rewards; },
    get checkpoint() { return checkpoint; },
  };
}
const action = detail => window.dispatchEvent(new CustomEvent('iowa-journey-action', { detail }));

test('all 12 stops: tutorial gating, arrival, cinematic, answers, portal flight, completion and cleanup', () => {
  const app = setup();
  const { controller, viewer, drone } = app;
  assert.equal(viewer.entities.values.filter(e => e.show).length, 0);
  controller.tick(2);
  assert.equal(controller.locked, false);
  window.dispatchEvent(new Event('iowa-tutorial-complete'));
  controller.tick(0.3);
  assert.equal(app.status.phase, 'navigate');
  const groundRoute = viewer.entities.values.find(e => e.show && e.polyline?.clampToGround?.getValue());
  assert.ok(groundRoute);
  assert.equal(groundRoute.polyline.width.getValue(), 7);
  const initialRoutePositions = groundRoute.polyline.positions.getValue();
  assert.equal(initialRoutePositions.length, 2, 'navigation should be a straight two-point route');
  const routeOrigin = Cesium.Cartographic.fromCartesian(initialRoutePositions[0]);
  assert.ok(Math.abs(Cesium.Math.toDegrees(routeOrigin.latitude) - drone.lat) < 1e-7, 'route should begin beneath the drone latitude');
  assert.ok(Math.abs(Cesium.Math.toDegrees(routeOrigin.longitude) - drone.lng) < 1e-7, 'route should begin beneath the drone longitude');
  const routeEdge = Cesium.Cartographic.fromCartesian(initialRoutePositions[1]);
  const routeEdgeDistance = Math.hypot(
    (Cesium.Math.toDegrees(routeEdge.latitude) - JOURNEY_STOPS[0].lat) * 111320,
    (Cesium.Math.toDegrees(routeEdge.longitude) - JOURNEY_STOPS[0].lng) * 111320 * Math.cos(Cesium.Math.toRadians(JOURNEY_STOPS[0].lat)),
  );
  assert.ok(Math.abs(routeEdgeDistance - 24) < 0.5, 'navigation should stop at the flat circle circumference');
  assert.equal(
    viewer.entities.values.filter(e => e.show && e.polyline?.clampToGround?.getValue()).length,
    2,
    'navigation should render one line and one flat circle',
  );
  const flatCircle = viewer.entities.values.find(e => e.show && e.polyline?.positions.getValue().length === 41);
  assert.ok(flatCircle, 'navigation should include a flat endpoint circle');
  assert.ok(
    flatCircle.polyline.positions.getValue().every(position => Math.abs(Cesium.Cartographic.fromCartesian(position).height) < 0.01),
    'endpoint circle coordinates must not contain Z height',
  );
  const routeOriginBeforeMovement = Cesium.Cartesian3.clone(initialRoutePositions[0]);
  drone.lat += 0.00005;
  controller.tick(0.01);
  assert.notDeepEqual(
    groundRoute.polyline.positions.getValue()[0],
    routeOriginBeforeMovement,
    'the route origin should follow movement between quarter-second HUD updates',
  );
  drone.lat -= 0.00005;
  assert.ok(viewer.entities.values.some(e => e.show && e.plane), 'destination marker should be a world-space plaque');
  const fixedEntityCount = viewer.entities.values.length;
  for (let index = 0; index < 12; index++) {
    const stop = JOURNEY_STOPS[index];
    Object.assign(drone, { lat: stop.lat, lng: stop.lng });
    controller.tick(3);
    assert.equal(app.status.phase, 'cinematic');
    assert.equal(controller.locked, true);
    assert.equal(app.visible, false);
    assert.equal(viewer.scene.screenSpaceCameraController.enableInputs, false);
    if (index === 0) {
      controller.tick(0.1);
      assert.ok(Math.abs(viewer.camera.lastOffset.pitch - Cesium.Math.toRadians(-18)) < 1e-8);
      assert.ok(Math.abs(viewer.camera.lastOffset.range - stop.radius * 1.2) < 1e-8);
      assert.ok(Math.abs(Cesium.Cartographic.fromCartesian(viewer.camera.lastCenter).height - (stop.elevation - 45)) < 0.1);
      controller.tick(13.5); assert.equal(app.status.shot, 1); controller.tick(0.01);
      assert.ok(Math.abs(viewer.camera.lastOffset.pitch - Cesium.Math.toRadians(-40)) < 1e-8);
      assert.ok(Math.abs(viewer.camera.lastOffset.range - stop.radius * 0.95) < 1e-8);
      assert.ok(Math.abs(Cesium.Cartographic.fromCartesian(viewer.camera.lastCenter).height - (stop.elevation - 50)) < 0.1);
      controller.tick(13.5); assert.equal(app.status.shot, 2); controller.tick(0.01);
      assert.ok(Math.abs(viewer.camera.lastOffset.pitch - Cesium.Math.toRadians(-18)) < 1e-8);
      assert.ok(Math.abs(viewer.camera.lastOffset.range - stop.radius * 1.15) < 1e-8);
      assert.ok(Math.abs(Cesium.Cartographic.fromCartesian(viewer.camera.lastCenter).height - (stop.elevation - 50)) < 0.1);
      controller.tick(13); assert.equal(app.status.phase, 'question');
      const headingWhenQuestionOpened = viewer.camera.lastOffset.heading;
      controller.tick(1);
      assert.notEqual(viewer.camera.lastOffset.heading, headingWhenQuestionOpened, 'camera orbit should continue while the question is open');
    } else {
      controller.tick(13.1);
      assert.equal(app.status.shot, 1);
      controller.tick(13.1);
      assert.equal(app.status.shot, 2);
      controller.tick(13.1);
      assert.equal(app.status.phase, 'question', 'cinematic should advance automatically after its timed narration fallback');
    }
    action(String(1 - stop.answer));
    assert.equal(app.status.completed, index);
    assert.equal(app.rewards, index);
    action('next'); assert.equal(app.status.phase, 'question');
    action(String(stop.answer));
    assert.equal(app.status.completed, index + 1);
    assert.equal(app.rewards, index + 1);
    action(String(stop.answer));
    assert.equal(app.rewards, index + 1, 'a solved question can only award once');
    if (index === 0) app.setSurfaceHeight(240);
    action('next');
    if (index < 11) {
      if (index === 0) {
        assert.equal(app.status.phase, 'navigate', 'nearby landmarks should use a direct flight instead of a portal');
        assert.match(app.status.message, /Water Works Park/);
        continue;
      }

      assert.equal(app.status.phase, 'portal');
      assert.equal(app.visible, true);
      const before = app.warps;
      controller.tick(2);
      assert.equal(app.warps, before, 'portal must require flying to it');
      const portal = viewer.entities.values.find(e => e.show && e.billboard);
      assert.ok(portal, 'portal should use the supplied vortex image');
      assert.equal(portal.billboard.image.getValue(), '/portal-vortex.png');
      assert.equal(portal.billboard.sizeInMeters.getValue(), true);
      assert.equal(portal.billboard.width.getValue(), 180);
      assert.equal(portal.billboard.disableDepthTestDistance.getValue(), Number.POSITIVE_INFINITY, 'portal should remain visible against loaded photogrammetry');
      assert.equal(viewer.entities.values.filter(e => e.show && e.plane).length, 0, 'portals should not have a world label');
      const center = portal.position.getValue();
      const portalHeight = Cesium.Cartographic.fromCartesian(center).height;
      const portalClearance = 170;
      const expectedPortalHeight = Math.max(drone.height, stop.elevation + portalClearance);
      assert.ok(Math.abs(portalHeight - expectedPortalHeight) < 0.1, 'each portal must remain above its completed landmark');
      const setDroneFromWorld = position => {
        const point = Cesium.Cartographic.fromCartesian(position);
        Object.assign(drone, { lat: Cesium.Math.toDegrees(point.latitude), lng: Cesium.Math.toDegrees(point.longitude), height: point.height });
      };
      const droneBeforePortal = Cesium.Cartesian3.fromDegrees(drone.lng, drone.lat, drone.height);
      const approachDirection = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.subtract(droneBeforePortal, center, new Cesium.Cartesian3()),
        new Cesium.Cartesian3(),
      );
      setDroneFromWorld(Cesium.Cartesian3.add(center, Cesium.Cartesian3.multiplyByScalar(approachDirection, 105, new Cesium.Cartesian3()), new Cesium.Cartesian3()));
      controller.tick(0.1);
      assert.equal(app.status.phase, 'portal', 'approaching the hitbox must not teleport before contact');
      setDroneFromWorld(Cesium.Cartesian3.add(center, Cesium.Cartesian3.multiplyByScalar(approachDirection, 95, new Cesium.Cartesian3()), new Cesium.Cartesian3()));
      controller.tick(0.1);
      assert.equal(app.status.phase, 'transfer');
      assert.equal(app.status.message, 'Teleporting');
      controller.tick(0.7); assert.equal(app.warps, before + 1);
      controller.tick(1); assert.equal(app.status.phase, 'navigate');
      assert.equal(viewer.entities.values.length, fixedEntityCount, 'old stop entities must not accumulate');
    }
  }
  assert.equal(app.status.phase, 'complete');
  assert.equal(controller.locked, false);
  assert.equal(app.visible, true);
  controller.destroy();
  assert.equal(viewer.entities.values.length, 0);
});

test('each cinematic view waits for its own narration ended event', () => {
  const originalAudio = global.Audio;
  const originalStopAudio = JOURNEY_STOPS[0].audio;
  const clips = [];

  const AudioClass = class extends EventTarget {
    constructor(src) {
      super();
      this.src = src;
      this.currentTime = 0;
      this.duration = 8;
      this.paused = true;
      clips.push(this);
    }
    load() {}
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  };
  JOURNEY_STOPS[0].audio = ['/01.mp3', '/02.mp3', '/03.mp3'];

  try {
    const app = setup({ AudioClass });
    window.dispatchEvent(new Event('iowa-tutorial-complete'));
    Object.assign(app.drone, { lat: JOURNEY_STOPS[0].lat, lng: JOURNEY_STOPS[0].lng });
    app.controller.tick(3);

    assert.equal(clips.length, 4, 'one travel prompt should play before the three cinematic clips');
    const cinematicClips = clips.slice(-3);
    assert.equal(app.status.shot, 0);
    assert.equal(cinematicClips[0].paused, false);
    cinematicClips[0].dispatchEvent(new Event('ended'));
    assert.equal(app.status.shot, 1);
    assert.equal(cinematicClips[1].paused, false);
    cinematicClips[1].dispatchEvent(new Event('ended'));
    assert.equal(app.status.shot, 2);
    assert.equal(cinematicClips[2].paused, false);
    cinematicClips[2].dispatchEvent(new Event('ended'));
    assert.equal(app.status.phase, 'question');
    app.controller.destroy();
  } finally {
    JOURNEY_STOPS[0].audio = originalStopAudio;
    global.Audio = originalAudio;
  }
});

test('hidden tabs pause tours and duplicate tutorial events cannot restart progress', () => {
  const app = setup();
  window.dispatchEvent(new Event('iowa-tutorial-complete'));
  Object.assign(app.drone, { lat: JOURNEY_STOPS[0].lat, lng: JOURNEY_STOPS[0].lng });
  app.controller.tick(3);
  document.hidden = true;
  app.controller.tick(100);
  assert.equal(app.status.phase, 'cinematic');
  assert.equal(app.status.shot, 0);
  window.dispatchEvent(new Event('iowa-tutorial-complete'));
  assert.equal(app.status.phase, 'cinematic');
  document.hidden = false;
  app.controller.destroy();
});

test('a destroyed controller cannot finish a stale travel clip beside the live controller', async () => {
  const clips = [];
  const resolvePlayback = [];
  const AudioClass = class extends EventTarget {
    constructor(src) {
      super();
      this.src = src;
      this.currentTime = 0;
      this.duration = 3;
      this.paused = true;
      clips.push(this);
    }
    load() {}
    play() {
      return new Promise(resolve => {
        resolvePlayback.push(() => {
          this.paused = false;
          resolve();
        });
      });
    }
    pause() { this.paused = true; }
  };

  const abandoned = setup({ AudioClass });
  window.dispatchEvent(new Event('iowa-tutorial-complete'));
  abandoned.controller.destroy();

  const live = setup({ AudioClass });
  window.dispatchEvent(new Event('iowa-tutorial-complete'));
  assert.equal(clips.length, 2);

  resolvePlayback.forEach(resolve => resolve());
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(clips[0].paused, true, 'the abandoned prompt must be silenced after its pending play resolves');
  assert.equal(clips[1].paused, false, 'the live prompt should keep playing');
  live.controller.destroy();
});

test('cinematic skipping requires the dedicated hold control event, not Enter', () => {
  const app = setup();
  window.dispatchEvent(new Event('iowa-tutorial-complete'));
  Object.assign(app.drone, { lat: JOURNEY_STOPS[0].lat, lng: JOURNEY_STOPS[0].lng });
  app.controller.tick(3);
  assert.equal(app.status.phase, 'cinematic');

  const enter = new Event('keydown');
  Object.defineProperties(enter, {
    key: { value: 'Enter' },
    repeat: { value: false },
  });
  window.dispatchEvent(enter);
  assert.equal(app.status.phase, 'cinematic', 'Enter must not skip the narration');

  action('skip');
  assert.equal(app.status.phase, 'question', 'the hold control completion event should open the question');
  app.controller.destroy();
});

test('completed landmarks resume from their checkpoint at the next travel objective', () => {
  const firstCheckpoint = {
    completed: 1,
    position: {
      lat: JOURNEY_STOPS[0].lat,
      lng: JOURNEY_STOPS[0].lng,
      height: 150,
      heading: 1.3,
    },
    boostCharges: 1,
  };
  const directResume = setup({ resumeCheckpoint: firstCheckpoint });

  assert.equal(directResume.status.completed, 1);
  assert.equal(directResume.status.index, 1);
  assert.equal(directResume.status.phase, 'navigate');
  assert.match(directResume.status.message, /Water Works Park/);
  assert.ok(directResume.viewer.entities.values.some(entity => entity.show && entity.plane));
  directResume.controller.destroy();

  const secondCheckpoint = {
    completed: 2,
    position: {
      lat: JOURNEY_STOPS[1].lat,
      lng: JOURNEY_STOPS[1].lng,
      height: 150,
      heading: 1.3,
    },
    boostCharges: 2,
  };
  const distantResume = setup({ resumeCheckpoint: secondCheckpoint });

  assert.equal(distantResume.status.completed, 2);
  assert.equal(distantResume.status.index, 2);
  assert.equal(distantResume.status.phase, 'portal');
  assert.match(distantResume.status.message, /Raccoon River at Van Meter/);
  distantResume.controller.destroy();
});

test('landmark progress persists as a validated device checkpoint', () => {
  const values = new Map();
  global.window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
  };
  const checkpoint = {
    completed: 2,
    position: {
      lat: JOURNEY_STOPS[1].lat,
      lng: JOURNEY_STOPS[1].lng,
      height: 150,
      heading: 1.3,
    },
    boostCharges: 2,
  };

  values.set('iowa-from-above:journey-checkpoint:v1', JSON.stringify({
    ...checkpoint, version: 1, completedStopId: 'capitol',
  }));
  values.set('iowa-from-above-audio-muted', 'true');
  assert.equal(loadJourneyCheckpoint(), undefined, 'old route progress must not resume against reordered destinations');
  saveJourneyCheckpoint(checkpoint);
  assert.deepEqual(loadJourneyCheckpoint(), checkpoint);
  clearJourneyCheckpoint();
  assert.equal(loadJourneyCheckpoint(), undefined);
  assert.equal(values.has('iowa-from-above:journey-checkpoint:v1'), false);
  assert.equal(values.get('iowa-from-above-audio-muted'), 'true', 'restart must preserve audio preferences');
});

test('app deep links preview a place without completing or overwriting the journey', () => {
  const app = setup({ previewStopId: 'high-trestle' });
  assert.equal(app.status.phase, 'explore');
  assert.equal(JOURNEY_STOPS[app.status.index].id, 'high-trestle');
  assert.equal(app.status.completed, 0);
  assert.equal(app.controller.flightBoundaryCenter, null);
  assert.equal(app.controller.locked, false);
  app.controller.tick(100);
  window.dispatchEvent(new Event('iowa-tutorial-complete'));
  assert.equal(app.status.phase, 'explore');
  assert.equal(app.checkpoint, undefined);
  app.controller.destroy();
});


test('a flight before the first completed landmark resumes its actual position and heading', () => {
  const first = setup();
  window.dispatchEvent(new Event('iowa-tutorial-complete'));
  Object.assign(first.drone, { lat: 41.592, lng: -93.613, height: 340, heading: 2.4 });
  const snapshot = first.controller.snapshot(2);
  assert.equal(snapshot.completed, 0);
  saveFlightSession(snapshot);
  assert.deepEqual(loadFlightSession(), snapshot);
  first.controller.destroy();
  const resumed = setup({ resumeSession: snapshot });
  assert.deepEqual(resumed.drone, snapshot.position);
  assert.equal(resumed.status.phase, 'navigate');
  assert.equal(resumed.status.completed, 0);
  assert.equal(resumed.rewards, 0);
  window.dispatchEvent(new Event('iowa-tutorial-complete'));
  assert.equal(resumed.status.phase, 'navigate');
  resumed.controller.destroy();
});

test('exploration resumes where you flew, while an explicitly different QR place wins', () => {
  const first = setup({ previewStopId: 'high-trestle' });
  Object.assign(first.drone, { lat: 41.86, lng: -93.84, heading: 2.2 });
  const snapshot = first.controller.snapshot(1);
  first.controller.destroy();
  for (const previewStopId of [undefined, 'high-trestle']) {
    const resumed = setup({ resumeSession: snapshot, previewStopId });
    assert.deepEqual(resumed.drone, snapshot.position);
    assert.equal(resumed.status.phase, 'explore');
    assert.equal(resumed.status.completed, 0);
    resumed.controller.destroy();
  }
  const other = setup({ resumeSession: snapshot, previewStopId: 'chichaqua' });
  assert.equal(JOURNEY_STOPS[other.status.index].id, 'chichaqua');
  assert.notEqual(other.drone.lat, snapshot.position.lat);
  other.controller.destroy();
});

test('portal resume preserves the portal and solved questions cannot award a second boost', () => {
  const first = setup({ resumeCheckpoint: { completed: 2, position: { lat: 41.6, lng: -93.7, height: 340, heading: 1 }, boostCharges: 2 } });
  const snapshot = first.controller.snapshot(2);
  assert.equal(snapshot.phase, 'portal');
  const portal = snapshot.portalPosition;
  first.controller.destroy();
  const resumed = setup({ resumeSession: snapshot });
  assert.equal(resumed.status.phase, 'portal');
  assert.deepEqual(resumed.controller.snapshot(2).portalPosition, portal);
  assert.deepEqual(resumed.drone, snapshot.position);
  resumed.controller.destroy();
  const question = setup({ resumeSession: { ...snapshot, stopId: JOURNEY_STOPS[0].id, completed: 1, phase: 'question', shot: 2 } });
  assert.equal(question.status.phase, 'question');
  assert.equal(question.status.answerCorrect, true);
  action(String(JOURNEY_STOPS[0].answer));
  assert.equal(question.rewards, 0);
  action('next');
  assert.equal(question.status.index, 1);
  question.controller.destroy();
});

test('restart clears both flight and route progress, and invalid sessions fail safely', () => {
  const app = setup();
  const snapshot = app.controller.snapshot(0);
  saveFlightSession(snapshot);
  assert.ok(loadFlightSession());
  let resets = 0;
  window.addEventListener('iowa-flight-reset', () => resets++);
  clearJourneyCheckpoint();
  assert.equal(loadFlightSession(), undefined);
  assert.equal(resets, 1);
  saveFlightSession({ ...snapshot, position: { ...snapshot.position, lat: 100 } });
  assert.equal(loadFlightSession(), undefined);
  saveFlightSession({ ...snapshot, phase: 'portal', portalPosition: undefined });
  assert.equal(loadFlightSession(), undefined);
  saveFlightSession(snapshot);
  clearFlightSession();
  assert.equal(loadFlightSession(), undefined);
  app.controller.destroy();
});

test('nearby readings open without hovering and stay dismissed until you leave and return', () => {
  const places = [{ id: 'river', lat: 42, lng: -93 }, { id: 'prairie', lat: 43, lng: -93 }];
  const proximity = createLandmarkProximity(places);
  assert.equal(proximity.update({ lat: 41.98, lng: -93 }), undefined);
  assert.equal(proximity.update({ lat: 42.005, lng: -93 }).id, 'river');
  assert.equal(proximity.update({ lat: 42.007, lng: -93 }), undefined, 'edge movement must not reopen the card');
  proximity.dismiss('river');
  assert.equal(proximity.update({ lat: 42, lng: -93 }), undefined);
  assert.equal(proximity.update({ lat: 42.012, lng: -93 }), undefined);
  assert.equal(proximity.update({ lat: 42, lng: -93 }).id, 'river');
  assert.equal(proximity.update({ lat: 43, lng: -93 }).id, 'prairie');
});
