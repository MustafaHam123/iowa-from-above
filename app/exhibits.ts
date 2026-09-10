export type Exhibit = {
  id: string;
  name: string;
  location: string;
  theme: string;
  summary: string;
  funFact: string;
  statistic: { value: string; label: string; detail: string };
  article: {
    intro: string;
    story: string;
    importance: string;
    lookFor: string;
  };
  image: {
    url: string;
    alt: string;
    credit: string;
    source: string;
  };
  sources: { label: string; url: string }[];
};

export const EXHIBITS: Exhibit[] = [
  {
    id: "capitol",
    name: "Iowa State Capitol",
    location: "Des Moines, IA",
    theme: "Government",
    summary: "Iowa's lawmakers meet inside this hilltop building in Des Moines. Its gold central dome and four smaller domes make it easy to recognize from the air.",
    funFact: "The Capitol has one large central dome and four smaller domes, a combination found on no other American state capitol.",
    statistic: { value: "5", label: "domes", detail: "One central dome and four smaller domes crown the building." },
    article: {
      intro: "The Iowa State Capitol sits above downtown Des Moines and houses the Iowa General Assembly. From the air, the building's balanced plan is clearer than it is from the front steps.",
      story: "The central dome marks the middle of the building. Four smaller domes sit around it, while the long wings hold the chambers and offices where state work takes place.",
      importance: "Laws debated here affect schools, roads, farms, public safety, and daily life across Iowa. The Capitol connects one building in Des Moines with decisions felt in every county.",
      lookFor: "Count the five domes, then trace the straight paths and terraces that organize the grounds around the building.",
    },
    image: {
      url: "/exhibits/capitol.jpg",
      alt: "The Iowa State Capitol in Des Moines",
      credit: "Carol M. Highsmith, Library of Congress",
      source: "https://commons.wikimedia.org/wiki/File:Capitol_building,_Des_Moines,_Iowa.jpg",
    },
    sources: [{ label: "Iowa Legislature Capitol facts", url: "https://www.legis.iowa.gov/docs/publications/IF/793559.pdf" }],
  },
  {
    id: "living-history-farms",
    name: "Living History Farms",
    location: "Urbandale, IA",
    theme: "Agriculture",
    summary: "This open-air museum explains how farming and rural life changed across Iowa. Its fields, homes, shops, and working areas turn agricultural history into a place you can walk through.",
    funFact: "The museum presents several periods of Iowa farm life instead of freezing the story at one date.",
    statistic: { value: "1970", label: "opening year", detail: "Living History Farms began welcoming visitors in 1970." },
    article: {
      intro: "Living History Farms uses real spaces and demonstrations to explain how people worked the land, raised animals, built communities, and adapted to new tools.",
      story: "The site connects Indigenous farming, early settler agriculture, later farm technology, and town life. That broader view matters because a farm never operates alone. It depends on weather, soil, labor, markets, and nearby communities.",
      importance: "Agriculture has shaped Iowa's economy and its towns for generations. This museum gives visitors a way to compare those changes at human scale instead of treating farming as a single machine or crop.",
      lookFor: "Notice how the buildings sit in relation to fields and paths. Their spacing shows how work moved through each part of a farm day.",
    },
    image: {
      url: "/exhibits/living-history-farms.jpg",
      alt: "A historic farm building at Living History Farms",
      credit: "Dennis Bratland, CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Living_History_Farms_01.jpg",
    },
    sources: [{ label: "Living History Farms", url: "https://www.lhf.org/" }],
  },
  {
    id: "interstate-crossroads",
    name: "I-80 / I-35 / I-235 West Mixmaster",
    location: "West Des Moines, IA",
    theme: "Transportation",
    summary: "Three interstate routes meet at the West Mixmaster. The ramps sort traffic bound for central Des Moines, northern Iowa, Kansas City, Omaha, and points farther east.",
    funFact: "I-80 and I-35 share the same pavement around the north and west sides of Des Moines before separating again.",
    statistic: { value: "$114.5M", label: "project budget", detail: "Iowa DOT lists a $114.5 million budget for the current Southwest Mixmaster reconstruction." },
    article: {
      intro: "The West Mixmaster is where I-235 begins and I-80 meets I-35 on the west side of Des Moines. It is a compact interchange with several traffic movements packed into a small area.",
      story: "Its loops and short merge areas were designed for much lighter traffic. Iowa DOT plans new flyover bridges and ramp changes to separate movements that currently compete for the same space.",
      importance: "This interchange carries local commuters and long-distance freight through the same junction. A delay here can spread across the metro and onto two interstate corridors that cross the country.",
      lookFor: "Follow each ramp from its entrance to its exit. The curves reveal which traffic streams merge, cross, or separate.",
    },
    image: {
      url: "/exhibits/west-mixmaster.png",
      alt: "Aerial view of the I-80, I-35, and I-235 West Mixmaster",
      credit: "Iowa Department of Transportation",
      source: "https://iowadot.gov/media/4262/download?inline=",
    },
    sources: [{ label: "Iowa DOT Southwest Mixmaster project", url: "https://iowadot.gov/modes-travel/roads-highways/major-construction-projects/des-moines-area-interstate-projects/southwest-mixmaster-construction" }],
  },
  {
    id: "high-trestle",
    name: "High Trestle Trail Bridge",
    location: "Madrid and Woodward, IA",
    theme: "Trails and engineering",
    summary: "This trail bridge crosses the Des Moines River valley between Madrid and Woodward. Its steel frames make the crossing feel like a tunnel suspended above the landscape.",
    funFact: "The angled steel frames refer to the shafts of the coal mines that once operated in the area.",
    statistic: { value: "1/2 mile", label: "bridge length", detail: "The crossing stretches roughly half a mile across the river valley." },
    article: {
      intro: "The High Trestle Trail Bridge carries walkers and cyclists over the Des Moines River valley. The long approach gives the structure time to emerge from the surrounding trail.",
      story: "Its most recognizable feature is a series of square steel frames set at changing angles. At night, blue lights outline the frames and make the bridge visible across the valley.",
      importance: "The bridge reused a transportation corridor for recreation and linked communities on both sides of the river. Its design also keeps a piece of the area's mining history in view.",
      lookFor: "Watch how the frames appear to rotate as your viewing angle changes, then look down to find the river beneath the deck.",
    },
    image: {
      url: "/exhibits/high-trestle.jpg",
      alt: "High Trestle Trail Bridge over the Des Moines River valley",
      credit: "Phil Roeder, CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File:High_Trestle_Trail_Bridge.jpg",
    },
    sources: [{ label: "Travel Iowa trail information", url: "https://www.traveliowa.com/faq/" }],
  },
  {
    id: "ledges",
    name: "Ledges State Park",
    location: "Boone County, IA",
    theme: "Water and rock",
    summary: "Wooded slopes and sandstone ledges surround Pea's Creek at this Boone County park. The narrow valley is a sharp contrast to the broad fields nearby.",
    funFact: "Ledges was among Iowa's earliest state parks, and its steep terrain helped give the park its name.",
    statistic: { value: "1924", label: "established", detail: "Ledges State Park was established in 1924." },
    article: {
      intro: "Ledges State Park follows a creek valley cut into higher ground near the Des Moines River. Trees cover much of the terrain, but the shape of the valley remains visible from above.",
      story: "Moving water carved through layers of sandstone and created the park's ledges, slopes, and low crossings. Flooding is part of this landscape, so roads and trails have to respond to the creek rather than ignore it.",
      importance: "The park shows a side of Iowa that a flat road map can miss. Its terrain records how water, rock, and time can shape a compact area into a distinct habitat.",
      lookFor: "Trace the creek through the trees and note where the valley narrows. Those tight sections expose the relationship between water and rock.",
    },
    image: {
      url: "/exhibits/ledges.jpg",
      alt: "Rock ledges and trees at Ledges State Park",
      credit: "Rbreidbrown, CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Ledges_State_Park,_Iowa,_near_the_Des_Moines_river.jpg",
    },
    sources: [{ label: "Iowa DNR Ledges State Park", url: "https://www.iowadnr.gov/places-go/state-parks/all-parks/ledges-state-park" }],
  },
  {
    id: "amana",
    name: "Amana Colonies",
    location: "Iowa County, IA",
    theme: "Community and craft",
    summary: "Seven villages in east-central Iowa preserve the streets, workshops, farms, and shared institutions of a German religious community founded in the 1850s.",
    funFact: "Homestead joined the other six villages because its railroad station connected the colonies with outside markets.",
    statistic: { value: "7", label: "villages", detail: "Seven villages make up the Amana Colonies." },
    article: {
      intro: "The Amana Colonies grew as a group of villages rather than one large town. Their layout joined homes, farms, workshops, kitchens, and religious life.",
      story: "Community members held property and organized work together until the 1930s. The buildings that remain make those arrangements easier to understand because the parts of daily life are still close to one another.",
      importance: "Amana adds a different kind of settlement story to Iowa history. It shows how immigration, faith, skilled work, and shared ownership shaped a community over several generations.",
      lookFor: "Compare the village center with the surrounding fields. The short distances between work and home are part of the story.",
    },
    image: {
      url: "/exhibits/amana.jpg",
      alt: "A street in the Amana Colonies",
      credit: "Kepper66, public domain",
      source: "https://commons.wikimedia.org/wiki/File:Amana_Colonies.JPG",
    },
    sources: [{ label: "Travel Iowa Amana information", url: "https://www.traveliowa.com/cities/middle-amana-iowa/980/" }],
  },
  {
    id: "hoover",
    name: "Herbert Hoover National Historic Site",
    location: "West Branch, IA",
    theme: "Iowa and the presidency",
    summary: "This West Branch site preserves Herbert Hoover's birthplace cottage and other places tied to his early life before he became the thirty-first president.",
    funFact: "The grounds include an 81-acre tallgrass prairie near the presidential library and historic buildings.",
    statistic: { value: "31st", label: "U.S. president", detail: "Herbert Hoover served as the thirty-first president of the United States." },
    article: {
      intro: "Herbert Hoover was born in a small cottage in West Branch in 1874. The national historic site places that home beside a blacksmith shop, schoolhouse, meetinghouse, prairie, gravesite, and presidential library.",
      story: "The preserved buildings focus on Hoover's childhood and the Quaker community around him. Their modest size keeps the story grounded in the town where his life began.",
      importance: "The site connects national history with an Iowa neighborhood. It also gives visitors room to consider how family, faith, work, and place influenced a future president.",
      lookFor: "Find the small birthplace cottage, then compare it with the scale of the library and grounds nearby.",
    },
    image: {
      url: "/exhibits/hoover.jpg",
      alt: "Buildings and grounds at Herbert Hoover National Historic Site",
      credit: "National Park Service, public domain",
      source: "https://commons.wikimedia.org/wiki/File:Views_of_Herbert_Hoover_National_Historic_Site,_Iowa_(8e123f47-a5c8-41f6-b8fc-5ed76081a8a0).jpg",
    },
    sources: [{ label: "National Park Service", url: "https://www.nps.gov/heho/index.htm" }],
  },
  {
    id: "field-of-dreams",
    name: "Field of Dreams",
    location: "Dyersville, IA",
    theme: "Film and rural Iowa",
    summary: "A baseball diamond cut into a cornfield near Dyersville became one of Iowa's most familiar movie locations.",
    funFact: "The field remains recognizable because the outfield ends at rows of corn instead of a conventional stadium wall.",
    statistic: { value: "1989", label: "film release", detail: "Field of Dreams reached theaters in 1989." },
    article: {
      intro: "The Field of Dreams movie site is a working baseball diamond beside farmland near Dyersville. Its simple geometry stands out clearly against rows of crops.",
      story: "The rural setting was central to the film's look. The farmhouse, diamond, and cornfield created a scene that felt both ordinary and slightly unreal.",
      importance: "The site tied an Iowa farm to a story seen around the world. It also shows how a familiar landscape can take on a second life through film and tourism.",
      lookFor: "Find the outfield edge where grass meets corn. That boundary is the image most viewers remember.",
    },
    image: {
      url: "/exhibits/field-of-dreams.jpg",
      alt: "The Field of Dreams baseball diamond near Dyersville",
      credit: "C. G. P. Grey, CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File:Field_of_Dreams_4889145990.jpg",
    },
    sources: [{ label: "Travel Iowa visitor information", url: "https://www.traveliowa.com/faq/" }],
  },
  {
    id: "pikes-peak",
    name: "Pikes Peak State Park",
    location: "McGregor, IA",
    theme: "River systems",
    summary: "A high bluff at Pikes Peak State Park looks over the Mississippi River and the mouth of the Wisconsin River.",
    funFact: "The overlook faces the point where the Wisconsin River meets the Mississippi across the water.",
    statistic: { value: "500 ft", label: "bluff height", detail: "The main overlook rises about 500 feet above the river." },
    article: {
      intro: "Pikes Peak State Park sits on a bluff above the Upper Mississippi River near McGregor. The height opens a wide view across channels, islands, floodplain, and the Wisconsin shore.",
      story: "The river below is not one simple line. Water moves around islands and through side channels, while the bluffs confine the wider valley.",
      importance: "This view makes the scale of the Mississippi River system easier to grasp. It also shows why rivers have guided travel, settlement, trade, and habitat across the region.",
      lookFor: "Find the Wisconsin River entering from the east, then follow the separate channels around the islands below.",
    },
    image: {
      url: "/exhibits/pikes-peak.jpg",
      alt: "Mississippi River overlook at Pikes Peak State Park",
      credit: "McGhiever, CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File:PikesPeakStatePark.jpg",
    },
    sources: [{ label: "Iowa DNR Pikes Peak State Park", url: "https://www.iowadnr.gov/places-go/state-parks/all-parks/pikes-peak-state-park" }],
  },
  {
    id: "effigy-mounds",
    name: "Effigy Mounds National Monument",
    location: "Harpers Ferry, IA",
    theme: "Indigenous heritage",
    summary: "The monument protects burial and ceremonial mounds built by Indigenous peoples along the Mississippi River bluffs. Some take the forms of bears and birds.",
    funFact: "Animal-shaped effigy mounds are concentrated in a region that includes northeast Iowa and parts of nearby states.",
    statistic: { value: "200+", label: "known mounds", detail: "The monument protects more than two hundred known mounds." },
    article: {
      intro: "Effigy Mounds National Monument protects a sacred landscape above the Mississippi River. Conical, linear, and animal-shaped earthworks sit among the wooded bluffs.",
      story: "Many shapes are difficult to see beneath the tree canopy. Maps and lidar can help explain their forms, but the site is more than a pattern viewed from above. These places remain culturally connected to associated Tribal Nations.",
      importance: "The monument protects burial places, cultural knowledge, and a long Indigenous presence in the Upper Mississippi region. Respect matters more here than getting a closer view.",
      lookFor: "Keep a broad distance and study the relationship between the bluff, river, and mound groups. Stay on established routes when visiting in person.",
    },
    image: {
      url: "/exhibits/effigy-mounds.jpg",
      alt: "Bear-shaped mound at Effigy Mounds National Monument",
      credit: "Jamie Sambdman, CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Bear_at_Effigy_Mounds_National_Monument.jpg",
    },
    sources: [{ label: "National Park Service mound history", url: "https://home.nps.gov/efmo/learn/historyculture/efmonm.htm" }],
  },
  {
    id: "loess-hills",
    name: "Hitchcock Nature Center",
    location: "Honey Creek, IA",
    theme: "Wind-shaped land",
    summary: "Hitchcock Nature Center protects prairie, woodland, and steep ridges in Iowa's Loess Hills above the Missouri River valley.",
    funFact: "The deep loess deposits along western Iowa are comparable in scale to deposits found in parts of China.",
    statistic: { value: "200 miles", label: "Iowa ridge band", detail: "The Loess Hills form a narrow north-to-south band about 200 miles long." },
    article: {
      intro: "Hitchcock Nature Center sits in the Loess Hills near Honey Creek. Its narrow ridges and steep slopes were built from fine sediment carried and deposited by wind.",
      story: "Rain and streams later cut into those deposits, producing the folded terrain visible today. Prairie occupies open slopes while woodland fills many protected areas.",
      importance: "The hills preserve rare landforms and habitats along Iowa's western edge. They also record how glacial material, wind, and erosion worked in sequence to shape the region.",
      lookFor: "Follow the sharp ridge tops. Their narrow profiles separate the Loess Hills from the broader plains and river valley nearby.",
    },
    image: {
      url: "/exhibits/loess-hills.jpg",
      alt: "Ridges and prairie in Iowa's Loess Hills",
      credit: "Wikimedia Commons contributor",
      source: "https://commons.wikimedia.org/wiki/File:Iowa_loesshills.jpg",
    },
    sources: [
      { label: "National Park Service Hitchcock Nature Center", url: "https://www.nps.gov/places/hitchcock-nature-center.htm" },
      { label: "U.S. Geological Survey Loess Hills", url: "https://www.usgs.gov/publications/geology-loess-hills-iowa" },
    ],
  },
  {
    id: "madison-county",
    name: "Roseman Covered Bridge",
    location: "Winterset, IA",
    theme: "Connections through time",
    summary: "The Roseman Covered Bridge crosses the Middle River in Madison County. Its red wooden enclosure protects the bridge structure and gives the crossing its familiar shape.",
    funFact: "Scenes from The Bridges of Madison County were filmed at Roseman Bridge.",
    statistic: { value: "1883", label: "year built", detail: "Benton Jones built the Roseman Covered Bridge in 1883." },
    article: {
      intro: "Roseman Covered Bridge spans the Middle River southwest of Winterset. The enclosed wooden structure turns a short crossing into a distinct room over the water.",
      story: "Covering a timber bridge helped shield structural wood from weather. At Roseman, that practical choice also created the form that later became closely associated with Madison County.",
      importance: "The bridge links local transportation history with preservation and film. It remains useful as a way to understand how a small piece of infrastructure can become part of a county's identity.",
      lookFor: "Notice the long red walls, small side openings, and the way the road lines up with the entrance before crossing the river.",
    },
    image: {
      url: "/exhibits/roseman.jpg",
      alt: "Roseman Covered Bridge in Madison County",
      credit: "SanjayFays, CC BY 3.0",
      source: "https://commons.wikimedia.org/wiki/File:RosemanBridge.jpg",
    },
    sources: [{ label: "Travel Iowa regional information", url: "https://industrypartners.traveliowa.com/travel-areas/" }],
  },
];

export const EXHIBIT_BY_ID = Object.fromEntries(
  EXHIBITS.map((exhibit) => [exhibit.id, exhibit]),
) as Record<string, Exhibit>;
