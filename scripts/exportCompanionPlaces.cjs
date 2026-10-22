// Export the same sourced places used by the website to the native app bundle.
// Usage: node scripts/exportCompanionPlaces.cjs /path/to/fromabove/Resources/places.json
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const output = process.argv[2];
if (!output) throw new Error('Pass the native Resources/places.json output path.');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { JOURNEY_STOPS } = require('../app/journeyStops.ts');
const { EXHIBIT_BY_ID } = require('../app/exhibits.ts');
const { ENVIRONMENTAL_ISSUES } = require('../app/environmentalJourney.ts');
const { ENVIRONMENTAL_STORIES } = require('../app/environmentalStories.ts');
const places = JOURNEY_STOPS.map((stop) => {
  const exhibit = EXHIBIT_BY_ID[stop.id], issue = ENVIRONMENTAL_ISSUES[stop.id], story = ENVIRONMENTAL_STORIES[stop.id];
  return {
    id: stop.id, name: issue.place, issue: issue.title, kind: issue.layer,
    latitude: stop.lat, longitude: stop.lng, problem: issue.problem, impact: issue.impact,
    solution: issue.solution, people: story.people, signal: story.signal,
    responses: story.responses, sources: exhibit.sources,
    image: exhibit.image ? { asset: stop.id, credit: exhibit.image.credit, url: exhibit.image.source } : null,
  };
});
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(places, null, 2)}\n`);
process.stdout.write(`Exported ${places.length} shared places.\n`);
