# Environmental Insights

Open **Journey → Environmental Insights** while flying. The existing Journey surface contains the controls; the feature does not resize the viewer, move the camera, replace the skybox, or alter flight mechanics.

## Environmental journey

The twelve-stop route now follows Water Decisions (Capitol), Drinking Water (Water Works Park), River Monitoring (Raccoon River at Van Meter), Nutrient Runoff (High Trestle Bridge), Flood Control (Saylorville), Wetland Loss (Chichaqua), Creek Restoration (Hoover Creek), Prairie Loss (Neal Smith refuge), Downstream Pollution (Pikes Peak), Stream Buffers (Bear Creek watershed), Erosion Prevention (Hitchcock) and Flood Exposure (Ledges). Six sightseeing stops are replaced with directly relevant water-management, monitoring and restoration places. The bridge over the Des Moines River is retained. Each stop has a sourced problem, impact, response and quiz; sites are not labeled as polluters without evidence.

New coordinate provenance: [Iowa DNR Water Works facility center](https://facilityexplorer.iowadnr.gov/facilityexplorer/sitedetail.aspx?progID=77-BUD-02-20&program=SOLIDWAS), [USGS Van Meter station](https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations/items/USGS-05484500?f=json), [USGS Saylorville location](https://waterdata.usgs.gov/monitoring-location/USGS-05481630/), [DNR Chichaqua survey point 2](https://www.iowadnr.gov/media/2048/download?inline=), [USFWS Neal Smith map point](https://www.fws.gov/refuge/neal-smith), and [USDA SARE Bear Creek study area](https://projects.sare.org/project-reports/gnc06-061/). Bear Creek's published coordinates describe a study area and are labeled accordingly, not an individual installed buffer. New places do not reuse unrelated sightseeing photos.

The intro states the nitrate, soil-loss and flooding problem, explains the upstream/downstream connection, and invites evidence-based exploration. The intro takes about 15 seconds, with reading time assigned per card. Settings → Restart journey clears this device's checkpoint and reloads the original introduction, tutorial and starting position. Checkpoint v2 prevents older sightseeing-route progress from resuming against different destinations.

Journey shows the progress count beside its heading, one objective and distance while navigating. Environmental Insights expands directly to four toggles: Signs, Water quality, Watersheds and Flood zones. Layer definitions, sources and legends stay collapsed; selected map features reveal their evidence only on selection. Field signs are the default experience; map layers are optional secondary tools. Watershed maps show drainage context; they are not habitat or wetland surveys. The old automatic cinematic notes card is removed so it cannot stack behind the hover reader.

Old sightseeing recordings are not attached to the rewritten lessons. They use the controller's existing timed caption mode; the tutorial remains unchanged, and only navigation recordings that still match the destination are used. New destinations use subtitles until matching clips are attached. Re-recorded environmental narration can be generated with `scripts/generateNarration.ts` and intentionally attached afterward. The generator uses a fresh staging folder to prevent reuse of old sightseeing recordings.

Cesium's original widget stylesheet is imported by the root layout so it remains available during development updates. No camera, skybox or tile-loading settings are changed.

## Demonstration (30–45 seconds)

1. Open Environmental Insights in Journey and enable Water quality.
2. Select a station from the nearby list. Distances are from the drone, and selecting evidence does not teleport it.
3. Show the nitrate-plus-nitrite value, observation date and provisional/approved status. The latest observation may be historical.
4. Choose “Ask Avery why this matters” and submit the suggested question in the existing chat.
5. Enable Watersheds & runoff to show the connected drainage landscape. Flood exposure adds FEMA mapped areas near the flight.

## Authoritative sources

- USGS Water Data OGC API: `https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items`. Parameter **99133** is nitrate **plus nitrite**, in situ, mg/L **as nitrogen**. Monitoring-location metadata supplies verified coordinates, names and Iowa state membership. Newest timestamps are selected per station; missing or invalid values remain missing. Retrieval is cached for 15 minutes and metadata for one day; this is not a continuously refreshing live feed.
- USGS Watershed Boundary Dataset: `https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/4`. Actual HUC8 subbasin polygons intersecting the flight region, with outlines rendered separately because ground-clamped Cesium polygons do not support ordinary outlines.
- FEMA National Flood Hazard Layer: `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28`. Actual special flood hazard and 0.2%-annual-chance polygons intersecting the local region. Minimal-hazard X areas are not filled as if they were flood-hazard zones. Zone and subtype are retained. These describe mapped hazard, not current floods or forecasts.
- Educational background: https://www.epa.gov/nutrientpollution/sources-and-solutions and https://www.epa.gov/nutrientpollution/basic-information-nutrient-pollution.

Water colors indicate concentration bands only; they are not health classifications. River observations do not establish the condition of treated drinking water or the cause of a measurement. A watershed does not establish that individual fields pollute. No pollution surface is interpolated between stations. Empty/error/partial-coverage states are explicit; no replacement measurements or fabricated geometry are used.

Geographic polygon queries are limited to the local flight region and refreshed after approximately 2.8 km of latitude movement (longitude spacing varies). Requests are cancelled when superseded. Independent layers retain loaded data when other toggles change; turning a layer off removes its entities. Statewide water monitoring contains a small set of returned Iowa stations. Geographic simplification is approximately 0.00015 degrees; FEMA responses cap at 100 features and display a partial-coverage notice when capped. This is an educational view, not parcel-level flood determination. Watersheds may extend far beyond the local query window because the full intersecting hydrologic unit is shown. No separate river-network dataset is included.

The chat endpoint retrieves the selected feature again from the official service rather than accepting client-provided measurements. Existing landmark behavior remains available when no environmental feature is selected. Tutorial and quiz restrictions remain in effect.

Verification: `npx tsc --noEmit`, targeted ESLint, `node --test tests/*.test.cjs`, and `npm run build`. Tests cover observation selection, historical dates, state membership, missing readings, partial coverage, FEMA classification and input validation, alongside existing flight and journey tests.


## Floating field signs

`EnvironmentalFieldSigns.tsx` renders translucent world-sized Cesium billboards at the twelve verified lesson coordinates. It changes no camera, tiles, skybox or flight settings. The translucent dark signs have no colored stripe or ground tether. A sign stays short until hovered within 750 metres. Clicking nearby also opens the reader. Problem, People, Response and Evidence views connect each place to consequences, two conservation responses and sources. Response buttons explain mechanisms; they do not simulate completed projects or invent improvements.

At most three nearby signs are shown, with perspective scaling and normal scene occlusion. Great-circle distance gates interaction. Loaded tile heights refine label altitude without requesting terrain, and the sign itself is excluded from height sampling to prevent feedback. A visible navigation plaque replaces the duplicate environmental billboard and shares its hover metadata. The reading panel stays fixed at the left and directly reuses the existing exhibit-peek, journey-panel and journey-panel--reverse classes. It stays open when the pointer leaves the sign, closes with Escape or its close button, and uses the existing buttons. Render listeners, picking handlers, owned entities and pending requests are cleaned up on teardown.

Evidence loads only on request. Water lessons choose the geographically nearest returned station and display its distance, units, observation date and approval status; the reading is not attributed to the lesson site. Polygon evidence requires the lesson point to lie inside an actual returned polygon (excluding holes). Drainage and hazard context are explicitly distinguished from local pollution, habitat condition, stormwater modeling or current floods. No containing feature is an unknown, not proof of safety. Partial coverage and service failure are disclosed. The hover reader contains no Ask Avery action; Avery remains available through the existing chat and map controls.

Scientific references for response mechanisms include the Iowa DNR nutrient reduction and conservation practice sources in the lesson data, EPA's Types of Green Infrastructure, and FEMA's Floods and Floodplain Management guidance. The Journey panel contains four compact environmental toggles. Hide all clears both.


Nearby USGS markers also display dated measurement labels within 8 km, instead of unexplained colored dots. The source parameter is nitrate plus nitrite as nitrogen. Successful official service responses are cached in a bounded process cache; HTTP-200 error payloads are discarded and remain retryable. Avery uses low reasoning effort and an answer-capable token limit because the provider includes reasoning tokens in the output cap; reasoning content is never rendered.


## HDRI orientation

The existing sunset cube faces and Cesium SkyBox environment pass are retained. `skyOrientation.ts` corrects the Y-up panorama to the local east/up/south frame and updates only that sky rotation as the camera moves across Iowa. It does not change the camera, tiles, lighting, exposure, tone mapping or textures. The narrow installed-Cesium adapter is isolated and guarded; tests verify local vertical, orthonormal rotation and preservation of the SkyBox's original sources and environment-command mode.
