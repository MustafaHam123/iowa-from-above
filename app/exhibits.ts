import { JOURNEY_STOPS } from "./journeyStops";
import { ENVIRONMENTAL_ISSUES } from "./environmentalJourney";

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
  image?: {
    url: string;
    alt: string;
    credit: string;
    source: string;
  };
  sources: { label: string; url: string }[];
};

const PLACE_DETAILS: Record<string, Pick<Exhibit, "id" | "location" | "image" | "sources">> = {
  "capitol": {
    "id": "capitol",
    "location": "Des Moines, IA",
    "image": {
      "url": "/exhibits/capitol.jpg",
      "alt": "The Iowa State Capitol in Des Moines",
      "credit": "Carol M. Highsmith, Library of Congress",
      "source": "https://commons.wikimedia.org/wiki/File:Capitol_building,_Des_Moines,_Iowa.jpg"
    },
    "sources": [
      {
        "label": "Iowa Legislature Capitol facts",
        "url": "https://www.legis.iowa.gov/docs/publications/IF/793559.pdf"
      }
    ]
  },
  "high-trestle": {
    "id": "high-trestle",
    "location": "Madrid and Woodward, IA",
    "image": {
      "url": "/exhibits/high-trestle.jpg",
      "alt": "High Trestle Trail Bridge over the Des Moines River valley",
      "credit": "Phil Roeder, CC BY 2.0",
      "source": "https://commons.wikimedia.org/wiki/File:High_Trestle_Trail_Bridge.jpg"
    },
    "sources": [
      {
        "label": "Travel Iowa trail information",
        "url": "https://www.traveliowa.com/faq/"
      }
    ]
  },
  "ledges": {
    "id": "ledges",
    "location": "Boone County, IA",
    "image": {
      "url": "/exhibits/ledges.jpg",
      "alt": "Rock ledges and trees at Ledges State Park",
      "credit": "Rbreidbrown, CC BY-SA 4.0",
      "source": "https://commons.wikimedia.org/wiki/File:Ledges_State_Park,_Iowa,_near_the_Des_Moines_river.jpg"
    },
    "sources": [
      {
        "label": "Iowa DNR Ledges State Park",
        "url": "https://www.iowadnr.gov/places-go/state-parks/all-parks/ledges-state-park"
      }
    ]
  },
  "hoover": {
    "id": "hoover",
    "location": "West Branch, IA",
    "image": {
      "url": "/exhibits/hoover.jpg",
      "alt": "Buildings and grounds at Herbert Hoover National Historic Site",
      "credit": "National Park Service, public domain",
      "source": "https://commons.wikimedia.org/wiki/File:Views_of_Herbert_Hoover_National_Historic_Site,_Iowa_(8e123f47-a5c8-41f6-b8fc-5ed76081a8a0).jpg"
    },
    "sources": [
      {
        "label": "National Park Service",
        "url": "https://www.nps.gov/heho/index.htm"
      }
    ]
  },
  "pikes-peak": {
    "id": "pikes-peak",
    "location": "McGregor, IA",
    "image": {
      "url": "/exhibits/pikes-peak.jpg",
      "alt": "Mississippi River overlook at Pikes Peak State Park",
      "credit": "McGhiever, CC BY-SA 3.0",
      "source": "https://commons.wikimedia.org/wiki/File:PikesPeakStatePark.jpg"
    },
    "sources": [
      {
        "label": "Iowa DNR Pikes Peak State Park",
        "url": "https://www.iowadnr.gov/places-go/state-parks/all-parks/pikes-peak-state-park"
      }
    ]
  },
  "loess-hills": {
    "id": "loess-hills",
    "location": "Honey Creek, IA",
    "image": {
      "url": "/exhibits/loess-hills.jpg",
      "alt": "Ridges and prairie in Iowa's Loess Hills",
      "credit": "Wikimedia Commons contributor",
      "source": "https://commons.wikimedia.org/wiki/File:Iowa_loesshills.jpg"
    },
    "sources": [
      {
        "label": "National Park Service Hitchcock Nature Center",
        "url": "https://www.nps.gov/places/hitchcock-nature-center.htm"
      },
      {
        "label": "U.S. Geological Survey Loess Hills",
        "url": "https://www.usgs.gov/publications/geology-loess-hills-iowa"
      }
    ]
  },
  "water-works": {
    "id": "water-works",
    "location": "Des Moines, IA",
    "sources": []
  },
  "raccoon-monitor": {
    "id": "raccoon-monitor",
    "location": "Van Meter, IA",
    "sources": []
  },
  "saylorville": {
    "id": "saylorville",
    "location": "Polk County, IA",
    "sources": []
  },
  "chichaqua": {
    "id": "chichaqua",
    "location": "Polk County, IA",
    "sources": []
  },
  "neal-smith": {
    "id": "neal-smith",
    "location": "Prairie City, IA",
    "sources": []
  },
  "bear-creek": {
    "id": "bear-creek",
    "location": "Story and Hamilton counties, IA",
    "sources": [
      { "label": "USDA SARE · Published study area", "url": "https://projects.sare.org/project-reports/gnc06-061/" },
      { "label": "USDA ARS · Drainage and buffers", "url": "https://www.ars.usda.gov/research/publications/publication/?seqNo115=297411" }
    ]
  }
};

export const EXHIBITS: Exhibit[] = JOURNEY_STOPS.map((stop) => {
  const exhibit = PLACE_DETAILS[stop.id];
  const issue = ENVIRONMENTAL_ISSUES[exhibit.id];
  return {
    ...exhibit, name: issue.title, theme: issue.title,
    location: `${issue.place} · ${exhibit.location}`,
    summary: issue.problem,
    funFact: issue.impact,
    statistic: { value: "Response", label: "", detail: issue.solution },
    article: {
      intro: issue.problem, story: issue.impact, importance: issue.solution,
      lookFor: "Use the environmental layers to inspect the geographic context. Official station readings and flood maps are evidence; aerial appearance alone does not establish water quality or identify a pollution source.",
    },
    sources: [issue.source, ...exhibit.sources.filter((source) => source.url !== issue.source.url)],
  };
});

export const EXHIBIT_BY_ID = Object.fromEntries(
  EXHIBITS.map((exhibit) => [exhibit.id, exhibit]),
) as Record<string, Exhibit>;
