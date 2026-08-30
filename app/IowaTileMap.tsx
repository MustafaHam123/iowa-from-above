"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { ACES_FILMIC_FRAGMENT_SHADER } from "./shaders/acesFilmic";
import { DEPTH_DISTANCE_BLUR_FRAGMENT_SHADER } from "./shaders/depthDistanceBlur";
import { PIXEL_FILTER_FRAGMENT_SHADER } from "./shaders/pixelFilter";

const IOWA_BOUNDS = {
  north: 43.5012,
  south: 40.3755,
  west: -96.6397,
  east: -90.1401,
};

const CAPITOL = {
  lat: 41.590395901424806,
  lng: -93.60779251106203,
  height: 230.26178487817083,
};

const DRONE_START = {
  lat: 41.59025978611684,
  lng: -93.61212194967717,
  height: 247.29568133850805,
};

const SUNSET_SKYBOX_SOURCES = {
  positiveX: "/sky/hdr-sunset-007/positiveX.jpg",
  negativeX: "/sky/hdr-sunset-007/negativeX.jpg",
  positiveY: "/sky/hdr-sunset-007/positiveY.jpg",
  negativeY: "/sky/hdr-sunset-007/negativeY.jpg",
  positiveZ: "/sky/hdr-sunset-007/positiveZ.jpg",
  negativeZ: "/sky/hdr-sunset-007/negativeZ.jpg",
};

const CAPITOL_TO_RAILROAD_BRIDGE_ROUTE = [
  { lat: 41.5912, lng: -93.60382 },
  { lat: 41.59095, lng: -93.6061 },
  { lat: 41.59082, lng: -93.60905 },
  { lat: 41.59052, lng: -93.61125 },
  { lat: 41.58895, lng: -93.61225 },
  { lat: 41.58765, lng: -93.6133 },
  { lat: 41.58635, lng: -93.61455 },
  { lat: 41.58542, lng: -93.6161 },
  { lat: 41.58504, lng: -93.61755 },
];

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
const LOW_ALTITUDE_CLEARANCE_METERS = 4;
const LOW_ALTITUDE_PUSH_SPEED_METERS_PER_SECOND = 34;
const LOW_ALTITUDE_PUSH_STIFFNESS = 5.5;
const ROAD_TRAIL_SURFACE_OFFSET_METERS = 0.45;
const ROAD_TRAIL_SAMPLE_SPACING = 18;
const ROAD_TRAIL_REFRESH_INTERVAL_SECONDS = 1;
const ROAD_TRAIL_REFRESH_LIMIT = 12;
const SURFACE_HEIGHT_SAMPLE_INTERVAL_SECONDS = 0.1;
const SPEED_PARTICLE_MAX_COUNT = 160;
const SPEED_PARTICLE_NEAR_DISTANCE_METERS = 85;
const SPEED_PARTICLE_FAR_DISTANCE_METERS = 430;
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

type RoutePoint = {
  lat: number;
  lng: number;
};

type VisualSettings = {
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
  exposure: 1.33,
  aces: 0.33,
  brightness: -0.04,
  contrast: 1.1,
  saturation: 1.12,
  hue: 1,
  warmth: 0.2,
  shadows: 0.01,
  highlights: 0.04,
  fade: 0.07,
  vignette: 0.16,
  filterStrength: 0.7,
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

function distanceMeters(start: RoutePoint, end: RoutePoint) {
  const metersPerDegreeLatitude = 111_320;
  const averageLatitude = Cesium.Math.toRadians((start.lat + end.lat) / 2);
  const metersPerDegreeLongitude =
    metersPerDegreeLatitude * Math.cos(averageLatitude);
  const northMeters = (end.lat - start.lat) * metersPerDegreeLatitude;
  const eastMeters = (end.lng - start.lng) * metersPerDegreeLongitude;

  return Math.hypot(northMeters, eastMeters);
}

function densifyRoute(route: RoutePoint[], spacingMeters: number) {
  const sampledRoute: RoutePoint[] = [];

  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index];
    const end = route[index + 1];
    const segmentCount = Math.max(
      1,
      Math.ceil(distanceMeters(start, end) / spacingMeters),
    );

    for (let step = 0; step < segmentCount; step += 1) {
      const amount = step / segmentCount;
      sampledRoute.push({
        lat: Cesium.Math.lerp(start.lat, end.lat, amount),
        lng: Cesium.Math.lerp(start.lng, end.lng, amount),
      });
    }
  }

  sampledRoute.push(route[route.length - 1]);
  return sampledRoute;
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

  useEffect(() => {
    if (isAddressOpen) {
      addressInputRef.current?.focus();
    }
  }, [isAddressOpen]);

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

    Cesium.RequestScheduler.maximumRequests = 8;
    Cesium.RequestScheduler.maximumRequestsPerServer = 2;

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
      targetFrameRate: 30,
      requestRenderMode: false,
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
      targetFrameRate: 30,
      requestRenderMode: false,
      shouldAnimate: true,
      useDefaultRenderLoop: false,
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
    viewer.scene.skyBox = undefined;
    const skyTransform = Cesium.Matrix4.getMatrix3(
      Cesium.Transforms.localFrameToFixedFrameGenerator("east", "up")(
        Cesium.Cartesian3.fromDegrees(CAPITOL.lng, CAPITOL.lat, CAPITOL.height),
      ),
      new Cesium.Matrix3(),
    );
    viewer.scene.primitives.add(
      new Cesium.CubeMapPanorama({
        sources: SUNSET_SKYBOX_SOURCES,
        transform: skyTransform,
      }),
    );
    viewer.resolutionScale = 1;
    cleanDroneViewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
    cleanDroneViewer.scene.skyAtmosphere = undefined;
    cleanDroneViewer.scene.skyBox = undefined;
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
    let flightAudio: FlightAudio | undefined;
    let flightAudioPromise: Promise<FlightAudio> | undefined;

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

    void Cesium.Cesium3DTileset.fromUrl("/api/google-3d/root.json", {
        showCreditsOnScreen: true,
        maximumScreenSpaceError: 22,
        cacheBytes: 96 * 1024 * 1024,
        maximumCacheOverflowBytes: 24 * 1024 * 1024,
        cullWithChildrenBounds: true,
        cullRequestsWhileMoving: true,
        cullRequestsWhileMovingMultiplier: 80,
        progressiveResolutionHeightFraction: 0.45,
        foveatedScreenSpaceError: true,
        foveatedConeSize: 0.45,
        foveatedMinimumScreenSpaceErrorRelaxation: 8,
        foveatedTimeDelay: 0.25,
        dynamicScreenSpaceError: true,
        dynamicScreenSpaceErrorDensity: 0.00278,
        dynamicScreenSpaceErrorFactor: 16,
        skipLevelOfDetail: true,
        baseScreenSpaceError: 1024,
        skipScreenSpaceErrorFactor: 16,
        skipLevels: 1,
        loadSiblings: false,
        preloadFlightDestinations: false,
      })
      .then((loadedTileset) => {
        if (isDestroyed) {
          loadedTileset.destroy();
          return;
        }

        let quotaFailureCount = 0;
        let stopScheduled = false;

        loadedTileset.tileFailed.addEventListener(
          (error: { message?: string }) => {
            if (!/Status Code: (429|502)/.test(error.message ?? "")) {
              return;
            }

            quotaFailureCount += 1;

            if (quotaFailureCount < 2 || stopScheduled) {
              return;
            }

            stopScheduled = true;
            window.setTimeout(() => {
              if (tileset !== loadedTileset || loadedTileset.isDestroyed()) {
                return;
              }

              viewer.scene.primitives.remove(loadedTileset);
              tileset = undefined;
            }, 0);
          },
        );

        tileset = loadedTileset;
        viewer.scene.primitives.add(loadedTileset);
      })
      .catch(() => undefined);

    const activeKeys = new Set<string>();
    const drone = {
      lat: DRONE_START.lat,
      lng: DRONE_START.lng,
      height: DRONE_START.height,
      heading: Cesium.Math.toRadians(74.5),
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
    const roadRoute = densifyRoute(
      CAPITOL_TO_RAILROAD_BRIDGE_ROUTE,
      ROAD_TRAIL_SAMPLE_SPACING,
    );
    let roadTrailPositions = roadRoute.map((point) =>
      Cesium.Cartesian3.fromDegrees(point.lng, point.lat, CAPITOL.height),
    );
    let particleSpawnAccumulator = 0;
    let roadTrailRefreshAccumulator = 0;
    let roadTrailRefreshesRemaining = ROAD_TRAIL_REFRESH_LIMIT;

    viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => roadTrailPositions, false),
        width: 7,
        arcType: Cesium.ArcType.NONE,
        material: new Cesium.PolylineGlowMaterialProperty({
          color: Cesium.Color.fromCssColorString("#36f7ff").withAlpha(0.95),
          glowPower: 0.28,
          taperPower: 0.6,
        }),
      },
    });

    function refreshRoadTrailPositions() {
      if (!tileset) {
        return;
      }

      roadTrailPositions = roadRoute.map((point, index) => {
        const surfaceHeight = tileset?.getHeight(
          Cesium.Cartographic.fromDegrees(point.lng, point.lat),
          viewer.scene,
        );
        const previousCartographic = Cesium.Cartographic.fromCartesian(
          roadTrailPositions[index],
        );
        const height =
          typeof surfaceHeight === "number"
            ? surfaceHeight + ROAD_TRAIL_SURFACE_OFFSET_METERS
            : previousCartographic.height;

        return Cesium.Cartesian3.fromDegrees(point.lng, point.lat, height);
      });
    }

    if (viewer.camera.frustum instanceof Cesium.PerspectiveFrustum) {
      viewer.camera.frustum.fov = Cesium.Math.toRadians(58);
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

    function setKey(event: KeyboardEvent, isDown: boolean) {
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
        } else {
          activeKeys.delete(key);
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      startFlightAudio();
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
    let floorHeightMeters = LOW_ALTITUDE_CLEARANCE_METERS;
    let targetFloorHeightMeters = LOW_ALTITUDE_CLEARANCE_METERS;
    let surfaceHeightSampleAccumulator =
      SURFACE_HEIGHT_SAMPLE_INTERVAL_SECONDS;
    let displayedAltitudeFeet = drone.height * 3.28084;
    let altitudeGaugeBaselineFeet = displayedAltitudeFeet;
    const droneSurfaceCartographic = new Cesium.Cartographic();
    teleportDroneRef.current = (destination) => {
      const iowaDestination = clampToBounds(destination, IOWA_BOUNDS);
      flightBounds = IOWA_BOUNDS;
      drone.lat = iowaDestination.lat;
      drone.lng = iowaDestination.lng;
      drone.height = Math.max(drone.height, 600);
      altitudeGaugeBaselineFeet = drone.height * 3.28084;
      cameraFollow.lat = drone.lat;
      cameraFollow.lng = drone.lng;
      cameraFollow.height = drone.height;
      forwardVelocityMetersPerSecond = 0;
      verticalVelocityMetersPerSecond = 0;
      turnVelocityRadiansPerSecond = 0;
      floorHeightMeters = LOW_ALTITUDE_CLEARANCE_METERS;
      targetFloorHeightMeters = LOW_ALTITUDE_CLEARANCE_METERS;
      surfaceHeightSampleAccumulator = SURFACE_HEIGHT_SAMPLE_INTERVAL_SECONDS;
      activeKeys.clear();
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

      const speedMultiplier = activeKeys.has("shift") ? DRONE_FAST_MULTIPLIER : 1;
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

      surfaceHeightSampleAccumulator += deltaSeconds;
      if (
        surfaceHeightSampleAccumulator >=
        SURFACE_HEIGHT_SAMPLE_INTERVAL_SECONDS
      ) {
        Cesium.Cartographic.fromDegrees(
          drone.lng,
          drone.lat,
          0,
          droneSurfaceCartographic,
        );
        const surfaceHeight = tileset?.getHeight(
          droneSurfaceCartographic,
          viewer.scene,
        );
        targetFloorHeightMeters =
          typeof surfaceHeight === "number"
            ? surfaceHeight + LOW_ALTITUDE_CLEARANCE_METERS
            : LOW_ALTITUDE_CLEARANCE_METERS;
        surfaceHeightSampleAccumulator = 0;
      }

      floorHeightMeters = Cesium.Math.lerp(
        floorHeightMeters,
        targetFloorHeightMeters,
        1 - Math.exp(-4.5 * deltaSeconds),
      );

      if (drone.height < floorHeightMeters) {
        const lowAltitudeDeficit = floorHeightMeters - drone.height;
        const pushSpeed =
          LOW_ALTITUDE_PUSH_SPEED_METERS_PER_SECOND +
          lowAltitudeDeficit * LOW_ALTITUDE_PUSH_STIFFNESS;

        verticalVelocityMetersPerSecond = Math.max(
          verticalVelocityMetersPerSecond,
          pushSpeed,
        );
        drone.height = Cesium.Math.lerp(
          drone.height,
          floorHeightMeters,
          1 - Math.exp(-5 * deltaSeconds),
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
        drone.roll * CAMERA_PITCH_INFLUENCE +
        verticalCameraAmount * Cesium.Math.toRadians(5);
      const targetCameraRoll = drone.pitch * CAMERA_ROLL_INFLUENCE;
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
          0.008 + windAmount * 0.24,
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

      if (tileset && roadTrailRefreshesRemaining > 0) {
        roadTrailRefreshAccumulator += deltaSeconds;
        if (
          roadTrailRefreshAccumulator >=
          ROAD_TRAIL_REFRESH_INTERVAL_SECONDS
        ) {
          refreshRoadTrailPositions();
          roadTrailRefreshesRemaining -= 1;
          roadTrailRefreshAccumulator = 0;
        }
      }

      if (altitudeReadout) {
        displayedAltitudeFeet = Cesium.Math.lerp(
          displayedAltitudeFeet,
          drone.height * 3.28084,
          1 - Math.exp(-5 * deltaSeconds),
        );
        altitudeReadout.textContent = Math.round(
          displayedAltitudeFeet,
        ).toLocaleString();

        if (altitudeRev) {
          const altitudeChangeFeet =
            displayedAltitudeFeet - altitudeGaugeBaselineFeet;
          const altitudeLevel = clamp(
            Math.trunc(altitudeChangeFeet / 50) + 1,
            0,
            8,
          );
          altitudeRev.querySelectorAll("i").forEach((dot, index) => {
            dot.toggleAttribute("data-active", index < altitudeLevel);
          });
        }
      }

      if (speedReadout) {
        const indicatedSpeedMilesPerHour = clamp(
          (Math.abs(forwardVelocityMetersPerSecond) /
            DRONE_SPEED_METERS_PER_SECOND) *
            42,
          0,
          88,
        );
        speedReadout.textContent = Math.round(indicatedSpeedMilesPerHour)
          .toString()
          .padStart(2, "0");

        if (speedRev) {
          const speedLevel = Math.ceil((indicatedSpeedMilesPerHour / 88) * 8);
          speedRev.querySelectorAll("i").forEach((dot, index) => {
            dot.toggleAttribute("data-active", index < speedLevel);
          });
        }
      }

      const headingDegrees = Cesium.Math.toDegrees(drone.heading);

      if (compassNeedleRef.current) {
        compassNeedleRef.current.style.transform = `translate(-50%, -50%) rotate(${-headingDegrees}deg)`;
      }

      setCameraOnDrone();
    });

    return () => {
      isDestroyed = true;
      removeTick();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pointerdown", handlePointerDown);
      activeKeys.clear();
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
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <div ref={cesiumRef} className="absolute inset-0" />
      <div ref={droneOverlayRef} className="pointer-events-none absolute inset-0 z-10" />
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
        className={`pointer-events-none absolute left-3 top-14 z-20 max-w-[min(18rem,calc(100vw-1.5rem))] rounded bg-black/35 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur-sm transition-opacity sm:left-5 ${
          isAddressOpen && addressMessage ? "opacity-100" : "opacity-0"
        }`}
      >
        {addressMessage}
      </div>
      <aside
        aria-label="Journey notifications"
        className="journey-panel pointer-events-none absolute bottom-7 right-3 z-20 min-h-28 w-[min(21rem,calc(100vw-1.5rem))] pb-4 pl-6 pr-8 pt-4 text-white sm:right-5"
      >
        <p className="text-sm font-medium tracking-normal text-white/70 sm:text-base">
          Journey
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-4 border-b border-white/10 pb-3">
          <span className="text-sm text-white/65">Landmarks explored</span>
          <strong className="font-mono text-sm font-medium tabular-nums text-white">
            0/12
          </strong>
        </div>
        <div className="mt-3">
          <p className="text-sm leading-5 tracking-normal text-white">
            Travel to the next landmark
          </p>
        </div>
      </aside>
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
            <output ref={altitudeReadoutRef}>811</output>
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
    </main>
  );
}
