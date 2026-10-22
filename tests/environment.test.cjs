/* eslint-disable @typescript-eslint/no-require-imports */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { getEnvironmentalData, clearEnvironmentalCache } = require('../app/api/environment/data.ts');
beforeEach(() => clearEnvironmentalCache());
const { GET } = require('../app/api/environment/route.ts');
const { nutrientColor } = require('../app/environment.ts');
const feature = (id, time, value) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [-93.6,41.6] }, properties: { monitoring_location_id: id, time, value, unit_of_measure: 'mg/l', approval_status: 'Provisional', qualifier: null } });

test('water observations use newest timestamps, preserve historical dates and exclude out-of-state stations', async (t) => {
  t.mock.method(global, 'fetch', async (url) => {
    if (url.includes('latest-continuous')) return Response.json({ features: [feature('USGS-1','2020-01-01T00:00:00Z','2'), feature('USGS-1','2021-01-01T00:00:00Z','6'), feature('USGS-2','2026-01-01T00:00:00Z','9')] });
    return Response.json({ properties: { state_code: url.includes('USGS-2') ? '17' : '19', monitoring_location_name: 'River station' } });
  });
  const data = await getEnvironmentalData('water',41.6,-93.6);
  assert.equal(data.features.length,1);
  assert.equal(data.features[0].properties.value,6);
  assert.equal(data.features[0].properties.observed,'2021-01-01T00:00:00Z');
  assert.equal(data.features[0].properties.approval,'Provisional');
});
test('missing, blank and invalid negative values never become measurements', async (t) => {
  t.mock.method(global, 'fetch', async (url) => Response.json(url.includes('latest-continuous') ? { features: [feature('USGS-1','2020-01-01',null),feature('USGS-2','2020-01-01',''),feature('USGS-3','2020-01-01','-999999')] } : { properties: { state_code:'19', monitoring_location_name:'Station' } }));
  const data=await getEnvironmentalData('water',41.6,-93.6);
  assert.deepEqual(data.features.map(f=>f.properties.value),[null,null,null]);
  assert.equal(nutrientColor(null),'#b9c2ca');
});
test('failed station metadata is identified as partial coverage', async(t)=>{
  t.mock.method(global,'fetch',async(url)=> {
    if(url.includes('latest-continuous')) return Response.json({features:[feature('USGS-1','2020-01-01','4')]});
    return new Response('',{status:503});
  });
  const data=await getEnvironmentalData('water',41.6,-93.6);
  assert.equal(data.partial,true); assert.equal(data.features.length,0);
});
test('FEMA transfer limits are disclosed and hazard classification is preserved',async(t)=>{
  t.mock.method(global,'fetch',async()=>Response.json({exceededTransferLimit:true,features:[{id:1,geometry:{type:'Polygon',coordinates:[]},properties:{OBJECTID:1,FLD_ZONE:'AE',SFHA_TF:'T'}}]}));
  const data=await getEnvironmentalData('flood',41.6,-93.6);
  assert.equal(data.partial,true); assert.equal(data.features[0].properties.classification,'AE');
  assert.match(data.features[0].properties.summary,/not current flooding/);
});
test('API rejects invalid or out-of-region inputs before fetching',async(t)=>{
  const mocked=t.mock.method(global,'fetch',()=>{throw new Error('Unexpected fetch');});
  for(const query of ['layer=flood','layer=water&lat=NaN&lng=-93','layer=flood&lat=50&lng=-93','layer=other&lat=41&lng=-93']) {
    assert.equal((await GET(new Request(`http://localhost/api/environment?${query}`))).status,400);
  }
  assert.equal(mocked.mock.callCount(),0);
});

const { containsLocation, distanceKm } = require('../app/environmentalStories.ts');
test('geographic evidence matches a containing polygon while excluding holes', () => {
  const polygon={type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[2,1],[2,2],[1,2],[1,1]]]};
  assert.equal(containsLocation(polygon,3,3),true);
  assert.equal(containsLocation(polygon,1.5,1.5),false);
  assert.equal(containsLocation(polygon,5,5),false);
  assert.equal(containsLocation({type:'MultiPolygon',coordinates:[polygon.coordinates,[[[10,10],[12,10],[12,12],[10,12],[10,10]]]]},11,11),true);
});
test('station distance uses geographic distance, including across longitude wrap', () => {
  assert.equal(distanceKm({lat:41,lng:-93},{lat:41,lng:-93}),0);
  assert.ok(Math.abs(distanceKm({lat:0,lng:0},{lat:0,lng:1})-111.195)<0.01);
  assert.ok(distanceKm({lat:0,lng:179.9},{lat:0,lng:-179.9})<23);
});

test('HTTP-200 upstream errors are retried and only successful geographic data is cached', async(t) => {
  let calls=0;
  t.mock.method(global,'fetch',async()=> { calls++; return Response.json(calls===1 ? {error:{message:'Temporary service failure'}} : {features:[]}); });
  await assert.rejects(getEnvironmentalData('flood',41.6,-93.6));
  assert.equal((await getEnvironmentalData('flood',41.6,-93.6)).features.length,0);
  await getEnvironmentalData('flood',41.6,-93.6);
  assert.equal(calls,2);
});

test('Avery reserves answer tokens and returns only the visible environmental explanation',async(t)=>{
  const previous=process.env.IOWA_API_KEY;process.env.IOWA_API_KEY='test-key';
  t.after(()=>{if(previous===undefined)delete process.env.IOWA_API_KEY;else process.env.IOWA_API_KEY=previous;});
  let requestBody;
  t.mock.method(global,'fetch',async(url,options)=>{
    assert.equal(url,'https://api.groq.com/openai/v1/responses');requestBody=JSON.parse(options.body);
    return Response.json({output:[{type:'reasoning',content:[{type:'reasoning_text',text:'Internal reasoning'}]},{type:'message',content:[{type:'output_text',text:'Rain gardens can collect runoff and let water soak into suitable soil.'}]}]});
  });
  const { POST }=require('../app/api/landmark-chat/route.ts');
  const result=await POST(new Request('http://localhost/api/landmark-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exhibitId:'water-works',question:'What could help here?'})}));
  assert.equal(result.status,200);assert.equal((await result.json()).answer,'Rain gardens can collect runoff and let water soak into suitable soil.');
  assert.equal(requestBody.reasoning.effort,'low');assert.ok(requestBody.max_output_tokens>=1024);
  assert.match(requestBody.instructions,/Drinking Water/);
  assert.match(requestBody.instructions,/No field observations/);
});
