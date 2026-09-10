# Iowa From Above: narration scripts

Read each stop's three paragraphs as one recording, with a brief pause between views. The camera uses three compositions across a continuous orbit. Without a recording, each tour lasts 39 seconds and displays the script as captions. Enter opens the interactive exhibit early.

Save each recording in `public/audio/journey/` using the stop ID below, then set that stop's `audio` field in `app/journeyStops.ts` to `/audio/journey/<id>.mp3`. Only the current stop's configured recording loads. No missing audio URLs are requested. The tour uses the recording's duration when available (minimum 30 seconds); the three captions divide that time equally. For precise narration timing, record the three paragraphs to roughly equal lengths.

The route starts after the tutorial. Arrival within 110 horizontal meters starts a tour. Stops farther than 1,800 meters use a portal 380 meters ahead, followed by a short flight from the destination's approach. Elevations in the stop data are camera fallbacks, not surveyed ground heights. Loaded tile heights take precedence for tour targets. No extra root session is created by the journey.

Coordinate checks include the [High Trestle Bridge photo location](https://commons.wikimedia.org/wiki/File:High_Trestle_Trail_Bridge.jpg), [Living History Farms location](https://www.wikidata.org/wiki/Q6659142), [Roseman Bridge USGS-derived coordinates](https://topoquest.com/place/iowa/bridge/roseman-covered-bridge/1823053), and [Iowa State's Hitchcock weather-station location](https://mesonet1.agron.iastate.edu/sites/networks.php?network=OT&station=OT0007). The Loess Hills stop uses the Hitchcock area. Locations are aerial tour targets; Google imagery coverage and capture dates vary. All twelve transitions are simulation-tested, but every live camera view still needs visual review against the available tiles.

## 1. Iowa State Capitol

Recording: `capitol.mp3`

**View 1**

Welcome to the Iowa State Capitol. Look up at the central gold dome, then find the four smaller domes around it. This is where Iowa's legislature meets.

**View 2**

From this side, the building's symmetry becomes clear. The central dome anchors the design, while the wings hold the spaces where state government works.

**View 3**

Now look outward toward Des Moines. Decisions made here reach far beyond the city, into the farms, towns, and rivers we are about to explore. How many domes did you find?

**Interactive question:** How many domes crown the Capitol?

1. Five
2. Three

Answer: Five

[Background source](https://www.legis.iowa.gov/docs/publications/IF/793559.pdf)

## 2. Living History Farms

Recording: `living-history-farms.mp3`

**View 1**

These fields help tell the story of farming in Iowa. Living History Farms interprets different periods of agricultural life, from Indigenous farming to later farms and a town.

**View 2**

Look at the relationship between open land, buildings, and paths. Farming is more than a crop. It depends on tools, labor, soil, and the communities around it.

**View 3**

Our view brings those pieces together. As technology changes, the work changes too. Which part of Iowa's story is this place built to help us understand?

**Interactive question:** What story does this place tell?

1. Ocean navigation
2. Changes in farming

Answer: Changes in farming

[Background source](https://www.lhf.org/)

## 3. Iowa's Interstate Crossroads

Recording: `interstate-crossroads.mp3`

**View 1**

Roads connect the places we visit. Here on the western side of Des Moines, interstate lanes and ramps connect traffic moving through Iowa.

**View 2**

Follow a curve from above. Ramps let vehicles change direction without crossing opposing traffic at an ordinary intersection. The shape of the land becomes part of the design.

**View 3**

These connections matter to farms, shops, and families. A harvest still needs a way to reach its next destination. What do the curved ramps help traffic do?

**Interactive question:** What do interchange ramps connect?

1. Different road directions
2. Underground rivers

Answer: Different road directions

[Background source](https://iowadot.gov/modes-travel/roads-highways/major-construction-projects/des-moines-area-interstate-projects)

## 4. High Trestle Trail Bridge

Recording: `high-trestle.mp3`

**View 1**

The High Trestle Trail Bridge carries a trail across the Des Moines River valley. Its long span gives people a way to experience the landscape above the water.

**View 2**

Watch how the crossing links the two sides of the valley. The steel frames along the trail reference the area's mining history.

**View 3**

Infrastructure can become a place to slow down. A crossing is also a viewpoint, a trail connection, and a reminder of local history. Which river valley are we crossing?

**Interactive question:** Which river lies below this crossing?

1. Mississippi River
2. Des Moines River

Answer: Des Moines River

[Background source](https://www.traveliowa.com/faq/)

## 5. Ledges State Park

Recording: `ledges.mp3`

**View 1**

At Ledges State Park, Iowa's landscape folds into wooded slopes and a creek valley. This is a different view of a state often pictured as flat.

**View 2**

Look for the way the valley cuts through the higher ground. Water shapes a landscape over time, and the slopes guide where plants grow and people travel.

**View 3**

Some details hide beneath the tree canopy in this aerial view. The broader shape still tells a story. What natural force helps carve a creek valley?

**Interactive question:** What helps carve a creek valley?

1. Moving water
2. Streetlights

Answer: Moving water

[Background source](https://www.iowadnr.gov/places-go/state-parks/all-parks/ledges-state-park)

## 6. Amana Colonies

Recording: `amana.mp3`

**View 1**

The Amana Colonies are seven villages founded by German immigrants. Their buildings and streets preserve a distinctive chapter of Iowa's community history.

**View 2**

From above, notice the close relationship between the village and the surrounding land. Work, homes, and shared institutions all helped shape daily life.

**View 3**

A historic place is more than a single building. Here, a group of villages carries the story. How many villages make up the Amana Colonies?

**Interactive question:** How many villages make up the colonies?

1. Two
2. Seven

Answer: Seven

[Background source](https://www.traveliowa.com/cities/middle-amana-iowa/980/)

## 7. Herbert Hoover's Hometown

Recording: `hoover.mp3`

**View 1**

We are in West Branch, where Herbert Hoover was born. The national historic site preserves places connected to the early life of the thirty-first president.

**View 2**

This view puts a small-town beginning beside a much larger national story. Streets, homes, and open spaces help us imagine the community that surrounded him.

**View 3**

History often begins in ordinary places. A modest home can connect Iowa to events far beyond its borders. Which president's childhood are we exploring?

**Interactive question:** Who was born in West Branch?

1. Herbert Hoover
2. Abraham Lincoln

Answer: Herbert Hoover

[Background source](https://www.nps.gov/heho/index.htm)

## 8. Field of Dreams

Recording: `field-of-dreams.mp3`

**View 1**

A baseball diamond beside Iowa farmland became a familiar movie setting. The Field of Dreams site near Dyersville connects a rural landscape with film and imagination.

**View 2**

Look at the contrast between the shape of the ballfield and the surrounding fields. The setting is a large part of what makes this place recognizable.

**View 3**

Iowa's cultural stories live in its landscape too. A field can be a workplace, a gathering place, or a scene remembered by people far away. What sport defines this site?

**Interactive question:** Which sport is played on this field?

1. Tennis
2. Baseball

Answer: Baseball

[Background source](https://www.traveliowa.com/faq/)

## 9. Pikes Peak & the Mississippi

Recording: `pikes-peak.mp3`

**View 1**

Here the view opens across the Mississippi River from Pikes Peak State Park. The river and its bluffs give northeastern Iowa a very different outline.

**View 2**

Follow the water through the valley. Rivers connect habitats and communities, and they have long shaped the routes people use to move across the continent.

**View 3**

The shoreline is only one part of the river system. Look at the islands, channels, and surrounding slopes together. Which major river are we looking across?

**Interactive question:** Which river shapes this view?

1. Mississippi River
2. Colorado River

Answer: Mississippi River

[Background source](https://www.iowadnr.gov/places-go/state-parks/all-parks/pikes-peak-state-park)

## 10. Effigy Mounds

Recording: `effigy-mounds.mp3`

**View 1**

Effigy Mounds National Monument protects sacred places built by Indigenous peoples. Some mounds take animal forms, including bears and birds.

**View 2**

We will keep a broad view of the wooded landscape. These are culturally significant and sacred places, not objects to fly through or disturb. Many details are hidden by trees.

**View 3**

The monument preserves more than two hundred known mounds. Their meaning includes living connections with associated Tribal Nations. What should guide a visit to this place?

**Interactive question:** How should we approach this sacred landscape?

1. Disturb the mounds
2. With respect and care

Answer: With respect and care

[Background source](https://home.nps.gov/efmo/learn/historyculture/efmonm.htm)

## 11. Loess Hills

Recording: `loess-hills.mp3`

**View 1**

Western Iowa rises into the Loess Hills. These hills are made from deposits of windblown silt, a landscape built from material fine enough for wind to carry.

**View 2**

Watch the ridgelines as the camera turns. From above, the folds and slopes stand out against the broader land around them.

**View 3**

Water reshapes these hills, but wind supplied the sediment that helped form them. Iowa's scenery records more than one kind of natural force. What is loess made of?

**Interactive question:** What material forms loess?

1. Windblown silt
2. Coral reefs

Answer: Windblown silt

[Background source](https://www.traveliowa.com/the-loess-hills-iowas-famous-geological-gem/)

## 12. Roseman Covered Bridge

Recording: `madison-county.mp3`

**View 1**

Our last stop is Roseman Covered Bridge in Madison County. A small crossing can hold a large place in the identity of a community.

**View 2**

Look at the creek, the road approach, and the land on either side. Bridges solve a practical problem, but the places around them give each crossing its character.

**View 3**

We began at the Capitol and followed Iowa through farming, roads, rivers, and history. These places are connected by the people who care for them. What has linked every stop on our journey?

**Interactive question:** What connects the places we explored?

1. They all look identical
2. People and the landscape

Answer: People and the landscape

[Background source](https://industrypartners.traveliowa.com/travel-areas/)
