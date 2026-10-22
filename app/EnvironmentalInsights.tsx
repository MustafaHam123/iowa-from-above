"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as Cesium from "cesium";
import { ENVIRONMENT_TOPICS, nutrientColor, type EnvironmentalData, type EnvironmentalFeature, type EnvironmentalLayer } from "./environment";

export type EnvironmentalSelection = { feature: EnvironmentalFeature; lat: number; lng: number };
type LayerState = { loading: boolean; error?: string; data?: EnvironmentalData };
const LAYERS: EnvironmentalLayer[] = ["water", "watershed", "flood"];

export default function EnvironmentalInsights({ viewerRef, positionRef, onSelection, onAsk, chatAvailable, signsEnabled, onSignsChange }: {
  viewerRef: RefObject<Cesium.Viewer | null>;
  positionRef: RefObject<{ lat: number; lng: number }>;
  onSelection: (selection: EnvironmentalSelection | null) => void;
  onAsk: () => void;
  chatAvailable: boolean;
  signsEnabled: boolean;
  onSignsChange: (enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<EnvironmentalLayer, boolean>>({ water: false, watershed: false, flood: false });
  const [states, setStates] = useState<Partial<Record<EnvironmentalLayer, LayerState>>>({});
  const [selected, setSelected] = useState<EnvironmentalFeature | null>(null);
  const [location, setLocation] = useState({ lat: 41.59, lng: -93.61 });
  const [retry, setRetry] = useState(0);
  const sources = useRef(new Map<EnvironmentalLayer, Cesium.GeoJsonDataSource>());
  const loadedKeys = useRef(new Map<EnvironmentalLayer, string>());
  const selectionRef = useRef(onSelection);
  const pickRef = useRef<(feature: EnvironmentalFeature) => void>(() => {});
  useEffect(() => { selectionRef.current = onSelection; }, [onSelection]);
  useEffect(() => {
    pickRef.current = (feature) => {
      setSelected(feature); setOpen(true);
      selectionRef.current({ feature, ...positionRef.current });
    };
  }, [positionRef]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const p = positionRef.current;
      setLocation((old) => Math.abs(p.lat-old.lat) > 0.025 || Math.abs(p.lng-old.lng) > 0.025 ? { ...p } : old);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [positionRef]);

  useEffect(() => {
    let handler: Cesium.ScreenSpaceEventHandler | undefined;
    let attachedViewer: Cesium.Viewer | null = null;
    const timer = window.setInterval(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed() || handler) return;
      attachedViewer = viewer;
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((event: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(event.position);
        const feature = picked?.id?.properties?.environmentFeature?.getValue();
        if (feature) pickRef.current(feature);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }, 500);
    const ownedSources = sources.current;
    return () => {
      window.clearInterval(timer); handler?.destroy();
      if (attachedViewer && !attachedViewer.isDestroyed()) for (const source of ownedSources.values()) attachedViewer.dataSources.remove(source, true);
      ownedSources.clear();
    };
  }, [viewerRef]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    for (const layer of LAYERS) {
      const old = sources.current.get(layer);
      const key = layer === "water" ? `water-${retry}` : `${location.lat.toFixed(3)},${location.lng.toFixed(3)}-${retry}`;
      if (enabled[layer] && old && loadedKeys.current.get(layer) === key) continue;
      if (old) { viewer.dataSources.remove(old, true); sources.current.delete(layer); loadedKeys.current.delete(layer); }
      if (!enabled[layer]) continue;
      setStates((s) => ({ ...s, [layer]: { loading: true } }));
      void (async () => {
        try {
          const response = await fetch(`/api/environment?${new URLSearchParams({ layer, lat: location.lat.toFixed(3), lng: location.lng.toFixed(3) })}`, { signal: controller.signal });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Data unavailable.");
          const data = payload as EnvironmentalData;
          if (disposed) return;
          const color = Cesium.Color.fromCssColorString(ENVIRONMENT_TOPICS[layer].color);
          const source = await Cesium.GeoJsonDataSource.load(data, {
            clampToGround: true, stroke: Cesium.Color.TRANSPARENT, strokeWidth: 0,
            fill: color.withAlpha(layer === "flood" ? 0.16 : 0.045),
          });
          if (disposed || viewer.isDestroyed()) { source.entities.removeAll(); return; }
          for (const entity of source.entities.values) {
            const feature = data.features.find((f) => String(f.id) === entity.id);
            if (!feature) continue;
            entity.properties = new Cesium.PropertyBag({ environmentFeature: feature });
            if (entity.polygon) entity.polygon.classificationType = new Cesium.ConstantProperty(Cesium.ClassificationType.CESIUM_3D_TILE);
            if (layer === "water") {
              entity.billboard = undefined;
              const observation = feature.properties;
              entity.label = new Cesium.LabelGraphics({
                text: `${observation.name.split(/\s+/).slice(0, 3).join(" ")}\n${observation.value == null ? "No value" : `${observation.value} ${observation.unit} as N`}\nNitrate + nitrite · ${observation.observed?.slice(0, 10) ?? "Undated"}`,
                font: "12px sans-serif", fillColor: Cesium.Color.WHITE,
                showBackground: true, backgroundColor: Cesium.Color.fromCssColorString("#2c2f34").withAlpha(0.94),
                backgroundPadding: new Cesium.Cartesian2(8, 6),
                pixelOffset: new Cesium.Cartesian2(16, -15), horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000),
              });
              entity.point = new Cesium.PointGraphics({
                pixelSize: 19, color: Cesium.Color.fromCssColorString(nutrientColor(feature.properties.value)),
                outlineColor: Cesium.Color.fromCssColorString("#16262d"), outlineWidth: 3,
                heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 35000),
                scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 100000, 0.6),
              });
            }
          }
          if (layer !== "water") {
            for (const feature of data.features) {
              const polygons = feature.geometry.type === "MultiPolygon"
                ? feature.geometry.coordinates as number[][][][]
                : [feature.geometry.coordinates as number[][][]];
              for (const polygon of polygons) for (const ring of polygon) {
                if (ring.length < 2) continue;
                source.entities.add({
                  polyline: { positions: Cesium.Cartesian3.fromDegreesArray(ring.flatMap((point) => [point[0], point[1]])), width: 3,
                    clampToGround: true, classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                    material: color.withAlpha(0.9) },
                  properties: { environmentFeature: feature },
                });
              }
            }
          }
          await viewer.dataSources.add(source);
          if (disposed || viewer.isDestroyed()) { if (!viewer.isDestroyed()) viewer.dataSources.remove(source, true); return; }
          sources.current.set(layer, source); loadedKeys.current.set(layer, key); viewer.scene.requestRender();
          setStates((s) => ({ ...s, [layer]: { loading: false, data } }));
        } catch (error) {
          if (!disposed) setStates((s) => ({ ...s, [layer]: { loading: false, error: error instanceof Error ? error.message : "Data unavailable." } }));
        }
      })();
    }
    viewer.scene.requestRender();
    return () => { disposed = true; controller.abort(); };
  }, [enabled, location.lat, location.lng, retry, viewerRef]);

  function toggle(layer: EnvironmentalLayer) {
    setEnabled((s) => ({ ...s, [layer]: !s[layer] }));
    setSelected(null); onSelection(null);
  }
  const active = LAYERS.filter((l) => enabled[l]);
  function shortName(name: string) {
    return name.replace(/\b(at|near|above|below)\b.*$/i, "").trim().split(/\s+/).slice(0, 3).join(" ");
  }
  const labels = { water: "Water quality", watershed: "Watersheds", flood: "Flood zones" };

  return (
    <section className={`environment-insights ${open ? "environment-insights--open" : ""}`} aria-label="Environmental Insights"
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } }}>
      <button className="environment-insights__trigger" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="environment-insights-body">
        <span>Environmental Insights</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <div id="environment-insights-body" className="environment-insights__body">
        <label className="environment-insights__sign-toggle"><span>Signs</span><input type="checkbox" checked={signsEnabled} onChange={(event) => onSignsChange(event.target.checked)} /></label>
        <div className="environment-insights__layers">
          {LAYERS.map((layer) => <div key={layer}>
            <div className="environment-insights__layer">
              <span className="environment-insights__swatch" style={{ background: ENVIRONMENT_TOPICS[layer].color }} />
              <details><summary>{labels[layer]}</summary>
                <p>{ENVIRONMENT_TOPICS[layer].explanation}</p>
                <p>{ENVIRONMENT_TOPICS[layer].subtitle}</p>
                {layer === "water" && <p>USGS parameter 99133: nitrate plus nitrite, in situ, mg/L as nitrogen. Latest observations can be historical. No readings are interpolated between stations.</p>}
                {states[layer]?.data?.partial && <p>Partial coverage: the service limited the returned features or some records were unavailable.</p>}
                {states[layer]?.data?.features.length === 0 && <p>No records returned. This does not establish clean water or absence of flood risk.</p>}
              </details>
              <input type="checkbox" aria-label={labels[layer]} checked={enabled[layer]} onChange={() => toggle(layer)} onClick={(event) => { if (event.detail > 0) event.currentTarget.blur(); }} />
            </div>
            {enabled[layer] && <div className="environment-insights__layer-detail" role="status">
              {states[layer]?.loading ? "Loading…" : states[layer]?.error ? <button title={states[layer]?.error} onClick={() => setRetry((n) => n+1)}>Unavailable · Retry</button> : states[layer]?.data ? `${states[layer]!.data!.features.length} ${layer === "water" ? "stations" : "areas"}${states[layer]!.data!.partial ? " · partial" : ""}` : "Map loading…"}
            </div>}
          </div>)}
        </div>
        {enabled.water && <details className="environment-insights__legend"><summary>Color key</summary>
          <div>{[["#87d7b5", "<3"], ["#f2bd67", "3–<10"], ["#f18b80", "≥10"], ["#b9c2ca", "No value"]].map(([color, label]) => <span key={label}><i style={{ background: color }} />{label}</span>)}</div>
          <p>Nitrate + nitrite, mg/L as nitrogen. Display bands, not safety ratings. Dates differ.</p>
        </details>}
        {selected ? <section className="environment-insights__selection" aria-label="Selected environmental feature">
          <button className="environment-insights__close" onClick={() => { setSelected(null); onSelection(null); }} aria-label="Clear selection">×</button>
          <h3 title={selected.properties.name}>{shortName(selected.properties.name)}</h3>
          {selected.properties.layer === "water" && <>
            <p className="environment-insights__reading">{selected.properties.value ?? "No reading"} <span>{selected.properties.value != null ? `${selected.properties.unit} as N` : ""}</span></p>
            <small>{selected.properties.observed?.slice(0, 10) ?? "Date unavailable"} · {selected.properties.approval}</small>
          </>}
          {selected.properties.classification && <small>{selected.properties.classification}</small>}
          <details><summary>Details</summary>
            <p>{selected.properties.name}</p><p>{selected.properties.summary}</p>
            {selected.properties.layer === "water" && <p>Nitrate plus nitrite, in situ. Observed {selected.properties.observed}. {selected.properties.qualifier} Latest available observation, possibly historical; not a live feed or tap-water assessment.</p>}
            <a href={selected.properties.sourceUrl} target="_blank" rel="noreferrer">{selected.properties.source} ↗</a>
          </details>
          <button className="environment-insights__ask journey-answer" disabled={!chatAvailable} title={!chatAvailable ? "Available after this activity" : undefined} onClick={() => { setOpen(false); onAsk(); }}>Ask Avery</button>
        </section> : null}
        {active.length > 0 && <footer><button onClick={() => { setEnabled({ water: false, watershed: false, flood: false }); onSignsChange(false); setSelected(null); onSelection(null); }}>Hide all</button></footer>}
      </div>}
    </section>
  );
}
