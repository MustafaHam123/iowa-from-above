"use client";

import { FormEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { ACES_FILMIC_FRAGMENT_SHADER } from "./shaders/acesFilmic";
import { DEPTH_DISTANCE_BLUR_FRAGMENT_SHADER } from "./shaders/depthDistanceBlur";
import { PIXEL_FILTER_FRAGMENT_SHADER } from "./shaders/pixelFilter";
import {
  createJourneyController,
} from "./journeyController";
import { INITIAL_JOURNEY, JOURNEY_STOPS } from "./journeyStops";
import { EXHIBITS } from "./exhibits";
import LandmarkChat from "./LandmarkChat";
import OutroSequence from "./OutroSequence";
import {
  clearJourneyCheckpoint,
  loadJourneyCheckpoint,
  saveJourneyCheckpoint,
  type JourneyCheckpoint,
} from "./journeyProgress";
import {
  AUDIO_MUTED_EVENT,
  getStoredAudioMuted,
  setStoredAudioMuted,
} from "./audioPreferences";

type GoogleApiUsage = {
  month: string;
  counts: { root: number; render: number };
  limits: { root: number; render: number };
};

// HUD-only presentation scale. Flight physics and boundaries remain metric.
const MINIMUM_FLIGHT_ALTITUDE_FEET = 350;
const START_FLIGHT_ALTITUDE_FEET = 1_000;
const ALTITUDE_GAUGE_START_FEET = START_FLIGHT_ALTITUDE_FEET;
// Cesium's world height is calibrated separately from the flight HUD so the
// drone can sit visually closer to the photogrammetry while using a separate
// feet readout on the flight HUD.
const DRONE_START_HEIGHT_METERS = 300;
const MINIMUM_DRONE_HEIGHT_METERS = 110;
const MAXIMUM_DESCENT_FROM_START_METERS =
  DRONE_START_HEIGHT_METERS - MINIMUM_DRONE_HEIGHT_METERS;
const DISPLAYED_FEET_PER_WORLD_METER =
  (START_FLIGHT_ALTITUDE_FEET - MINIMUM_FLIGHT_ALTITUDE_FEET) /
  MAXIMUM_DESCENT_FROM_START_METERS;

const IOWA_BOUNDS = {
  north: 43.5012,
  south: 40.3755,
  west: -96.6397,
  east: -90.1401,
};

const DRONE_START = {
  lat: 41.590364,
  // Start a little farther west of the Capitol without changing latitude or altitude.
  lng: -93.6091,
  height: DRONE_START_HEIGHT_METERS,
};

const SUNSET_SKYBOX_SOURCES = {
  positiveX: "/sky/hdr-sunset-007/positiveX.jpg",
  negativeX: "/sky/hdr-sunset-007/negativeX.jpg",
  positiveY: "/sky/hdr-sunset-007/positiveY.jpg",
  negativeY: "/sky/hdr-sunset-007/negativeY.jpg",
  positiveZ: "/sky/hdr-sunset-007/positiveZ.jpg",
  negativeZ: "/sky/hdr-sunset-007/negativeZ.jpg",
};

const DRONE_SPEED_METERS_PER_SECOND = 105;
const DRONE_REVERSE_METERS_PER_SECOND = 58;
const DRONE_FAST_MULTIPLIER = 2.6;
const DRONE_ACCELERATION_METERS_PER_SECOND = 125;
const DRONE_VERTICAL_SPEED_METERS_PER_SECOND = 38;
const DRONE_VERTICAL_ACCELERATION_METERS_PER_SECOND = 52;
const DRONE_DRAG_PER_SECOND = 1.35;
const DRONE_TURN_RADIANS_PER_SECOND = Cesium.Math.toRadians(38);
const DRONE_TURN_ACCELERATION_RADIANS_PER_SECOND = Cesium.Math.toRadians(125);
const CAMERA_RANGE_METERS = 390;
const CAMERA_SPEED_PULLBACK_METERS = 85;
const CAMERA_PITCH_RADIANS = Cesium.Math.toRadians(-22);
const CAMERA_POSITION_FOLLOW_RATE = 2.35;
const CAMERA_HEADING_FOLLOW_RATE = 3.25;
const CAMERA_ATTITUDE_FOLLOW_RATE = 3.1;
const CAMERA_PITCH_INFLUENCE = 0.62;
const CAMERA_ROLL_INFLUENCE = 0.68;
// Compensate for the converted FBX's visual center after its axis correction.
const CAMERA_SCREEN_TARGET_LIFT_METERS = 120;
const SPEED_PARTICLE_MAX_COUNT = 160;
const SPEED_PARTICLE_NEAR_DISTANCE_METERS = 85;
const SPEED_PARTICLE_FAR_DISTANCE_METERS = 430;
const ACTIVE_FLIGHT_FRAME_RATE = 30;
const IDLE_FLIGHT_FRAME_RATE = 24;
const IDLE_FRAME_RATE_DELAY_MS = 1_200;
const MAP_MAXIMUM_REQUESTS = 24;
const MAP_MAXIMUM_REQUESTS_PER_SERVER = 12;
const API_USAGE_REFRESH_INTERVAL_MS = 30_000;
const CINEMATIC_SKIP_HOLD_MS = 1_500;
const MODEL_AXIS_FIX = new Cesium.HeadingPitchRoll(
  Cesium.Math.toRadians(-90),
  0,
  0,
);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function approach(current: number, target: number, maximumStep: number) {
  return current + clamp(target - current, -maximumStep, maximumStep);
}

type FlightAudio = {
  context: AudioContext;
  windSource: AudioBufferSourceNode;
  windGain: GainNode;
  windFilter: BiquadFilterNode;
};

type SpeedParticle = {
  point: Cesium.PointPrimitive;
  velocity: Cesium.Cartesian3;
  ageSeconds: number;
  lifetimeSeconds: number;
  startPixelSize: number;
  baseAlpha: number;
  color: Cesium.Color;
};

type VisualSettings = {
  clarity: number;
  vibrance: number;
  splitTone: number;
  exposure: number;
  aces: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  warmth: number;
  shadows: number;
  highlights: number;
  fade: number;
  vignette: number;
  filterStrength: number;
  bloom: number;
  bloomRadius: number;
  lightIntensity: number;
  lightWarmth: number;
  lightHeading: number;
  pixelSize: number;
  pixelStrength: number;
};

const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  clarity: 0.22,
  vibrance: 0.2,
  splitTone: 0.65,
  exposure: 1.12,
  aces: 0,
  brightness: 0,
  contrast: 1.08,
  saturation: 1.04,
  hue: 0,
  warmth: 0.12,
  shadows: 0.018,
  highlights: -0.025,
  fade: 0,
  vignette: 0.1,
  filterStrength: 0.85,
  bloom: 0,
  bloomRadius: 1,
  lightIntensity: 2.2,
  lightWarmth: 0.57,
  lightHeading: 202,
  pixelSize: 1,
  pixelStrength: 0,
};

async function fetchAudioBuffer(context: AudioContext, url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load flight audio: ${url}`);
  }

  return context.decodeAudioData(await response.arrayBuffer());
}

async function createFlightAudio(): Promise<FlightAudio> {
  const context = new AudioContext();
  await context.resume();

  const windBuffer = await fetchAudioBuffer(context, "/audio/wind.mp3");

  const windSource = context.createBufferSource();
  const windGain = context.createGain();
  const windFilter = context.createBiquadFilter();
  windSource.buffer = windBuffer;
  windSource.loop = true;
  windSource.loopStart = 0.2;
  windSource.loopEnd = Math.max(0.4, windBuffer.duration - 0.2);
  windSource.playbackRate.value = 0.72;
  windFilter.type = "highpass";
  windFilter.frequency.value = 140;
  windGain.gain.value = 0;
  windSource.connect(windFilter).connect(windGain).connect(context.destination);

  windSource.start(0, Math.min(8, windBuffer.duration * 0.25));

  return {
    context,
    windSource,
    windGain,
    windFilter,
  };
}

function moveMeters(
  position: { lat: number; lng: number },
  heading: number,
  meters: number,
) {
  const northMeters = Math.cos(heading) * meters;
  const eastMeters = Math.sin(heading) * meters;
  const metersPerDegreeLatitude = 111_320;
  const metersPerDegreeLongitude =
    metersPerDegreeLatitude * Math.cos(Cesium.Math.toRadians(position.lat));

  return {
    lat: position.lat + northMeters / metersPerDegreeLatitude,
    lng: position.lng + eastMeters / metersPerDegreeLongitude,
  };
}

function clampToBounds(
  position: { lat: number; lng: number },
  bounds: typeof IOWA_BOUNDS,
) {
  return {
    lat: clamp(position.lat, bounds.south, bounds.north),
    lng: clamp(position.lng, bounds.west, bounds.east),
  };
}

function applyVisualSettings(
  viewer: Cesium.Viewer,
  gradeStage: Cesium.PostProcessStage | undefined,
  pixelStage: Cesium.PostProcessStage | undefined,
  farBlurStage: Cesium.PostProcessStage | undefined,
  settings: VisualSettings,
) {
  const scene = viewer.scene;
  const bloom = scene.postProcessStages.bloom;
  const lightHeading = Cesium.Math.toRadians(settings.lightHeading);

  scene.postProcessStages.exposure = settings.exposure;
  bloom.enabled = settings.bloom > 0;
  bloom.uniforms.contrast = 170 + settings.bloom * 60;
  bloom.uniforms.brightness = -0.75 + settings.bloom * 0.38;
  bloom.uniforms.delta = settings.bloomRadius;
  bloom.uniforms.sigma = 1.2 + settings.bloomRadius * 1.2;
  bloom.uniforms.stepSize = settings.bloomRadius;

  scene.light = new Cesium.DirectionalLight({
    direction: Cesium.Cartesian3.normalize(
      new Cesium.Cartesian3(
        Math.sin(lightHeading),
        Math.cos(lightHeading),
        -0.64,
      ),
      new Cesium.Cartesian3(),
    ),
    color: new Cesium.Color(
      1 + Math.max(settings.lightWarmth, 0) * 0.24,
      1 + Math.min(settings.lightWarmth, 0) * 0.14,
      1 - Math.max(settings.lightWarmth, 0) * 0.22,
      1,
    ),
    intensity: settings.lightIntensity,
  });

  if (!gradeStage) {
    return;
  }

  gradeStage.uniforms.acesExposure = settings.exposure;
  gradeStage.uniforms.clarity = window.matchMedia("(pointer: coarse)").matches
    ? 0 : settings.clarity;
  gradeStage.uniforms.vibrance = settings.vibrance;
  gradeStage.uniforms.splitTone = settings.splitTone;
  gradeStage.uniforms.acesStrength = settings.aces;
  gradeStage.uniforms.brightness = settings.brightness;
  gradeStage.uniforms.contrast = settings.contrast;
  gradeStage.uniforms.saturation = settings.saturation;
  gradeStage.uniforms.hue = Cesium.Math.toRadians(settings.hue);
  gradeStage.uniforms.warmth = settings.warmth;
  gradeStage.uniforms.shadows = settings.shadows;
  gradeStage.uniforms.highlights = settings.highlights;
  gradeStage.uniforms.fade = settings.fade;
  gradeStage.uniforms.vignette = settings.vignette;
  gradeStage.uniforms.filterStrength = settings.filterStrength;

  if (!pixelStage) {
    return;
  }

  pixelStage.enabled = settings.pixelStrength > 0;
  pixelStage.uniforms.pixelSize = settings.pixelSize;
  pixelStage.uniforms.pixelStrength = settings.pixelStrength;

  if (!farBlurStage) {
    return;
  }

  farBlurStage.enabled = false;
}

function applyGoldenHourPreset(
  viewer: Cesium.Viewer,
  settings: VisualSettings,
) {
  const scene = viewer.scene;

  scene.backgroundColor = Cesium.Color.fromCssColorString("#1d2430");
  scene.highDynamicRange = true;
  scene.postProcessStages.fxaa.enabled = true;

  const gradeStage = scene.postProcessStages.add(
    new Cesium.PostProcessStage({
      name: "threejs_aces_filmic_tone_mapping",
      fragmentShader: ACES_FILMIC_FRAGMENT_SHADER,
      uniforms: {
        clarity: settings.clarity,
        vibrance: settings.vibrance,
        splitTone: settings.splitTone,
        acesExposure: settings.exposure,
        acesStrength: settings.aces,
        brightness: settings.brightness,
        contrast: settings.contrast,
        saturation: settings.saturation,
        hue: Cesium.Math.toRadians(settings.hue),
        warmth: settings.warmth,
        shadows: settings.shadows,
        highlights: settings.highlights,
        fade: settings.fade,
        vignette: settings.vignette,
        filterStrength: settings.filterStrength,
      },
    }),
  ) as Cesium.PostProcessStage;

  const pixelStage = scene.postProcessStages.add(
    new Cesium.PostProcessStage({
      name: "pixel_filter_overlay",
      fragmentShader: PIXEL_FILTER_FRAGMENT_SHADER,
      uniforms: {
        viewportSize: () =>
          new Cesium.Cartesian2(
            viewer.scene.drawingBufferWidth,
            viewer.scene.drawingBufferHeight,
          ),
        pixelSize: settings.pixelSize,
        pixelStrength: settings.pixelStrength,
      },
    }),
  ) as Cesium.PostProcessStage;

  const farBlurStage = scene.postProcessStages.add(
    new Cesium.PostProcessStage({
      name: "depth_distance_far_blur",
      fragmentShader: DEPTH_DISTANCE_BLUR_FRAGMENT_SHADER,
      uniforms: {
        viewportSize: () =>
          new Cesium.Cartesian2(
            viewer.scene.drawingBufferWidth,
            viewer.scene.drawingBufferHeight,
          ),
        blurStartMeters: 850,
        blurEndMeters: 2_800,
        maxRadiusPixels: 2.8,
        blurStrength: 0.72,
      },
    }),
  ) as Cesium.PostProcessStage;

  scene.postProcessStages.ambientOcclusion.enabled = false;
  applyVisualSettings(viewer, gradeStage, pixelStage, farBlurStage, settings);

  return { gradeStage, pixelStage, farBlurStage };
}

export default function IowaTileMap() {
  const cesiumRef = useRef<HTMLDivElement>(null);
  const droneOverlayRef = useRef<HTMLDivElement>(null);
  const altitudeReadoutRef = useRef<HTMLOutputElement>(null);
  const speedReadoutRef = useRef<HTMLOutputElement>(null);
  const speedRevRef = useRef<HTMLDivElement>(null);
  const altitudeRevRef = useRef<HTMLDivElement>(null);
  const compassNeedleRef = useRef<HTMLSpanElement>(null);
  const boostChargesRef = useRef(0);
  const boostActiveUntilRef = useRef(0);
  const boostActiveRef = useRef(false);
  const activateBoostRef = useRef<(() => void) | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const teleportDroneRef = useRef<
    ((destination: { lat: number; lng: number }) => void) | null
  >(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const gradeStageRef = useRef<Cesium.PostProcessStage | undefined>(undefined);
  const pixelStageRef = useRef<Cesium.PostProcessStage | undefined>(undefined);
  const farBlurStageRef = useRef<Cesium.PostProcessStage | undefined>(undefined);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [addressMessage, setAddressMessage] = useState("");
  const [isFindingAddress, setIsFindingAddress] = useState(false);
  const [isQuotaReached, setIsQuotaReached] = useState(false);
  const [journeyStatus, setJourneyStatus] = useState(INITIAL_JOURNEY);
  const [boostStatus, setBoostStatus] = useState({ charges: 0, active: false });
  const [isCinematicSkipHolding, setIsCinematicSkipHolding] = useState(false);
  const cinematicSkipTimerRef = useRef<number | null>(null);
  const [googleApiUsage, setGoogleApiUsage] =
    useState<GoogleApiUsage | null>(null);
  const [isApiStatsOpen, setIsApiStatsOpen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const currentExhibit = EXHIBITS[journeyStatus.index];

  useEffect(() => {
    const restoreTimer = window.setTimeout(
      () => setIsAudioMuted(getStoredAudioMuted()),
      0,
    );
    return () => window.clearTimeout(restoreTimer);
  }, []);

  function toggleAudioMuted() {
    setIsAudioMuted((current) => {
      const next = !current;
      setStoredAudioMuted(next);
      return next;
    });
  }

  function pressMobileFlightControl(
    event: ReactPointerEvent<HTMLButtonElement>,
    key: string,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }

  function releaseMobileFlightControl(
    event: ReactPointerEvent<HTMLButtonElement>,
    key: string,
  ) {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
  }

  function cancelCinematicSkip() {
    if (cinematicSkipTimerRef.current !== null) {
      window.clearTimeout(cinematicSkipTimerRef.current);
      cinematicSkipTimerRef.current = null;
    }
    setIsCinematicSkipHolding(false);
  }

  function startCinematicSkip(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (journeyStatus.phase !== "cinematic" || cinematicSkipTimerRef.current !== null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsCinematicSkipHolding(true);
    cinematicSkipTimerRef.current = window.setTimeout(() => {
      cinematicSkipTimerRef.current = null;
      setIsCinematicSkipHolding(false);
      window.dispatchEvent(new CustomEvent("iowa-journey-action", { detail: "skip" }));
    }, CINEMATIC_SKIP_HOLD_MS);
  }

  useEffect(() => {
    return () => {
      if (cinematicSkipTimerRef.current !== null) {
        window.clearTimeout(cinematicSkipTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isApiStatsOpen) {
      return;
    }

    let isCancelled = false;

    async function refreshGoogleApiUsage() {
      try {
        const response = await fetch("/api/google-usage", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const usage = (await response.json()) as GoogleApiUsage;

        if (!isCancelled) {
          setGoogleApiUsage(usage);
        }
      } catch {
        // The tracker is diagnostic only and must never interrupt the game.
      }
    }

    void refreshGoogleApiUsage();
    const refreshInterval = window.setInterval(
      refreshGoogleApiUsage,
      API_USAGE_REFRESH_INTERVAL_MS,
    );

    return () => {
      isCancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [isApiStatsOpen]);

  useEffect(() => {
    if (isAddressOpen) {
      addressInputRef.current?.focus();
    }
  }, [isAddressOpen]);

  function openAddressSearchFromJourneyPrompt() {
    setAddressMessage("");
    setIsAddressOpen(true);
  }

  async function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!address.trim() || isFindingAddress) {
      return;
    }

    setIsFindingAddress(true);
    setAddressMessage("Finding Iowa address...");

    try {
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(address.trim())}`,
      );
      const result = (await response.json()) as {
        address?: string;
        error?: string;
        lat?: number;
        lng?: number;
      };

      if (
        !response.ok ||
        typeof result.lat !== "number" ||
        typeof result.lng !== "number"
      ) {
        throw new Error(result.error ?? "Iowa address not found.");
      }

      teleportDroneRef.current?.({ lat: result.lat, lng: result.lng });
      setAddress(result.address ?? address);
      setAddressMessage("Teleported");
    } catch (error) {
      setAddressMessage(
        error instanceof Error ? error.message : "Iowa address not found.",
      );
    } finally {
      setIsFindingAddress(false);
    }
  }

  useEffect(() => {
    const container = cesiumRef.current;
    const droneOverlayContainer = droneOverlayRef.current;
    const altitudeReadout = altitudeReadoutRef.current;
    const speedReadout = speedReadoutRef.current;
    const speedRev = speedRevRef.current;
    const altitudeRev = altitudeRevRef.current;

    if (!container || !droneOverlayContainer) {
      return;
    }

    setIsQuotaReached(false);

    const previousMaximumRequests = Cesium.RequestScheduler.maximumRequests;
    const previousMaximumRequestsPerServer =
      Cesium.RequestScheduler.maximumRequestsPerServer;
    Cesium.RequestScheduler.maximumRequests = MAP_MAXIMUM_REQUESTS;
    Cesium.RequestScheduler.maximumRequestsPerServer =
      MAP_MAXIMUM_REQUESTS_PER_SERVER;

    const viewer = new Cesium.Viewer(container, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      globe: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      targetFrameRate: ACTIVE_FLIGHT_FRAME_RATE,
      requestRenderMode: true,
      maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      msaaSamples: 1,
    });
    viewerRef.current = viewer;

    const cleanDroneViewer = new Cesium.Viewer(droneOverlayContainer, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      globe: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      targetFrameRate: ACTIVE_FLIGHT_FRAME_RATE,
      requestRenderMode: false,
      shouldAnimate: true,
      useDefaultRenderLoop: false,
      orderIndependentTranslucency: false,
      msaaSamples: 2,
      skyAtmosphere: false,
      skyBox: false,
      contextOptions: {
        webgl: {
          alpha: true,
          antialias: true,
        },
      },
    });

    viewer.scene.skyAtmosphere = undefined;
    // A real skybox renders behind 3D Tiles. CubeMapPanorama is a scene
    // primitive and could intersect the depth/render pipeline as tiles arrived.
    viewer.scene.skyBox = new Cesium.SkyBox({
      sources: SUNSET_SKYBOX_SOURCES,
    });
    viewer.resolutionScale = 1;
    cleanDroneViewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
    cleanDroneViewer.scene.skyAtmosphere = undefined;
    cleanDroneViewer.scene.skyBox = undefined;
    cleanDroneViewer.scene.highDynamicRange = false;
    cleanDroneViewer.scene.fog.enabled = false;
    cleanDroneViewer.resolutionScale = 1;
    cleanDroneViewer.scene.postProcessStages.fxaa.enabled = false;
    (cleanDroneViewer.cesiumWidget.creditContainer as HTMLElement).style.display =
      "none";
    const visualStages = applyGoldenHourPreset(viewer, DEFAULT_VISUAL_SETTINGS);
    gradeStageRef.current = visualStages.gradeStage;
    pixelStageRef.current = visualStages.pixelStage;
    farBlurStageRef.current = visualStages.farBlurStage;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 90;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 95_000;
    viewer.scene.screenSpaceCameraController.inertiaSpin = 0.35;
    viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.25;
    viewer.scene.screenSpaceCameraController.inertiaZoom = 0.25;
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableTilt = true;

    let isDestroyed = false;
    let tileset: Cesium.Cesium3DTileset | undefined;
    let hasVisibleMapContent = false;
    let flightAudio: FlightAudio | undefined;
    let flightAudioPromise: Promise<FlightAudio> | undefined;
    let flightAudioMuted = getStoredAudioMuted();

    function handleAudioMuted(event: Event) {
      flightAudioMuted = Boolean((event as CustomEvent<boolean>).detail);
      if (flightAudio) {
        flightAudio.windGain.gain.setTargetAtTime(
          flightAudioMuted ? 0 : flightAudio.windGain.gain.value,
          flightAudio.context.currentTime,
          0.04,
        );
      }
    }
    window.addEventListener(AUDIO_MUTED_EVENT, handleAudioMuted);

    function startFlightAudio() {
      if (flightAudio) {
        void flightAudio.context.resume();
        return;
      }

      if (flightAudioPromise) {
        return;
      }

      flightAudioPromise = createFlightAudio()
        .then((loadedAudio) => {
          if (isDestroyed) {
            loadedAudio.windSource.stop();
            void loadedAudio.context.close();
            return loadedAudio;
          }

          flightAudio = loadedAudio;
          return loadedAudio;
        })
        .catch(() => {
          flightAudioPromise = undefined;
          throw new Error("Flight audio could not be initialized");
        });

      void flightAudioPromise.catch(() => undefined);
    }

    function showMapQuotaNotice() {
      setIsQuotaReached(true);
    }

    void Cesium.Cesium3DTileset.fromUrl(
      "/api/google-3d/root.json?appSession=2026-09-05-quota-refresh-3",
      {
        showCreditsOnScreen: true,
        maximumScreenSpaceError: 24,
        cacheBytes: 384 * 1024 * 1024,
        maximumCacheOverflowBytes: 128 * 1024 * 1024,
        cullWithChildrenBounds: true,
        cullRequestsWhileMoving: true,
        cullRequestsWhileMovingMultiplier: 60,
        progressiveResolutionHeightFraction: 0.35,
        foveatedScreenSpaceError: true,
        foveatedConeSize: 0.35,
        foveatedMinimumScreenSpaceErrorRelaxation: 8,
        foveatedTimeDelay: 0.25,
        dynamicScreenSpaceError: true,
        dynamicScreenSpaceErrorDensity: 0.004,
        dynamicScreenSpaceErrorFactor: 20,
        skipLevelOfDetail: false,
        loadSiblings: false,
        preloadWhenHidden: false,
        preloadFlightDestinations: false,
      },
    )
      .then((loadedTileset) => {
        if (isDestroyed) {
          loadedTileset.destroy();
          return;
        }

        loadedTileset.tileVisible.addEventListener(() => {
          if (!hasVisibleMapContent) {
            hasVisibleMapContent = true;
            setIsQuotaReached(false);
          }
        });
        loadedTileset.tileFailed.addEventListener(
          (error: { message?: string }) => {
            if (
              !hasVisibleMapContent &&
              /status code:\s*429/i.test(error.message ?? "")
            ) {
              showMapQuotaNotice();
            }
          },
        );

        tileset = loadedTileset;
        viewer.scene.primitives.add(loadedTileset);
      })
      .catch((error: unknown) => {
        if (/status(?: code)?:\s*429/i.test(String(error))) {
          showMapQuotaNotice();
        }
      });

    const savedJourneyCheckpoint = loadJourneyCheckpoint();
    let latestJourneyCheckpoint: JourneyCheckpoint | undefined =
      savedJourneyCheckpoint;
    const initialDronePosition = savedJourneyCheckpoint?.position ?? {
      lat: DRONE_START.lat,
      lng: DRONE_START.lng,
      height: DRONE_START.height,
      heading: Cesium.Math.toRadians(74.5),
    };
    boostChargesRef.current = savedJourneyCheckpoint?.boostCharges ?? 0;
    setBoostStatus({
      charges: boostChargesRef.current,
      active: false,
    });

    const activeKeys = new Set<string>();
    const drone = {
      ...initialDronePosition,
      pitch: 0,
      roll: 0,
    };
    let flightBounds = IOWA_BOUNDS;
    let hoverOffsetMeters = 0;
    let cameraHeading = drone.heading;
    let cameraPitch = CAMERA_PITCH_RADIANS;
    let cameraRoll = 0;
    let cameraRange = CAMERA_RANGE_METERS;
    const cameraFollow = {
      lat: drone.lat,
      lng: drone.lng,
      height: drone.height,
    };

    function dronePosition(result?: Cesium.Cartesian3) {
      return Cesium.Cartesian3.fromDegrees(
        drone.lng,
        drone.lat,
        drone.height + hoverOffsetMeters,
        Cesium.Ellipsoid.WGS84,
        result,
      );
    }

    const modelAxisFixQuaternion =
      Cesium.Quaternion.fromHeadingPitchRoll(MODEL_AXIS_FIX);

    function droneOrientation(result?: Cesium.Quaternion) {
      const flightOrientation = Cesium.Transforms.headingPitchRollQuaternion(
        dronePosition(),
        new Cesium.HeadingPitchRoll(
          drone.heading,
          drone.pitch,
          drone.roll,
        ),
      );

      return Cesium.Quaternion.multiply(
        flightOrientation,
        modelAxisFixQuaternion,
        result ?? new Cesium.Quaternion(),
      );
    }

    const dronePositionProperty = new Cesium.CallbackPositionProperty(
      (_time, result) => dronePosition(result),
      false,
    );
    const droneOrientationProperty = new Cesium.CallbackProperty(
      (_time, result) =>
        droneOrientation(result instanceof Cesium.Quaternion ? result : undefined),
      false,
    );

    cleanDroneViewer.entities.add({
      position: dronePositionProperty,
      orientation: droneOrientationProperty,
      model: {
        uri: "/drone/Drone.glb?v=white-slow-spin",
        scale: 0.85,
        minimumPixelSize: 180,
        maximumScale: 2.2,
        runAnimations: true,
      },
    });

    const particlePoints = viewer.scene.primitives.add(
      new Cesium.PointPrimitiveCollection(),
    );
    const speedParticles: SpeedParticle[] = [];
    let particleSpawnAccumulator = 0;

    if (viewer.camera.frustum instanceof Cesium.PerspectiveFrustum) {
      viewer.camera.frustum.fov = Cesium.Math.toRadians(48);
    }

    const cameraTarget = new Cesium.Cartesian3();
    const cameraOffset = new Cesium.HeadingPitchRange(
      cameraHeading,
      CAMERA_PITCH_RADIANS,
      cameraRange,
    );

    function setCameraOnDrone() {
      Cesium.Cartesian3.fromDegrees(
        cameraFollow.lng,
        cameraFollow.lat,
        cameraFollow.height + CAMERA_SCREEN_TARGET_LIFT_METERS,
        Cesium.Ellipsoid.WGS84,
        cameraTarget,
      );
      cameraOffset.heading = cameraHeading;
      cameraOffset.pitch = cameraPitch;
      cameraOffset.range = cameraRange;

      viewer.camera.lookAt(cameraTarget, cameraOffset);
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.camera.twistLeft(cameraRoll);
      viewer.scene.requestRender();
      cleanDroneViewer.camera.setView({
        destination: viewer.camera.positionWC,
        orientation: {
          direction: viewer.camera.directionWC,
          up: viewer.camera.upWC,
        },
      });
      cleanDroneViewer.render();
    }

    setCameraOnDrone();

    let currentFrameRate = ACTIVE_FLIGHT_FRAME_RATE;
    let lastFlightActivityAt = performance.now();

    function setFlightFrameRate(frameRate: number) {
      if (currentFrameRate === frameRate) {
        return;
      }

      currentFrameRate = frameRate;
      viewer.targetFrameRate = frameRate;
    }

    function markFlightActive() {
      lastFlightActivityAt = performance.now();
      setFlightFrameRate(ACTIVE_FLIGHT_FRAME_RATE);
    }

    function setKey(event: KeyboardEvent, isDown: boolean) {
      if (journey.locked) return;
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (
        key === "w" ||
        key === "a" ||
        key === "s" ||
        key === "d" ||
        key === "q" ||
        key === "e" ||
        key === "shift"
      ) {
        event.preventDefault();

        if (isDown) {
          activeKeys.add(key);
          markFlightActive();
        } else {
          activeKeys.delete(key);
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      startFlightAudio();

      if (event.key.toLowerCase() === "b" && !event.repeat) {
        event.preventDefault();
        activateBoost();
        return;
      }

      setKey(event, true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      setKey(event, false);
    }

    function handleBlur() {
      activeKeys.clear();
    }

    function handlePointerDown() {
      startFlightAudio();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pointerdown", handlePointerDown, { once: true });

    let lastTick = performance.now();
    let flightTimeSeconds = 0;
    let forwardVelocityMetersPerSecond = 0;
    let verticalVelocityMetersPerSecond = 0;
    let turnVelocityRadiansPerSecond = 0;
    let altitudeReferenceHeightMeters = drone.height;
    let minimumDroneHeightMeters =
      altitudeReferenceHeightMeters - MAXIMUM_DESCENT_FROM_START_METERS;
    let displayedAltitudeFeet = START_FLIGHT_ALTITUDE_FEET;

    function awardBoost() {
      boostChargesRef.current = Math.min(3, boostChargesRef.current + 1);
      setBoostStatus({
        charges: boostChargesRef.current,
        active: boostActiveRef.current,
      });
    }

    function activateBoost() {
      if (
        journey.locked ||
        boostActiveRef.current ||
        boostChargesRef.current < 1
      ) {
        return;
      }

      boostChargesRef.current -= 1;
      if (latestJourneyCheckpoint) {
        latestJourneyCheckpoint = {
          ...latestJourneyCheckpoint,
          boostCharges: boostChargesRef.current,
        };
        saveJourneyCheckpoint(latestJourneyCheckpoint);
      }
      boostActiveRef.current = true;
      boostActiveUntilRef.current = performance.now() + 8_000;
      setBoostStatus({ charges: boostChargesRef.current, active: true });
      markFlightActive();
    }

    activateBoostRef.current = activateBoost;

    const journey = createJourneyController({
      viewer,
      drone,
      onStatus: setJourneyStatus,
      onCorrectAnswer: awardBoost,
      resumeCheckpoint: savedJourneyCheckpoint,
      onLandmarkCompleted: (completed, position) => {
        latestJourneyCheckpoint = {
          completed,
          position,
          boostCharges: boostChargesRef.current,
        };
        saveJourneyCheckpoint(latestJourneyCheckpoint);
      },
      surfaceHeight: (lat, lng) => tileset?.getHeight(Cesium.Cartographic.fromDegrees(lng, lat), viewer.scene),
      setFlightVisible: (visible) => {
        droneOverlayContainer.style.visibility = visible ? "visible" : "hidden";
        particlePoints.show = visible;
        activeKeys.clear();
        forwardVelocityMetersPerSecond = 0;
        verticalVelocityMetersPerSecond = 0;
        turnVelocityRadiansPerSecond = 0;
        markFlightActive();
      },
      warp: (position) => {
        Object.assign(drone, position, { pitch: 0, roll: 0 });
        Object.assign(cameraFollow, { lat: drone.lat, lng: drone.lng, height: drone.height });
        cameraHeading = drone.heading;
        cameraPitch = CAMERA_PITCH_RADIANS;
        cameraRoll = 0;
        altitudeReferenceHeightMeters = drone.height;
        minimumDroneHeightMeters = drone.height - MAXIMUM_DESCENT_FROM_START_METERS;
        displayedAltitudeFeet = START_FLIGHT_ALTITUDE_FEET;
        activeKeys.clear();
        forwardVelocityMetersPerSecond = verticalVelocityMetersPerSecond = turnVelocityRadiansPerSecond = 0;
        setCameraOnDrone();
      },
    });
    function handleVisibilityChange() {
      const isVisible = !document.hidden;

      viewer.useDefaultRenderLoop = isVisible;

      if (isVisible) {
        lastTick = performance.now();
        markFlightActive();
        viewer.scene.requestRender();
        if (!journey.locked) setCameraOnDrone();
      } else if (flightAudio) {
        void flightAudio.context.suspend();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    teleportDroneRef.current = (destination) => {
      if (journey.locked) return;
      const iowaDestination = clampToBounds(destination, IOWA_BOUNDS);
      flightBounds = IOWA_BOUNDS;
      drone.lat = iowaDestination.lat;
      drone.lng = iowaDestination.lng;
      drone.height = Math.max(drone.height, DRONE_START.height);
      altitudeReferenceHeightMeters = drone.height;
      minimumDroneHeightMeters =
        altitudeReferenceHeightMeters - MAXIMUM_DESCENT_FROM_START_METERS;
      displayedAltitudeFeet = START_FLIGHT_ALTITUDE_FEET;
      cameraFollow.lat = drone.lat;
      cameraFollow.lng = drone.lng;
      cameraFollow.height = drone.height;
      forwardVelocityMetersPerSecond = 0;
      verticalVelocityMetersPerSecond = 0;
      turnVelocityRadiansPerSecond = 0;
      activeKeys.clear();
      markFlightActive();
      setCameraOnDrone();
    };

    function spawnSpeedParticle(speedEffectAmount: number) {
      const camera = viewer.camera;
      const distance =
        SPEED_PARTICLE_NEAR_DISTANCE_METERS +
        Math.random() *
          (SPEED_PARTICLE_FAR_DISTANCE_METERS -
            SPEED_PARTICLE_NEAR_DISTANCE_METERS);
      const angle = Math.random() * Cesium.Math.TWO_PI;
      const radialAmount = Math.sqrt(0.16 + Math.random() * 0.84);
      const sideOffset =
        Math.cos(angle) * distance * 0.5 * radialAmount;
      const verticalOffset =
        Math.sin(angle) * distance * 0.3 * radialAmount;
      const position = Cesium.Cartesian3.clone(camera.positionWC);

      Cesium.Cartesian3.add(
        position,
        Cesium.Cartesian3.multiplyByScalar(
          camera.directionWC,
          distance,
          new Cesium.Cartesian3(),
        ),
        position,
      );
      Cesium.Cartesian3.add(
        position,
        Cesium.Cartesian3.multiplyByScalar(
          camera.rightWC,
          sideOffset,
          new Cesium.Cartesian3(),
        ),
        position,
      );
      Cesium.Cartesian3.add(
        position,
        Cesium.Cartesian3.multiplyByScalar(
          camera.upWC,
          verticalOffset,
          new Cesium.Cartesian3(),
        ),
        position,
      );

      const rushSpeed =
        170 + speedEffectAmount * 430 + Math.random() * 120;
      const velocity = Cesium.Cartesian3.multiplyByScalar(
        camera.directionWC,
        -rushSpeed,
        new Cesium.Cartesian3(),
      );
      Cesium.Cartesian3.add(
        velocity,
        Cesium.Cartesian3.multiplyByScalar(
          camera.rightWC,
          sideOffset * 0.18,
          new Cesium.Cartesian3(),
        ),
        velocity,
      );
      Cesium.Cartesian3.add(
        velocity,
        Cesium.Cartesian3.multiplyByScalar(
          camera.upWC,
          verticalOffset * 0.18,
          new Cesium.Cartesian3(),
        ),
        velocity,
      );

      const particleColors = ["#f5f2e9", "#d8d4ca", "#eef0ef"];
      const color = Cesium.Color.fromCssColorString(
        particleColors[Math.floor(Math.random() * particleColors.length)],
      );
      const baseAlpha = 0.16 + speedEffectAmount * 0.28 + Math.random() * 0.12;
      const startPixelSize = 0.9 + Math.random() * 1.8;
      const point = particlePoints.add({
        position,
        color: color.withAlpha(baseAlpha),
        outlineWidth: 0,
        pixelSize: startPixelSize,
      });

      speedParticles.push({
        point,
        velocity,
        ageSeconds: 0,
        lifetimeSeconds: (distance + 80) / rushSpeed,
        startPixelSize,
        baseAlpha,
        color,
      });

      if (speedParticles.length > SPEED_PARTICLE_MAX_COUNT) {
        const oldestParticle = speedParticles.shift();
        if (oldestParticle) {
          particlePoints.remove(oldestParticle.point);
        }
      }
    }

    const removeTick = viewer.clock.onTick.addEventListener(() => {
      const now = performance.now();
      const deltaSeconds = Math.min((now - lastTick) / 1000, 0.08);
      lastTick = now;
      flightTimeSeconds += deltaSeconds;
      journey.tick(deltaSeconds);

      if (boostActiveRef.current && now >= boostActiveUntilRef.current) {
        boostActiveRef.current = false;
        setBoostStatus({ charges: boostChargesRef.current, active: false });
      }

      if (journey.locked) {
        // Cinematics and question-stage camera movement still animate in
        // explicit render mode, while ordinary idle flight remains still.
        viewer.scene.requestRender();
        setFlightFrameRate(journey.isResting ? IDLE_FLIGHT_FRAME_RATE : ACTIVE_FLIGHT_FRAME_RATE);
        if (flightAudio) flightAudio.windGain.gain.setTargetAtTime(0, flightAudio.context.currentTime, 0.2);
        return;
      }

      const speedMultiplier =
        (activeKeys.has("shift") ? DRONE_FAST_MULTIPLIER : 1) *
        (boostActiveRef.current ? 1.45 : 1);
      let targetForwardVelocityMetersPerSecond = 0;
      let targetVerticalVelocityMetersPerSecond = 0;
      let targetTurnVelocityRadiansPerSecond = 0;

      if (activeKeys.has("w")) {
        targetForwardVelocityMetersPerSecond +=
          DRONE_SPEED_METERS_PER_SECOND * speedMultiplier;
      }

      if (activeKeys.has("s")) {
        targetForwardVelocityMetersPerSecond -=
          DRONE_REVERSE_METERS_PER_SECOND * speedMultiplier;
      }

      if (activeKeys.has("a")) {
        targetTurnVelocityRadiansPerSecond -=
          DRONE_TURN_RADIANS_PER_SECOND * speedMultiplier;
      }

      if (activeKeys.has("d")) {
        targetTurnVelocityRadiansPerSecond +=
          DRONE_TURN_RADIANS_PER_SECOND * speedMultiplier;
      }

      if (activeKeys.has("e")) {
        targetVerticalVelocityMetersPerSecond +=
          DRONE_VERTICAL_SPEED_METERS_PER_SECOND * speedMultiplier;
      }

      if (activeKeys.has("q")) {
        targetVerticalVelocityMetersPerSecond -=
          DRONE_VERTICAL_SPEED_METERS_PER_SECOND * speedMultiplier;
      }

      const previousForwardVelocity = forwardVelocityMetersPerSecond;
      const accelerationStep =
        DRONE_ACCELERATION_METERS_PER_SECOND * speedMultiplier * deltaSeconds;
      forwardVelocityMetersPerSecond = approach(
        forwardVelocityMetersPerSecond,
        targetForwardVelocityMetersPerSecond,
        accelerationStep,
      );

      const turnAccelerationStep =
        DRONE_TURN_ACCELERATION_RADIANS_PER_SECOND *
        speedMultiplier *
        deltaSeconds;
      turnVelocityRadiansPerSecond = approach(
        turnVelocityRadiansPerSecond,
        targetTurnVelocityRadiansPerSecond,
        turnAccelerationStep,
      );

      const verticalAccelerationStep =
        DRONE_VERTICAL_ACCELERATION_METERS_PER_SECOND *
        speedMultiplier *
        deltaSeconds;
      verticalVelocityMetersPerSecond = approach(
        verticalVelocityMetersPerSecond,
        targetVerticalVelocityMetersPerSecond,
        verticalAccelerationStep,
      );

      if (!activeKeys.has("w") && !activeKeys.has("s")) {
        const drag = Math.exp(-DRONE_DRAG_PER_SECOND * deltaSeconds);
        forwardVelocityMetersPerSecond *= drag;
      }

      if (!activeKeys.has("a") && !activeKeys.has("d")) {
        const turnDrag = Math.exp(-DRONE_DRAG_PER_SECOND * 1.8 * deltaSeconds);
        turnVelocityRadiansPerSecond *= turnDrag;
      }

      if (!activeKeys.has("q") && !activeKeys.has("e")) {
        const verticalDrag = Math.exp(-DRONE_DRAG_PER_SECOND * 2.2 * deltaSeconds);
        verticalVelocityMetersPerSecond *= verticalDrag;
      }

      const hasFlightInput =
        activeKeys.has("w") ||
        activeKeys.has("a") ||
        activeKeys.has("s") ||
        activeKeys.has("d") ||
        activeKeys.has("q") ||
        activeKeys.has("e");
      const isDroneMoving =
        Math.abs(forwardVelocityMetersPerSecond) > 0.08 ||
        Math.abs(verticalVelocityMetersPerSecond) > 0.04 ||
        Math.abs(turnVelocityRadiansPerSecond) > Cesium.Math.toRadians(0.08);

      if (hasFlightInput || isDroneMoving) {
        lastFlightActivityAt = now;
        setFlightFrameRate(ACTIVE_FLIGHT_FRAME_RATE);
      } else if (now - lastFlightActivityAt >= IDLE_FRAME_RATE_DELAY_MS) {
        setFlightFrameRate(IDLE_FLIGHT_FRAME_RATE);
      }

      drone.heading += turnVelocityRadiansPerSecond * deltaSeconds;
      drone.height += verticalVelocityMetersPerSecond * deltaSeconds;

      const distance = forwardVelocityMetersPerSecond * deltaSeconds;
      if (Math.abs(distance) > 0.001) {
        Object.assign(
          drone,
          clampToBounds(
            moveMeters(drone, drone.heading, distance),
            flightBounds,
          ),
        );
      }

      if (drone.height < minimumDroneHeightMeters) {
        drone.height = minimumDroneHeightMeters;
        verticalVelocityMetersPerSecond = Math.max(
          verticalVelocityMetersPerSecond,
          0,
        );
      }

      const forwardAcceleration =
        (forwardVelocityMetersPerSecond - previousForwardVelocity) /
        Math.max(deltaSeconds, 0.001);
      const turnAmount = clamp(
        turnVelocityRadiansPerSecond /
          (DRONE_TURN_RADIANS_PER_SECOND * DRONE_FAST_MULTIPLIER),
        -1,
        1,
      );
      const accelerationAmount = clamp(
        forwardAcceleration /
          (DRONE_ACCELERATION_METERS_PER_SECOND * DRONE_FAST_MULTIPLIER),
        -1,
        1,
      );
      const cruiseAmount = clamp(
        forwardVelocityMetersPerSecond /
          (DRONE_SPEED_METERS_PER_SECOND * DRONE_FAST_MULTIPLIER),
        -1,
        1,
      );
      const movementAmount = clamp(
        Math.abs(forwardVelocityMetersPerSecond) /
          DRONE_SPEED_METERS_PER_SECOND +
          Math.abs(turnAmount) +
          Math.abs(verticalVelocityMetersPerSecond) /
            DRONE_VERTICAL_SPEED_METERS_PER_SECOND,
        0,
        1,
      );
      const idleAmount = 1 - movementAmount;
      const hoverPitch =
        Math.sin(flightTimeSeconds * 1.7) *
        Cesium.Math.toRadians(0.7) *
        idleAmount;
      const hoverRoll =
        Math.sin(flightTimeSeconds * 2.15 + 0.8) *
        Cesium.Math.toRadians(0.55) *
        idleAmount;
      const steeringResponse =
        Math.sign(turnAmount) * Math.pow(Math.abs(turnAmount), 0.72);
      const accelerationResponse =
        Math.sign(accelerationAmount) *
        Math.pow(Math.abs(accelerationAmount), 0.68);
      const cruiseResponse =
        Math.sign(cruiseAmount) * Math.pow(Math.abs(cruiseAmount), 0.82);
      const targetForwardTilt =
        -accelerationResponse * Cesium.Math.toRadians(19) -
        cruiseResponse * Cesium.Math.toRadians(7) +
        hoverRoll;
      const targetSideTilt =
        -steeringResponse * Cesium.Math.toRadians(27) + hoverPitch;

      const attitudeBlend = 1 - Math.exp(-6.5 * deltaSeconds);
      drone.pitch = Cesium.Math.lerp(drone.pitch, targetSideTilt, attitudeBlend);
      drone.roll = Cesium.Math.lerp(drone.roll, targetForwardTilt, attitudeBlend);

      hoverOffsetMeters =
        Math.sin(flightTimeSeconds * 2.35) * 0.32 * (0.3 + idleAmount * 0.7);

      const cameraPositionBlend =
        1 - Math.exp(-CAMERA_POSITION_FOLLOW_RATE * deltaSeconds);
      cameraFollow.lat = Cesium.Math.lerp(
        cameraFollow.lat,
        drone.lat,
        cameraPositionBlend,
      );
      cameraFollow.lng = Cesium.Math.lerp(
        cameraFollow.lng,
        drone.lng,
        cameraPositionBlend,
      );
      cameraFollow.height = Cesium.Math.lerp(
        cameraFollow.height,
        drone.height,
        cameraPositionBlend,
      );

      const cameraHeadingError = Cesium.Math.negativePiToPi(
        drone.heading - cameraHeading,
      );
      const cameraHeadingBlend =
        1 - Math.exp(-CAMERA_HEADING_FOLLOW_RATE * deltaSeconds);
      cameraHeading += cameraHeadingError * cameraHeadingBlend;

      const verticalCameraAmount = clamp(
        verticalVelocityMetersPerSecond /
          (DRONE_VERTICAL_SPEED_METERS_PER_SECOND * DRONE_FAST_MULTIPLIER),
        -1,
        1,
      );
      const targetCameraPitch =
        CAMERA_PITCH_RADIANS +
        drone.roll * CAMERA_PITCH_INFLUENCE * movementAmount +
        verticalCameraAmount * Cesium.Math.toRadians(5);
      const targetCameraRoll =
        drone.pitch * CAMERA_ROLL_INFLUENCE * movementAmount;
      const cameraAttitudeBlend =
        1 - Math.exp(-CAMERA_ATTITUDE_FOLLOW_RATE * deltaSeconds);
      cameraPitch = Cesium.Math.lerp(
        cameraPitch,
        targetCameraPitch,
        cameraAttitudeBlend,
      );
      cameraRoll = Cesium.Math.lerp(
        cameraRoll,
        targetCameraRoll,
        cameraAttitudeBlend,
      );

      const speedAmount = clamp(
        Math.abs(forwardVelocityMetersPerSecond) /
          (DRONE_SPEED_METERS_PER_SECOND * DRONE_FAST_MULTIPLIER),
        0,
        1,
      );
      const targetCameraRange =
        CAMERA_RANGE_METERS + CAMERA_SPEED_PULLBACK_METERS * speedAmount;
      const cameraRangeBlend = 1 - Math.exp(-2.8 * deltaSeconds);
      cameraRange = Cesium.Math.lerp(
        cameraRange,
        targetCameraRange,
        cameraRangeBlend,
      );

      const speedEffectAmount = clamp((speedAmount - 0.16) / 0.84, 0, 1);
      if (speedEffectAmount > 0.01) {
        const particlesPerSecond = 12 + speedEffectAmount * 105;
        particleSpawnAccumulator += particlesPerSecond * deltaSeconds;
        while (particleSpawnAccumulator >= 1) {
          spawnSpeedParticle(speedEffectAmount);
          particleSpawnAccumulator -= 1;
        }
      } else {
        particleSpawnAccumulator = 0;
      }

      for (let index = speedParticles.length - 1; index >= 0; index -= 1) {
        const particle = speedParticles[index];
        particle.ageSeconds += deltaSeconds;
        const progress = particle.ageSeconds / particle.lifetimeSeconds;

        if (progress >= 1) {
          particlePoints.remove(particle.point);
          speedParticles.splice(index, 1);
          continue;
        }

        const fadeIn = clamp(progress / 0.12, 0, 1);
        const fadeOut = clamp((1 - progress) / 0.22, 0, 1);
        const fade = fadeIn * fadeOut;
        particle.point.position = Cesium.Cartesian3.add(
          particle.point.position,
          Cesium.Cartesian3.multiplyByScalar(
            particle.velocity,
            deltaSeconds,
            new Cesium.Cartesian3(),
          ),
          new Cesium.Cartesian3(),
        );
        particle.point.color = particle.color.withAlpha(
          particle.baseAlpha * fade,
        );
        particle.point.pixelSize =
          particle.startPixelSize * (0.75 + progress * 1.65);
      }

      if (flightAudio) {
        const audioTime = flightAudio.context.currentTime;
        const verticalAmount = clamp(
          Math.abs(verticalVelocityMetersPerSecond) /
            (DRONE_VERTICAL_SPEED_METERS_PER_SECOND * DRONE_FAST_MULTIPLIER),
          0,
          1,
        );
        const windAmount = clamp(
          Math.pow(speedAmount, 1.2) + verticalAmount * 0.34,
          0,
          1,
        );

        flightAudio.windGain.gain.setTargetAtTime(
          flightAudioMuted ? 0 : 0.008 + windAmount * 0.24,
          audioTime,
          0.14,
        );
        flightAudio.windSource.playbackRate.setTargetAtTime(
          0.7 + windAmount * 0.48,
          audioTime,
          0.16,
        );
        flightAudio.windFilter.frequency.setTargetAtTime(
          130 + windAmount * 620,
          audioTime,
          0.16,
        );
      }

      if (altitudeReadout) {
        displayedAltitudeFeet = Cesium.Math.lerp(
          displayedAltitudeFeet,
          Math.max(
            MINIMUM_FLIGHT_ALTITUDE_FEET,
            START_FLIGHT_ALTITUDE_FEET +
              (drone.height - altitudeReferenceHeightMeters) *
                DISPLAYED_FEET_PER_WORLD_METER,
          ),
          1 - Math.exp(-5 * deltaSeconds),
        );
        altitudeReadout.textContent = Math.round(
          displayedAltitudeFeet,
        ).toLocaleString();

        if (altitudeRev) {
          const altitudeLevel = clamp(
            Math.floor(
              (displayedAltitudeFeet - ALTITUDE_GAUGE_START_FEET) / 50,
            ) + 1,
            0,
            8,
          );
          altitudeRev.querySelectorAll("i").forEach((dot, index) => {
            dot.toggleAttribute("data-active", index < altitudeLevel);
          });
        }
      }

      if (speedReadout) {
        const speedometerMaximum = boostActiveRef.current ? 128 : 88;
        const indicatedSpeedMilesPerHour = clamp(
          (Math.abs(forwardVelocityMetersPerSecond) /
            DRONE_SPEED_METERS_PER_SECOND) *
            42,
          0,
          speedometerMaximum,
        );
        speedReadout.textContent = Math.round(indicatedSpeedMilesPerHour)
          .toString()
          .padStart(2, "0");

        if (speedRev) {
          const speedLevel = Math.ceil(
            (indicatedSpeedMilesPerHour / speedometerMaximum) * 8,
          );
          speedRev.querySelectorAll("i").forEach((dot, index) => {
            dot.toggleAttribute("data-active", index < speedLevel);
          });
        }
      }

      const headingDegrees = Cesium.Math.toDegrees(drone.heading);

      if (compassNeedleRef.current) {
        compassNeedleRef.current.style.transform = `translate(-50%, -50%) rotate(${-headingDegrees}deg)`;
      }

      const isCameraSettling =
        Math.abs(cameraFollow.lat - drone.lat) > 0.00000001 ||
        Math.abs(cameraFollow.lng - drone.lng) > 0.00000001 ||
        Math.abs(cameraFollow.height - drone.height) > 0.01 ||
        Math.abs(Cesium.Math.negativePiToPi(drone.heading - cameraHeading)) >
          Cesium.Math.toRadians(0.01) ||
        Math.abs(cameraPitch - targetCameraPitch) >
          Cesium.Math.toRadians(0.01) ||
        Math.abs(cameraRoll - targetCameraRoll) >
          Cesium.Math.toRadians(0.01) ||
        Math.abs(cameraRange - targetCameraRange) > 0.01;

      if (hasFlightInput || isDroneMoving || isCameraSettling) {
        setCameraOnDrone();
      } else {
        // Keep the drone's hover animation while leaving the map camera still.
        cleanDroneViewer.render();
      }
    });

    return () => {
      isDestroyed = true;
      removeTick();
      journey.destroy();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener(AUDIO_MUTED_EVENT, handleAudioMuted);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      activeKeys.clear();
      boostChargesRef.current = 0;
      boostActiveRef.current = false;
      boostActiveUntilRef.current = 0;
      activateBoostRef.current = null;
      teleportDroneRef.current = null;
      if (flightAudio) {
        flightAudio.windSource.stop();
        void flightAudio.context.close();
      }
      if (tileset && !tileset.isDestroyed()) {
        viewer.scene.primitives.remove(tileset);
      }
      cleanDroneViewer.destroy();
      viewer.destroy();
      viewerRef.current = null;
      gradeStageRef.current = undefined;
      pixelStageRef.current = undefined;
      farBlurStageRef.current = undefined;
      Cesium.RequestScheduler.maximumRequests = previousMaximumRequests;
      Cesium.RequestScheduler.maximumRequestsPerServer =
        previousMaximumRequestsPerServer;
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <div ref={cesiumRef} className="absolute inset-0" />
      <div ref={droneOverlayRef} className="pointer-events-none absolute inset-0 z-10" />
      <details
        className="api-stats-menu absolute right-3 top-3 z-20 text-white sm:right-5"
        onToggle={(event) => setIsApiStatsOpen(event.currentTarget.open)}
      >
        <summary aria-label="Open settings" title="Settings">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm8.1 3.6-.1-1.1 2-1.5-2-3.4-2.4 1a8.2 8.2 0 0 0-1.9-1.1L15.4 3h-4l-.4 2.6c-.7.3-1.3.6-1.9 1.1L6.7 5.6l-2 3.4 2 1.6a8.5 8.5 0 0 0 0 2.2l-2 1.6 2 3.4 2.4-1.1c.6.5 1.2.8 1.9 1.1l.4 2.6h4l.4-2.6c.7-.3 1.3-.6 1.9-1.1l2.4 1.1 2-3.4-2-1.5.1-1.1Z" />
          </svg>
        </summary>
        <aside aria-label="Settings and monthly Google API statistics" aria-live="polite">
          <div className="api-settings__heading">Settings</div>
          <button
            type="button"
            className="api-settings__mute"
            aria-pressed={isAudioMuted}
            onClick={toggleAudioMuted}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 9v6h4l5 4V5L8 9H4Z" />
              {isAudioMuted
                ? <path d="m17 9 4 4m0-4-4 4" />
                : <path d="M16 9.5c1.4 1.4 1.4 3.6 0 5m2.5-7.5c2.8 2.8 2.8 7.2 0 10" />}
            </svg>
            <span>{isAudioMuted ? "Unmute audio" : "Mute audio"}</span>
          </button>
          <div className="api-call-tracker__heading">
            <strong>Monthly usage</strong>
            <span>{googleApiUsage?.month ?? "Loading"}</span>
          </div>
          <div className="api-call-tracker__row">
            <span>Root</span>
            <output>
              {googleApiUsage
                ? `${googleApiUsage.counts.root.toLocaleString()} / ${googleApiUsage.limits.root.toLocaleString()}`
                : "..."}
            </output>
          </div>
          <div className="api-call-tracker__row">
            <span>Render</span>
            <output>
              {googleApiUsage
                ? `${googleApiUsage.counts.render.toLocaleString()} / ${googleApiUsage.limits.render.toLocaleString()}`
                : "..."}
            </output>
          </div>
        </aside>
      </details>
      {isQuotaReached && (
        <section
          className="journey-panel quota-limit-notice pointer-events-none absolute left-1/2 top-1/2 z-[2147483647] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 px-7 py-6 text-white sm:px-10 sm:py-8"
          role="alert"
          aria-live="assertive"
        >
          <p className="quota-limit-notice__eyebrow">Map status</p>
          <h1>The map has reached its API limit.</h1>
          <p>
            Sorry, a lot of people are using Iowa From Above right now, and we do
            not have funding to raise the API limit. Please try again early
            tomorrow.
          </p>
        </section>
      )}
      <div
        className={`location-search absolute left-3 top-3 z-20 flex h-9 font-mono text-xs text-white/90 transition-[width] duration-200 ease-out sm:left-5 ${
          isAddressOpen
            ? "w-[min(18rem,calc(100vw-1.5rem))]"
            : "w-9"
        }`}
      >
        <button
          type="button"
          aria-label={
            isAddressOpen ? "Close address search" : "Find an Iowa address"
          }
          title={isAddressOpen ? "Close" : "Find an Iowa address"}
          className="grid size-9 shrink-0 place-items-center text-base text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
          onClick={() => {
            setIsAddressOpen((open) => !open);
            setAddressMessage("");
          }}
        >
          <span aria-hidden="true">
            {isAddressOpen ? <>&#215;</> : <>&#8982;</>}
          </span>
        </button>
        <form
          className="flex min-w-0 flex-1 items-center gap-1 pr-1"
          onSubmit={handleAddressSubmit}
        >
          <input
            ref={addressInputRef}
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setAddressMessage("");
            }}
            aria-label="Iowa address"
            placeholder="Iowa address"
            autoComplete="street-address"
            className="min-w-0 flex-1 bg-transparent px-1 text-xs text-white outline-none placeholder:text-white/55"
          />
          <button
            type="submit"
            aria-label="Teleport to address"
            title="Teleport"
            disabled={isFindingAddress || !address.trim()}
            className="grid size-7 shrink-0 place-items-center rounded-full border border-white/20 bg-white/5 text-white/85 transition-colors hover:border-white/40 hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-35"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
            >
              <path
                d="M5 12h12.5m-4.75-4.75L17.5 12l-4.75 4.75"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
      <div
        aria-live="polite"
        className={`clay-toast pointer-events-none absolute left-3 top-14 z-20 max-w-[min(18rem,calc(100vw-1.5rem))] px-2 py-1 font-mono text-[10px] text-white/80 transition-opacity sm:left-5 ${
          isAddressOpen && addressMessage ? "opacity-100" : "opacity-0"
        }`}
      >
        <span>{addressMessage}</span>
      </div>
      {journeyStatus.phase === "complete" && (
        <OutroSequence
          onReplay={() => {
            clearJourneyCheckpoint();
            window.location.reload();
          }}
          onVisitAddress={openAddressSearchFromJourneyPrompt}
        />
      )}
      {journeyStatus.phase === "cinematic" && (
        <aside
          aria-label={`Exhibit notes for ${currentExhibit.name}`}
          className="exhibit-peek journey-panel journey-panel--reverse absolute left-3 top-1/2 z-20 w-[min(18rem,calc(100vw-1.5rem))] -translate-y-1/2 px-6 py-5 text-white sm:left-5"
        >
          <h2>{currentExhibit.name}</h2>
          <ul>
            <li>{currentExhibit.summary}</li>
            <li>{currentExhibit.funFact}</li>
            <li>{currentExhibit.statistic.value} {currentExhibit.statistic.label}. {currentExhibit.statistic.detail}</li>
          </ul>
          <a
            className="exhibit-peek__read-more"
            href={`/exhibits/${currentExhibit.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Read more
          </a>
        </aside>
      )}
      {journeyStatus.phase === "cinematic" && (
        <LandmarkChat key={currentExhibit.id} exhibit={currentExhibit} />
      )}
      <div className="journey-dock absolute bottom-7 right-3 z-20 flex flex-col items-end gap-3 sm:right-5">
        <div
          className={`journey-boost-dock mr-5 ${boostStatus.active ? "journey-boost-dock--active" : ""}`}
          aria-label={`${boostStatus.charges} of 3 flight boosts ready${boostStatus.active ? ", boost active" : ""}`}
        >
        {Array.from({ length: 3 }, (_, index) => {
          const isFilled = index < boostStatus.charges;

          return (
            <button
              key={index}
              type="button"
              className="journey-boost-slot"
              data-filled={isFilled ? "" : undefined}
              disabled={!isFilled || boostStatus.active}
              aria-label={isFilled ? "Use flight boost" : "Empty boost slot"}
              title={isFilled ? "Use speed boost (B)" : "Answer correctly to earn a boost"}
              onClick={() => activateBoostRef.current?.()}
            >
              {isFilled && <span aria-hidden="true">🔥</span>}
            </button>
          );
        })}
        </div>
        <aside
          aria-label="Journey notifications"
          className="journey-card journey-panel pointer-events-none relative min-h-28 w-[min(21rem,calc(100vw-1.5rem))] pb-4 pl-6 pr-8 pt-4 text-white"
        >
        <p className="text-sm font-medium tracking-normal text-white/70 sm:text-base">
          Journey
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-4 border-b border-white/10 pb-3">
          <span className="text-sm text-white/65">Landmarks explored</span>
          <strong className="font-mono text-sm font-medium tabular-nums text-white">
            {journeyStatus.completed}/{JOURNEY_STOPS.length}
          </strong>
        </div>
        <div className="mt-3">
          <p className="text-sm leading-5 tracking-normal text-white">
            {journeyStatus.phase === "tutorial"
              ? "Complete the tutorial to begin"
              : journeyStatus.phase === "complete"
                ? "Iowa explored. Keep flying."
                : journeyStatus.phase === "portal"
                  ? "Travel to the portal"
                  : journeyStatus.phase === "navigate"
                    ? `Travel to ${JOURNEY_STOPS[journeyStatus.index].name}`
                    : JOURNEY_STOPS[journeyStatus.index].name}
          </p>
          {(journeyStatus.phase === "navigate" || journeyStatus.phase === "portal") && <p className="mt-1 text-xs text-white/60">{journeyStatus.direction} · {journeyStatus.distance.toLocaleString()} m · {journeyStatus.phase === "portal" ? "Enter the portal" : "Follow the purple line"}</p>}
          {journeyStatus.phase === "complete" && (
            <button
              type="button"
              className="journey-restart pointer-events-auto mt-3 w-full px-3 py-2 text-sm"
              onClick={() => {
                clearJourneyCheckpoint();
                window.location.reload();
              }}
            >
              Restart your journey
            </button>
          )}
        </div>
        </aside>
        <div className="mobile-journey-objective" aria-live="polite">
          {journeyStatus.phase === "portal"
            ? "Portal"
            : journeyStatus.phase === "navigate"
              ? JOURNEY_STOPS[journeyStatus.index].name
              : journeyStatus.phase === "complete"
                ? "Journey complete"
                : ""}
        </div>
      </div>
      {journeyStatus.phase === "cinematic" && (
        <button
          type="button"
          aria-label="Hold to skip the landmark narration"
          className="cinematic-skip-control absolute bottom-5 left-1/2 z-30 -translate-x-1/2"
          onPointerDown={startCinematicSkip}
          onPointerUp={cancelCinematicSkip}
          onPointerCancel={cancelCinematicSkip}
          onPointerLeave={cancelCinematicSkip}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span>Hold to skip</span>
          <span className="cinematic-skip-control__track" aria-hidden="true">
            <i
              className={isCinematicSkipHolding ? "is-holding" : ""}
              style={{ transitionDuration: isCinematicSkipHolding ? `${CINEMATIC_SKIP_HOLD_MS}ms` : "0ms" }}
            />
          </span>
        </button>
      )}
      {journeyStatus.phase === "question" && (
        <section aria-label="Landmark question controls" className="journey-question absolute left-1/2 top-1/2 z-30 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 px-5 py-4 text-white">
          <p className="text-xs font-medium text-white/55">Quick question</p>
          <p className="mt-1.5 text-sm leading-5">{JOURNEY_STOPS[journeyStatus.index].question}</p>
          {JOURNEY_STOPS[journeyStatus.index].choices.map((choice, index) => {
            const isSelected = journeyStatus.selectedAnswer === index;
            const isCorrect = isSelected && journeyStatus.answerCorrect;
            const isWrong = isSelected && journeyStatus.answerCorrect === false;

            return (
              <button
                key={choice}
                className={`journey-answer mt-2 block w-full px-3 py-2 text-left text-xs ${isCorrect ? "journey-answer--correct" : ""} ${isWrong ? "journey-answer--wrong" : ""}`}
                onClick={() => window.dispatchEvent(new CustomEvent("iowa-journey-action", { detail: String(index) }))}
              >
                <span>{index + 1}</span>{choice}{isCorrect && <b aria-hidden="true">✓</b>}
              </button>
            );
          })}
          <p aria-live="polite" className={`mt-2 text-xs leading-4 ${journeyStatus.answerCorrect ? "text-emerald-300" : "text-white/65"}`}>{journeyStatus.feedback}</p>
          <a className="mt-2 block text-xs text-white/60 underline" href={`/exhibits/${currentExhibit.id}`} target="_blank" rel="noreferrer">Explore this stop&apos;s history</a>
          {journeyStatus.completed > journeyStatus.index && <button className="journey-question__continue mt-2 w-full px-3 py-2 text-xs" onClick={() => window.dispatchEvent(new CustomEvent("iowa-journey-action", { detail: "next" }))}>Continue · Enter</button>}
        </section>
      )}
      {journeyStatus.phase === "transfer" && <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black text-white"><p className="max-w-3xl px-6 text-center font-serif text-2xl leading-relaxed tracking-normal text-white sm:text-4xl">{journeyStatus.message}</p></div>}
      <section
        aria-label="Live flight telemetry"
        className="flight-instruments pointer-events-none absolute bottom-32 left-1/2 z-10 w-[min(25rem,calc(100vw-1rem))] -translate-x-1/2 text-white sm:bottom-10"
      >
        <div className="flight-instrument flight-instrument--speed">
          <span className="flight-instrument__reading">
            <output ref={speedReadoutRef}>00</output>
            <small>mph</small>
          </span>
          <div ref={speedRevRef} className="rev-gauge" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </div>

        <div className="flight-compass">
          {journeyStatus.direction && (journeyStatus.phase === "navigate" || journeyStatus.phase === "portal") && (
            <span
              className={`flight-compass__target-bearing ${journeyStatus.phase === "portal" ? "flight-compass__target-bearing--portal" : ""}`}
              style={{ transform: `rotate(${journeyStatus.targetBearing}rad)` }}
              aria-hidden="true"
            />
          )}
          <div className="flight-compass__rose">
            <span className="flight-compass__cardinal flight-compass__cardinal--north">
              N
            </span>
            <span className="flight-compass__cardinal flight-compass__cardinal--east">
              E
            </span>
            <span className="flight-compass__cardinal flight-compass__cardinal--south">
              S
            </span>
            <span className="flight-compass__cardinal flight-compass__cardinal--west">
              W
            </span>
            <span
              ref={compassNeedleRef}
              className="flight-compass__needle"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="flight-instrument flight-instrument--altitude">
          <span className="flight-instrument__reading">
            <output ref={altitudeReadoutRef}>1,000</output>
            <small>ft</small>
          </span>
          <div
            ref={altitudeRevRef}
            className="rev-gauge rev-gauge--reverse"
            aria-hidden="true"
          >
            {Array.from({ length: 8 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </div>
      </section>
      <section className="mobile-flight-controls" aria-label="Touch flight controls">
        <div className="mobile-altitude-controls">
          {[
            { key: "e", label: "Rise", icon: "↑" },
            { key: "q", label: "Descend", icon: "↓" },
          ].map((control) => (
            <button
              key={control.key}
              type="button"
              aria-label={control.label}
              onPointerDown={(event) => pressMobileFlightControl(event, control.key)}
              onPointerUp={(event) => releaseMobileFlightControl(event, control.key)}
              onPointerCancel={(event) => releaseMobileFlightControl(event, control.key)}
              onLostPointerCapture={() => {
                window.dispatchEvent(new KeyboardEvent("keyup", { key: control.key, bubbles: true }));
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <span aria-hidden="true">{control.icon}</span>
            </button>
          ))}
        </div>
        <div className="mobile-direction-pad">
          {[
            { key: "w", label: "Fly forward", icon: "▲", className: "mobile-direction-pad__forward" },
            { key: "a", label: "Turn left", icon: "◀", className: "mobile-direction-pad__left" },
            { key: "d", label: "Turn right", icon: "▶", className: "mobile-direction-pad__right" },
            { key: "s", label: "Fly backward", icon: "▼", className: "mobile-direction-pad__back" },
          ].map((control) => (
            <button
              key={control.key}
              type="button"
              className={control.className}
              aria-label={control.label}
              onPointerDown={(event) => pressMobileFlightControl(event, control.key)}
              onPointerUp={(event) => releaseMobileFlightControl(event, control.key)}
              onPointerCancel={(event) => releaseMobileFlightControl(event, control.key)}
              onLostPointerCapture={() => {
                window.dispatchEvent(new KeyboardEvent("keyup", { key: control.key, bubbles: true }));
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <span aria-hidden="true">{control.icon}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
