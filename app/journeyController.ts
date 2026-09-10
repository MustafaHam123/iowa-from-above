import * as C from "cesium";
import {
  INITIAL_JOURNEY,
  JOURNEY_STOPS,
  navigationGuidance,
  portalGuidance,
  type JourneyStatus,
} from "./journeyStops";
import type { JourneyCheckpoint } from "./journeyProgress";
import {
  announceGuideAudio,
  AUDIO_MUTED_EVENT,
  getStoredAudioMuted,
} from "./audioPreferences";

type Position = { lat: number; lng: number; height: number; heading: number };
type Options = {
  viewer: C.Viewer;
  drone: Position;
  onStatus: (status: JourneyStatus) => void;
  setFlightVisible: (visible: boolean) => void;
  warp: (position: Position) => void;
  surfaceHeight: (lat: number, lng: number) => number | undefined;
  onCorrectAnswer: () => void;
  onLandmarkCompleted: (completed: number, position: Position) => void;
  resumeCheckpoint?: JourneyCheckpoint;
};
export type CinematicCameraSettings = {
  heading: number;
  pitch: number;
  rangeMultiplier: number;
  heightOffset: number;
};
export const DEFAULT_CINEMATIC_CAMERAS: readonly CinematicCameraSettings[] = [
  { heading: -55, pitch: -18, rangeMultiplier: 1.2, heightOffset: 0 },
  { heading: 22, pitch: -40, rangeMultiplier: 0.95, heightOffset: 0 },
  { heading: 100, pitch: -18, rangeMultiplier: 1.2, heightOffset: 0 },
];
const STOP_CINEMATIC_CAMERA_PRESETS: Partial<
  Record<number, readonly CinematicCameraSettings[]>
> = {
  0: [
    { heading: -55, pitch: -18, rangeMultiplier: 1.2, heightOffset: -45 },
    { heading: 22, pitch: -40, rangeMultiplier: 0.95, heightOffset: -50 },
    { heading: 100, pitch: -18, rangeMultiplier: 1.15, heightOffset: -50 },
  ],
};
export function getDefaultCinematicCamera(
  stopIndex: number,
  shot: number,
): CinematicCameraSettings {
  return STOP_CINEMATIC_CAMERA_PRESETS[stopIndex]?.[shot]
    ?? DEFAULT_CINEMATIC_CAMERAS[shot];
}
const radians = C.Math.toRadians;
const navigationPurple = C.Color.fromCssColorString("#c44cff");
const PORTAL_RADIUS_METERS = 90;
// A narrow logic-only margin catches the drone at the artwork's edge without
// teleporting while the portal still looks far away.
const PORTAL_HITBOX_RADIUS_METERS = 98;
const PORTAL_FLIGHT_CLEARANCE_METERS = 170;
const FIRST_PORTAL_FLIGHT_CLEARANCE_METERS = 100;
const ROUTE_END_RADIUS_METERS = 24;
const DIRECT_FLIGHT_MAX_DISTANCE_METERS = 5_000;
const distance = (a: Position, b: Position) => Math.hypot(
  (a.lat - b.lat) * 111320,
  (a.lng - b.lng) * 111320 * Math.cos(radians(a.lat)),
);
const world = (p: Position) => C.Cartesian3.fromDegrees(p.lng, p.lat, p.height);
const offset = (p: Position, east: number, north: number): Position => ({ ...p,
  lng: p.lng + east / (111320 * Math.cos(radians(p.lat))), lat: p.lat + north / 111320,
});
const bearing = (a: Position, b: Position) => Math.atan2(
  (b.lng - a.lng) * Math.cos(radians(a.lat)), b.lat - a.lat,
);
const ease = (t: number) => t * t * (3 - 2 * t);

/** One active route, world marker, and portal. Reuses the existing Google tileset. */
export function createJourneyController(options: Options) {
  const { viewer, drone } = options;
  const entities: C.Entity[] = [];
  const add = (value: C.Entity.ConstructorOptions) => {
    const entity = viewer.entities.add(value); entities.push(entity); return entity;
  };
  let status = { ...INITIAL_JOURNEY };
  let phaseTime = 0;
  let segmentTime = 0;
  let elapsed = 0;
  let lastUpdate = -1;
  let target: Position = { ...drone };
  let routeStart = { ...drone };
  let tourCenter = world(drone);
  let tourStart = C.Cartesian3.clone(viewer.camera.positionWC);
  let tourStartDirection = C.Cartesian3.clone(viewer.camera.directionWC);
  let tourStartUp = C.Cartesian3.clone(viewer.camera.upWC);
  let lastTourHeading = 0;
  let portalCenter = { ...drone };
  let previousPortalDroneWorld = world(drone);
  let transferMoved = false;
  let answered = false;
  const cinematicCameraOverrides = new Map<string, CinematicCameraSettings>();
  let audio: HTMLAudioElement | undefined;
  let tourAudio: HTMLAudioElement[] = [];
  let guidanceAudio: HTMLAudioElement | undefined;
  let isDestroyed = false;
  let audioMuted = getStoredAudioMuted();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const routePositions = [world(drone), world(drone)];
  const routeWidth = window.matchMedia(
    "(max-width: 950px) and (max-height: 600px) and (orientation: landscape)",
  ).matches ? 4 : 7;
  const route = add({ show: false, polyline: {
    positions: new C.CallbackProperty(() => routePositions, false),
    width: routeWidth,
    clampToGround: true,
    classificationType: C.ClassificationType.BOTH,
    arcType: C.ArcType.GEODESIC,
    material: new C.ColorMaterialProperty(navigationPurple),
  } });
  let routeEndPositions: C.Cartesian3[] = [];
  const routeEnd = add({ show: false, polyline: {
    positions: new C.CallbackProperty(() => routeEndPositions, false),
    width: routeWidth,
    clampToGround: true,
    classificationType: C.ClassificationType.BOTH,
    arcType: C.ArcType.GEODESIC,
    material: new C.ColorMaterialProperty(navigationPurple),
  } });
  function playOwnedAudio(
    clip: HTMLAudioElement,
    isCurrent: () => boolean,
    onFailure: () => void,
  ) {
    try {
      const playback = clip.play() as unknown;
      if (
        playback &&
        typeof (playback as { then?: unknown }).then === "function"
      ) {
        void Promise.resolve(playback).then(() => {
          if (isDestroyed || !isCurrent()) clip.pause();
        }).catch(onFailure);
      } else if (
        playback &&
        typeof (playback as { catch?: unknown }).catch === "function"
      ) {
        (playback as { catch: (handler: () => void) => unknown }).catch(
          onFailure,
        );
      }
    } catch {
      onFailure();
    }
  }
const portalBody = add({ show: false, position: world(drone), billboard: {
    image: "/portal-vortex.png",
    width: PORTAL_RADIUS_METERS * 2,
    height: PORTAL_RADIUS_METERS * 2,
    sizeInMeters: true,
    // Keep the portal visible against dense photogrammetry while preserving
    // its real world position and collision volume.
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    horizontalOrigin: C.HorizontalOrigin.CENTER,
    verticalOrigin: C.VerticalOrigin.CENTER,
  } });
  const markerCanvas = document.createElement("canvas");
  markerCanvas.width = 1024;
  markerCanvas.height = 256;
  const markerPlaque = add({ show: false, position: world(drone), plane: {
    plane: new C.Plane(C.Cartesian3.UNIT_Z, 0),
    dimensions: new C.Cartesian2(98, 24.5),
    material: new C.ImageMaterialProperty({ image: markerCanvas, transparent: true }),
  } });

  markerPlaque.orientation = new C.CallbackProperty((_time, result) => {
    const position = markerPlaque.position?.getValue(viewer.clock.currentTime);
    if (!position) return result;
    const normal = C.Cartesian3.normalize(
      C.Cartesian3.subtract(viewer.camera.positionWC, position, new C.Cartesian3()),
      new C.Cartesian3(),
    );
    const right = C.Cartesian3.normalize(
      C.Cartesian3.cross(viewer.camera.upWC, normal, new C.Cartesian3()),
      new C.Cartesian3(),
    );
    const up = C.Cartesian3.normalize(
      C.Cartesian3.cross(normal, right, new C.Cartesian3()),
      new C.Cartesian3(),
    );
    const rotation = new C.Matrix3();
    C.Matrix3.setColumn(rotation, 0, right, rotation);
    C.Matrix3.setColumn(rotation, 1, up, rotation);
    C.Matrix3.setColumn(rotation, 2, normal, rotation);
    return C.Quaternion.fromRotationMatrix(rotation, result);
  }, false);
  function emit() {
    options.onStatus({ ...status });
    window.dispatchEvent(new CustomEvent("iowa-journey-status", { detail: { ...status } }));
  }
  function transition(phase: JourneyStatus["phase"], message: string) {
    status = {
      ...status,
      phase,
      message,
      feedback: "",
      selectedAnswer: null,
      answerCorrect: null,
    };
    phaseTime = 0;
    const locked = ["cinematic", "question", "transfer"].includes(phase);
    viewer.scene.screenSpaceCameraController.enableInputs = !locked;
    options.setFlightVisible(!locked);
    if (phase !== "navigate" && phase !== "portal") {
      route.show = false;
      routeEnd.show = false;
    }
    emit();
  }
  function stopPosition(): Position {
    const stop = JOURNEY_STOPS[status.index];
    return { lat: stop.lat, lng: stop.lng, height: stop.elevation, heading: 0 };
  }
  function setRoute(destination: Position) {
    target = destination; routeStart = { ...drone };
    routeEndPositions = Array.from({ length: 41 }, (_, index) => {
      const angle = (index / 40) * C.Math.TWO_PI;
      const point = offset(
        target,
        Math.cos(angle) * ROUTE_END_RADIUS_METERS,
        Math.sin(angle) * ROUTE_END_RADIUS_METERS,
      );
      return C.Cartesian3.fromDegrees(point.lng, point.lat);
    });
    updateRouteGeometry();
    if (status.phase === "portal") {
      markerPlaque.show = false;
      return;
    }
    const title = JOURNEY_STOPS[status.index].name;
    const plaquePosition = world({
      ...target,
      height: target.height + 42,
    });
    const ctx = markerCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, markerCanvas.width, markerCanvas.height);
    const fill = ctx.createLinearGradient(0, 0, 0, markerCanvas.height);
    fill.addColorStop(0, "#3b3e43");
    fill.addColorStop(1, "#25272b");
    ctx.beginPath();
    ctx.moveTo(60, 8);
    ctx.lineTo(1008, 8);
    ctx.lineTo(964, 248);
    ctx.lineTo(16, 248);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "#92959a";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "600 49px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 512, 128, 860);
    markerPlaque.position = new C.ConstantPositionProperty(plaquePosition);
    markerPlaque.plane!.material = new C.ImageMaterialProperty({
      image: markerCanvas.toDataURL(),
      transparent: true,
    });
    markerPlaque.show = true;
  }
  function updateRouteGeometry() {
    // Keep the line attached to the moving drone every rendered flight frame.
    // The destination circle is static and is rebuilt only when the target changes.
    routeStart = { ...drone };
    const routeDistance = distance(routeStart, target);
    const headingToTarget = bearing(routeStart, target);
    const routeLineEnd = routeDistance > ROUTE_END_RADIUS_METERS
      ? offset(
        target,
        -Math.sin(headingToTarget) * ROUTE_END_RADIUS_METERS,
        -Math.cos(headingToTarget) * ROUTE_END_RADIUS_METERS,
      )
      : routeStart;

    C.Cartesian3.fromDegrees(
      routeStart.lng,
      routeStart.lat,
      0,
      C.Ellipsoid.WGS84,
      routePositions[0],
    );
    C.Cartesian3.fromDegrees(
      routeLineEnd.lng,
      routeLineEnd.lat,
      0,
      C.Ellipsoid.WGS84,
      routePositions[1],
    );
    route.show = routeDistance > ROUTE_END_RADIUS_METERS;
    routeEnd.show = true;
  }
  function begin() {
    if (status.phase !== "tutorial") return;
    const guidance = navigationGuidance(JOURNEY_STOPS[status.index]);
    transition("navigate", guidance.message);
    setRoute({ ...stopPosition(), height: drone.height });
    playGuidance(guidance.audio);
  }
  function answer(index: number) {
    if (status.phase !== "question" || answered) return;
    const stop = JOURNEY_STOPS[status.index];
    status.selectedAnswer = index;
    status.answerCorrect = index === stop.answer;
    if (index !== stop.answer) {
      status.feedback = "Take another look. Try the other answer.";
    } else {
      answered = true;
      status.completed = status.index + 1;
      status.feedback = "Correct. You earned one flight boost. Press Enter to continue.";
      options.onCorrectAnswer();
      options.onLandmarkCompleted(status.completed, { ...drone });
    }
    emit();
  }
  function showQuestion() {
    audio?.pause(); answered = false; status.caption = "";
    transition("question", "Choose an answer.");
  }
  function playTourSegment(shot: number) {
    const stop = JOURNEY_STOPS[status.index];
    status.shot = shot;
    status.caption = stop.script[shot];
    segmentTime = 0;
    emit();

    audio = tourAudio[shot];
    if (!audio) return;

    audio.currentTime = 0;
    announceGuideAudio(audio);
    const playingAudio = audio;
    playOwnedAudio(
      playingAudio,
      () => audio === playingAudio,
      () => {
        if (audio === playingAudio) audio = undefined;
      },
    );
  }
  function playGuidance(src: string) {
    guidanceAudio?.pause();
    const clip = new Audio(src);
    clip.preload = "auto";
    clip.muted = audioMuted;
    guidanceAudio = clip;
    announceGuideAudio(clip);

    // A development remount can tear down this controller while play() is
    // still pending. Check ownership again when it settles so an abandoned
    // clip cannot keep speaking beside the live controller's clip.
    playOwnedAudio(
      clip,
      () => guidanceAudio === clip,
      () => {
        if (guidanceAudio === clip) guidanceAudio = undefined;
      },
    );
  }
  function finishTourSegment() {
    if (status.phase !== "cinematic") return;
    if (status.shot >= 2) {
      showQuestion();
      return;
    }
    playTourSegment(status.shot + 1);
  }
  function startTour() {
    const stop = JOURNEY_STOPS[status.index];
    const surface = options.surfaceHeight(stop.lat, stop.lng);
    tourCenter = world({ ...stopPosition(), height: Number.isFinite(surface) ? surface! + 12 : stop.elevation });
    tourStart = C.Cartesian3.clone(viewer.camera.positionWC);
    tourStartDirection = C.Cartesian3.clone(viewer.camera.directionWC);
    tourStartUp = C.Cartesian3.clone(viewer.camera.upWC);
    guidanceAudio?.pause();
    markerPlaque.show = false;
    status.shot = 0; status.caption = stop.script[0];
    transition("cinematic", "I've got the camera. The question will appear when the narration ends.");
    if (stop.audio) {
      tourAudio = stop.audio.map((src) => {
        const clip = new Audio(src);
        clip.preload = "auto";
        clip.muted = audioMuted;
        clip.addEventListener("ended", finishTourSegment, { once: true });
        clip.addEventListener("error", () => {
          if (audio === clip) audio = undefined;
        }, { once: true });
        clip.load();
        return clip;
      });
      playTourSegment(0);
    } else {
      tourAudio = [];
      audio = undefined;
    }
  }
  function positionTourCamera(
    cameraSettings: CinematicCameraSettings,
    heading: number,
  ) {
    const stop = JOURNEY_STOPS[status.index];
    const adjustedTourCenter = C.Cartesian3.add(
      tourCenter,
      C.Cartesian3.multiplyByScalar(
        C.Ellipsoid.WGS84.geodeticSurfaceNormal(tourCenter),
        cameraSettings.heightOffset,
        new C.Cartesian3(),
      ),
      new C.Cartesian3(),
    );
    viewer.camera.lookAt(
      adjustedTourCenter,
      new C.HeadingPitchRange(
        heading,
        radians(cameraSettings.pitch),
        stop.radius * cameraSettings.rangeMultiplier,
      ),
    );
    viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
  }
  function advance() {
    if (status.index === JOURNEY_STOPS.length - 1) {
      markerPlaque.show = false;
      transition("complete", "All twelve stops explored. Thanks for flying with me. You can keep exploring Iowa.");
      options.warp({ ...drone }); return;
    }
    const departedStop = JOURNEY_STOPS[status.index];
    status.index += 1;
    const next = stopPosition();
    options.warp({ ...drone });
    if (distance(drone, next) < DIRECT_FLIGHT_MAX_DISTANCE_METERS) {
      const guidance = navigationGuidance(JOURNEY_STOPS[status.index]);
      transition("navigate", guidance.message);
      setRoute({ ...next, height: drone.height });
      playGuidance(guidance.audio);
      return;
    }
    const portalGroundPoint = offset(
      drone,
      Math.sin(drone.heading) * 760,
      Math.cos(drone.heading) * 760,
    );
    portalCenter = {
      ...portalGroundPoint,
      // The first flight begins below Des Moines' ellipsoid elevation, while
      // later transfer approaches already include this clearance. Anchoring to
      // the stop makes every portal float in the same playable flight band.
      height: Math.max(
        drone.height,
        departedStop.elevation + (
          departedStop.id === "capitol"
            ? FIRST_PORTAL_FLIGHT_CLEARANCE_METERS
            : PORTAL_FLIGHT_CLEARANCE_METERS
        ),
      ),
    };
    portalBody.position = new C.ConstantPositionProperty(world(portalCenter));
    portalBody.show = true;
    previousPortalDroneWorld = world(drone);
    const guidance = portalGuidance(JOURNEY_STOPS[status.index]);
    transition("portal", guidance.message);
    setRoute(portalCenter);
    playGuidance(guidance.audio);
  }
  function keydown(event: KeyboardEvent) {
    if (event.repeat || (event.target instanceof HTMLElement && event.target.closest("input,textarea,button,summary,a"))) return;
    if (status.phase === "question") {
      if (event.key === "1" || event.key === "2") answer(Number(event.key) - 1);
      if (event.key === "Enter" && answered) advance();
    }
  }
  function action(event: Event) {
    const value = (event as CustomEvent<string>).detail;
    if (value === "skip" && status.phase === "cinematic") showQuestion();
    if (value === "next" && status.phase === "question" && answered) advance();
    if (value === "0" || value === "1") answer(Number(value));
  }
  function updateCinematicCamera(event: Event) {
    const detail = (event as CustomEvent<Partial<CinematicCameraSettings> & { index?: number; shot?: number }>).detail;
    if (
      !detail ||
      typeof detail.index !== "number" ||
      typeof detail.shot !== "number" ||
      typeof detail.heading !== "number" ||
      typeof detail.pitch !== "number" ||
      typeof detail.rangeMultiplier !== "number" ||
      typeof detail.heightOffset !== "number"
    ) return;
    cinematicCameraOverrides.set(`${detail.index}:${detail.shot}`, {
      heading: C.Math.clamp(detail.heading, -180, 180),
      pitch: C.Math.clamp(detail.pitch, -85, -5),
      rangeMultiplier: C.Math.clamp(detail.rangeMultiplier, 0.5, 2),
      heightOffset: C.Math.clamp(detail.heightOffset, -300, 300),
    });
  }
  window.addEventListener("iowa-tutorial-complete", begin);
  window.addEventListener("keydown", keydown);
  window.addEventListener("iowa-journey-action", action);
  window.addEventListener("iowa-cinematic-camera", updateCinematicCamera);
  function audioMutedChanged(event: Event) {
    audioMuted = Boolean((event as CustomEvent<boolean>).detail);
    for (const clip of tourAudio) clip.muted = audioMuted;
    if (guidanceAudio) guidanceAudio.muted = audioMuted;
  }
  window.addEventListener(AUDIO_MUTED_EVENT, audioMutedChanged);
  function visibilityChanged() {
    if (document.hidden) {
      audio?.pause();
      guidanceAudio?.pause();
    } else {
      if (status.phase === "cinematic" && audio) void audio.play().catch(() => undefined);
      if (guidanceAudio && !guidanceAudio.ended) void guidanceAudio.play().catch(() => undefined);
    }
  }
  document.addEventListener("visibilitychange", visibilityChanged);

  const checkpoint = options.resumeCheckpoint;

  if (checkpoint) {
    options.warp({ ...checkpoint.position });
    status = {
      ...INITIAL_JOURNEY,
      index: Math.min(checkpoint.completed - 1, JOURNEY_STOPS.length - 1),
      completed: Math.min(checkpoint.completed, JOURNEY_STOPS.length),
    };
    answered = true;
    advance();
  }

  return {
    get locked() { return ["cinematic", "question", "transfer"].includes(status.phase); },
    get isResting() { return status.phase === "question"; },
    get flightBoundaryCenter() {
      return status.phase === "complete"
        ? null
        : { lat: target.lat, lng: target.lng };
    },
    tick(delta: number) {
      if (document.hidden) return;
      elapsed += delta; phaseTime += delta;
      if (status.phase === "tutorial" || status.phase === "complete") return;
      if (status.phase === "cinematic") {
        segmentTime += delta;
        // Each composition waits for its own recording to finish. No tile
        // prefetch or additional root request is involved.
        const hasTimedNarration = Boolean(audio && Number.isFinite(audio.duration) && audio.duration > 0);
        const duration = hasTimedNarration ? audio!.duration : 13;
        const playbackTime = hasTimedNarration ? audio!.currentTime : segmentTime;
        const progress = Math.min(playbackTime / duration, 1);
        const shot = status.shot;
        const cameraSettings = cinematicCameraOverrides.get(`${status.index}:${shot}`)
          ?? getDefaultCinematicCamera(status.index, shot);
        const shotProgress = progress;
        const heading = radians(
          cameraSettings.heading + (reducedMotion ? 0 : (shotProgress - 0.5) * 14),
        );
        lastTourHeading = heading;
        positionTourCamera(cameraSettings, heading);
        if (phaseTime < 2.5 && !reducedMotion) {
          const t = ease(phaseTime / 2.5);
          const position = C.Cartesian3.lerp(tourStart, viewer.camera.positionWC, t, new C.Cartesian3());
          const direction = C.Cartesian3.normalize(C.Cartesian3.lerp(tourStartDirection, viewer.camera.directionWC, t, new C.Cartesian3()), new C.Cartesian3());
          const up = C.Cartesian3.normalize(C.Cartesian3.lerp(tourStartUp, viewer.camera.upWC, t, new C.Cartesian3()), new C.Cartesian3());
          viewer.camera.setView({ destination: position, orientation: { direction, up } });
        }
        // Recorded views advance from the audio's ended event. A missing or
        // failed recording gets a timed fallback so the journey cannot stall.
        if (!audio && progress >= 1) finishTourSegment();
        return;
      }
      if (status.phase === "question") {
        const cameraSettings = cinematicCameraOverrides.get(`${status.index}:${status.shot}`)
          ?? getDefaultCinematicCamera(status.index, status.shot);
        const questionHeading = lastTourHeading + (
          reducedMotion ? 0 : radians(phaseTime * 2.5)
        );
        positionTourCamera(cameraSettings, questionHeading);
        return;
      }
      if (status.phase === "transfer") {
        if (!transferMoved && phaseTime > 0.6) {
          transferMoved = true;
          const destination = stopPosition();
          const approach = offset({ ...destination, height: destination.height + 170 }, -600, -260);
          approach.heading = bearing(approach, destination);
          options.warp(approach);
        }
        if (phaseTime > 1.5) {
          const guidance = navigationGuidance(JOURNEY_STOPS[status.index]);
          transition("navigate", guidance.message);
          setRoute({ ...stopPosition(), height: drone.height });
          playGuidance(guidance.audio);
        }
        return;
      }
      const remaining = distance(drone, target);
      if (status.phase === "navigate" && phaseTime > 2 && remaining < 110) { startTour(); return; }
      updateRouteGeometry();
      if (status.phase === "portal") {
        const currentPortalDroneWorld = world(drone);
        const center = world(portalCenter);
        const travel = C.Cartesian3.subtract(
          currentPortalDroneWorld,
          previousPortalDroneWorld,
          new C.Cartesian3(),
        );
        const travelLengthSquared = C.Cartesian3.magnitudeSquared(travel);
        const alongTravel = travelLengthSquared > 0
          ? C.Math.clamp(
            C.Cartesian3.dot(
              C.Cartesian3.subtract(center, previousPortalDroneWorld, new C.Cartesian3()),
              travel,
            ) / travelLengthSquared,
            0,
            1,
          )
          : 0;
        const closestPoint = C.Cartesian3.add(
          previousPortalDroneWorld,
          C.Cartesian3.multiplyByScalar(travel, alongTravel, new C.Cartesian3()),
          new C.Cartesian3(),
        );
        const contactDistance = C.Cartesian3.distance(closestPoint, center);
        // The portal is a camera-facing billboard. Match its visible X/Y
        // footprint instead of requiring the drone to hit an invisible 3D
        // center at the same altitude.
        const overlapsDisplayedPortal = remaining <= PORTAL_HITBOX_RADIUS_METERS;
        previousPortalDroneWorld = currentPortalDroneWorld;
        if (contactDistance <= PORTAL_HITBOX_RADIUS_METERS || overlapsDisplayedPortal) {
          portalBody.show = false;
          markerPlaque.show = false;
          transferMoved = false;
          transition("transfer", "Teleporting"); return;
        }
      }
      if (elapsed - lastUpdate < 0.25) return;
      lastUpdate = elapsed;
      const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      status.direction = compass[Math.round((bearing(drone, target) + Math.PI * 2) / (Math.PI / 4)) % 8];
      status.targetBearing = C.Math.negativePiToPi(bearing(drone, target) - drone.heading);
      status.distance = Math.round(remaining);
      emit();
    },
    destroy() {
      isDestroyed = true;
      for (const clip of tourAudio) clip.pause();
      audio?.pause();
      guidanceAudio?.pause();
      tourAudio = [];
      audio = undefined;
      guidanceAudio = undefined;
      window.removeEventListener("iowa-tutorial-complete", begin);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("iowa-journey-action", action);
      window.removeEventListener("iowa-cinematic-camera", updateCinematicCamera);
      window.removeEventListener(AUDIO_MUTED_EVENT, audioMutedChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
      entities.forEach(entity => viewer.entities.remove(entity));
      viewer.scene.screenSpaceCameraController.enableInputs = true;
      options.setFlightVisible(true);
    },
  };
}
