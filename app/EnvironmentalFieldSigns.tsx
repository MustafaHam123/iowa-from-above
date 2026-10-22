"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as C from "cesium";
import { JOURNEY_STOPS } from "./journeyStops";
import { ENVIRONMENTAL_ISSUES } from "./environmentalJourney";
import { ENVIRONMENTAL_STORIES, containsLocation, distanceKm } from "./environmentalStories";
import { type EnvironmentalData, type EnvironmentalFeature } from "./environment";

type Evidence = { loading: boolean; error?: boolean; data?: EnvironmentalData };
const VIEWS = ["Problem", "People", "Response", "Evidence"] as const;
type View = typeof VIEWS[number];

export default function EnvironmentalFieldSigns({ viewerRef, positionRef, issueId, enabled }: {
  viewerRef: RefObject<C.Viewer | null>; positionRef: RefObject<{lat: number; lng: number}>;
  issueId: string; enabled: boolean;
}) {
  const readerRef = useRef<HTMLElement>(null);
  const closeReaderRef = useRef<() => void>(() => {});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<View>("Problem");
  const [response, setResponse] = useState(0);
  const [evidence, setEvidence] = useState<Record<string, Evidence>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const expandedRef = useRef(expanded);
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  useEffect(() => {
    closeReaderRef.current = () => {
      setExpanded(null);
      viewerRef.current?.scene.canvas.focus({ preventScroll: true });
    };
  }, [viewerRef]);

  useEffect(() => {
    if (enabled) return;
    const frame=window.requestAnimationFrame(()=>{expandedRef.current=null;setExpanded(null);});
    return ()=>window.cancelAnimationFrame(frame);
  }, [enabled]);

  useEffect(() => {
    if (!expanded || !enabled) return;
    readerRef.current?.focus({ preventScroll: true });
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); closeReaderRef.current(); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let attachedViewer: C.Viewer | undefined;
    let source: C.CustomDataSource | undefined;
    let handler: C.ScreenSpaceEventHandler | undefined;
    let removeRender: (() => void) | undefined;
    let disposed = false;
    let oldCursor = "";
    const timer = window.setInterval(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed() || attachedViewer) return;
      attachedViewer = viewer;
      oldCursor = viewer.scene.canvas.style.cursor;
      const owned = new C.CustomDataSource("environmental-world-signs");
      source = owned;
      const anchors = JOURNEY_STOPS.map((stop) => {
        const issue = ENVIRONMENTAL_ISSUES[stop.id];
        const story = ENVIRONMENTAL_STORIES[stop.id];
        const canvas = document.createElement("canvas");
        canvas.width=1024; canvas.height=320;
        const ctx=canvas.getContext("2d")!;
        // Same slanted plaque geometry as the existing landmark tags; glass fill.
        ctx.beginPath();ctx.moveTo(60,8);ctx.lineTo(1008,8);ctx.lineTo(964,312);ctx.lineTo(16,312);ctx.closePath();
        ctx.fillStyle="rgba(24,29,34,0.72)";ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,0.68)";ctx.lineWidth=4;ctx.stroke();
        ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.shadowColor="rgba(0,0,0,0.95)";ctx.shadowBlur=10;
        ctx.fillStyle="white";ctx.font="600 48px sans-serif";ctx.fillText(issue.title,520,100,810);
        ctx.font="32px sans-serif";ctx.fillText(story.signal,520,164,810);
        ctx.fillStyle="rgba(255,255,255,0.8)";ctx.font="27px sans-serif";ctx.fillText("Hover nearby",520,242,810);
        const world=C.Cartesian3.fromDegrees(stop.lng,stop.lat,stop.elevation+50);
        const entity=owned.entities.add({
          position:world, properties:{fieldSignId:stop.id},
          billboard:{image:canvas,width:110,height:34.375,sizeInMeters:true,
            verticalOrigin:C.VerticalOrigin.BOTTOM,horizontalOrigin:C.HorizontalOrigin.CENTER,
            distanceDisplayCondition:new C.DistanceDisplayCondition(0,18000)},
        });
        return {stop,entity,sampledAt:-Infinity,height:stop.elevation};
      });
      void viewer.dataSources.add(owned).then(()=>{if(disposed && !viewer.isDestroyed())viewer.dataSources.remove(owned,true);});
      let lastUpdate=0;
      const update=()=>{
        const now=performance.now();if(now-lastUpdate<100)return;lastUpdate=now;
        const ordered=[...anchors].sort((a,b)=>Number(b.stop.id===issueId)-Number(a.stop.id===issueId)||distanceKm(positionRef.current,a.stop)-distanceKm(positionRef.current,b.stop));
        const navigationTags = new Set(viewer.entities.values
          .filter((entity)=>entity.show && entity.plane)
          .map((entity)=>entity.properties?.fieldSignId?.getValue())
          .filter((id): id is string=>typeof id === "string"));
        let visible=0;
        for(const anchor of ordered){
          const km=distanceKm(positionRef.current,anchor.stop);
          anchor.entity.show=km<=(anchor.stop.id===issueId?18:7)&&visible<3&&!navigationTags.has(anchor.stop.id);
          if(!anchor.entity.show)continue;visible++;
          if(now-anchor.sampledAt>2000 && viewer.scene.sampleHeightSupported){
            anchor.sampledAt=now;
            const height=viewer.scene.sampleHeight(C.Cartographic.fromDegrees(anchor.stop.lng,anchor.stop.lat), [anchor.entity]);
            if(height!=null && Number.isFinite(height) && Math.abs(height-anchor.height)>0.5){
              anchor.height=height;
              const world=C.Cartesian3.fromDegrees(anchor.stop.lng,anchor.stop.lat,height+50);
              anchor.entity.position=new C.ConstantPositionProperty(world);
            }
          }
        }
      };
      const pickedStop=(position:C.Cartesian2)=>{
        const picked=viewer.scene.pick(position);
        const id=picked?.id?.properties?.fieldSignId?.getValue();
        return typeof id==="string" ? JOURNEY_STOPS.find((stop)=>stop.id===id) : undefined;
      };
      const openSign=(stop:typeof JOURNEY_STOPS[number])=>{
        if(distanceKm(positionRef.current,stop)>0.75 || expandedRef.current===stop.id)return;
        expandedRef.current=stop.id;
        setExpanded(stop.id);setView("Problem");setResponse(0);
      };
      handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((event:{position:C.Cartesian2})=>{const stop=pickedStop(event.position);if(stop)openSign(stop);},C.ScreenSpaceEventType.LEFT_CLICK);
      let lastHover=0;
      let lastHoveredId: string | undefined;
      handler.setInputAction((event:{endPosition:C.Cartesian2})=>{
        const now=performance.now();if(now-lastHover<90)return;lastHover=now;
        const stop=pickedStop(event.endPosition);
        const close=stop && distanceKm(positionRef.current,stop)<=0.75;
        viewer.scene.canvas.style.cursor=stop?(close?"pointer":"default"):oldCursor;
        if(close && lastHoveredId!==stop.id)openSign(stop);
        lastHoveredId=close?stop.id:undefined;
      },C.ScreenSpaceEventType.MOUSE_MOVE);
      removeRender=viewer.scene.postRender.addEventListener(update);
      update();viewer.scene.requestRender();
    },250);
    return ()=>{
      disposed=true;window.clearInterval(timer);removeRender?.();handler?.destroy();
      if(attachedViewer && !attachedViewer.isDestroyed()){
        attachedViewer.scene.canvas.style.cursor=oldCursor;
        if(source)attachedViewer.dataSources.remove(source,true);
        attachedViewer.scene.requestRender();
      }
    };
  }, [enabled, issueId, positionRef, viewerRef]);

  useEffect(() => {
    const requests=controllers.current;
    return () => { for (const controller of requests.values()) controller.abort(); };
  }, []);

  async function loadEvidence(id: string) {
    if (evidence[id]?.data || evidence[id]?.loading) return;
    const stop=JOURNEY_STOPS.find((s)=>s.id===id)!;
    const controller=new AbortController(); controllers.current.get(id)?.abort(); controllers.current.set(id,controller);
    setEvidence((s)=>({...s,[id]:{loading:true}}));
    try {
      const result=await fetch(`/api/environment?${new URLSearchParams({layer:ENVIRONMENTAL_ISSUES[id].layer,lat:String(stop.lat),lng:String(stop.lng)})}`,{signal:controller.signal});
      if (!result.ok) throw new Error("Unavailable");
      const data=await result.json() as EnvironmentalData;
      if (!controller.signal.aborted) setEvidence((s)=>({...s,[id]:{loading:false,data}}));
    } catch { if (!controller.signal.aborted) setEvidence((s)=>({...s,[id]:{loading:false,error:true}})); }
  }

  if (!enabled || !expanded) return null;
  const stop=JOURNEY_STOPS.find((item)=>item.id===expanded)!;
  const issue=ENVIRONMENTAL_ISSUES[stop.id], story=ENVIRONMENTAL_STORIES[stop.id];
  const record=evidence[stop.id];
      let observation: EnvironmentalFeature | undefined;
      if (issue.layer==="water") observation=record?.data?.features.filter((f)=>f.geometry.type==="Point").sort((a,b)=>{
        const coordinates=(f:EnvironmentalFeature)=>({lng:(f.geometry.coordinates as number[])[0],lat:(f.geometry.coordinates as number[])[1]});
        return distanceKm(stop,coordinates(a))-distanceKm(stop,coordinates(b));
      })[0];
      else observation=record?.data?.features.find((f)=>containsLocation(f.geometry,stop.lat,stop.lng));
  return <aside ref={readerRef} tabIndex={-1} role="dialog" aria-modal="false"
    aria-label={`${issue.title} reading`} className="environment-reading exhibit-peek journey-panel journey-panel--reverse">
    <div className="environment-field-sign__body">
      <div className="environment-field-sign__place"><span>{issue.place}</span><button onClick={()=>closeReaderRef.current()} aria-label="Close reading">×</button></div>
      <h2>{issue.title}</h2>
          <div className="environment-field-sign__views" role="tablist" aria-label="Environmental story" onKeyDown={(event)=>{
            if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const index=VIEWS.indexOf(view);
            const next=event.key==="Home" ? 0 : event.key==="End" ? 3 : (index+(event.key==="ArrowRight"?1:3))%4;
            setView(VIEWS[next]); if (VIEWS[next]==="Evidence") void loadEvidence(stop.id);
            event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
          }}>
            {VIEWS.map((item)=><button role="tab" key={item} id={`sign-tab-${stop.id}-${item}`} tabIndex={view===item?0:-1} aria-selected={view===item} aria-controls={`sign-view-${stop.id}`} onClick={()=>{setView(item);if(item==="Evidence")void loadEvidence(stop.id);}}>{item}</button>)}
          </div>
          <div role="tabpanel" id={`sign-view-${stop.id}`} aria-labelledby={`sign-tab-${stop.id}-${view}`}>
            {view==="Problem" && <><p>{issue.problem}</p><small>Place-based lesson</small></>}
            {view==="People" && <p>{story.people}</p>}
            {view==="Response" && <><div className="environment-field-sign__responses">{story.responses.map((option,index)=><button className="journey-answer" key={option.label} aria-pressed={response===index} onClick={()=>setResponse(index)}>{option.label}</button>)}</div><p>{story.responses[response].mechanism}</p><small>Conservation concept</small></>}
            {view==="Evidence" && <div aria-live="polite">
              <small>{issue.layer === "water" ? "Measured observation" : issue.layer === "flood" ? "Mapped hazard" : "Drainage context"}</small>
              {record?.loading && <p>Loading official data…</p>}
              {record?.error && <><p>Official data unavailable.</p><button onClick={()=>void loadEvidence(stop.id)}>Retry</button></>}
              {record?.data && (observation ? <>
                <p className="environment-field-sign__measurement">{issue.layer==="water" ? `${observation.properties.value ?? "No value"} ${observation.properties.value!=null ? `${observation.properties.unit} as N` : ""}` : observation.properties.classification}</p>
                <p>{observation.properties.name}</p>
                {issue.layer==="water" && <><small>Nitrate + nitrite · {observation.properties.observed?.slice(0,10)} · {observation.properties.approval}</small><p>{distanceKm(stop,{lng:(observation.geometry.coordinates as number[])[0],lat:(observation.geometry.coordinates as number[])[1]}).toFixed(1)} km from this lesson. This reading belongs to that station.</p><small>Latest available; possibly historical.</small></>}
                {issue.layer!=="water" && <p>{issue.layer === "watershed" ? "This boundary traces shared drainage, not habitat condition or pollution sources." : "This is mapped flood exposure, not current flooding or a street-runoff model."}</p>}
                <a href={observation.properties.sourceUrl} target="_blank" rel="noreferrer">Official record ↗</a>
              </> : <p>{issue.layer==="flood" ? "No returned hazard polygon contains this lesson point. That does not establish safety." : "No containing feature returned. This layer cannot establish the condition of this site."}</p>)}
              {record?.data?.partial && <small>Partial coverage</small>}
            </div>}
          </div>
          <footer><a href={issue.source.url} target="_blank" rel="noreferrer">Source ↗</a></footer>
    </div>
  </aside>;
}
