/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const C=require('cesium');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {alignSkyBoxToLocalHorizon}=require('../app/skyOrientation.ts');

test('sunset Y-up follows Iowa local vertical while preserving the existing SkyBox and source faces',()=>{
  const sources=Object.fromEntries(['positiveX','negativeX','positiveY','negativeY','positiveZ','negativeZ'].map(name=>[name,`${name}.jpg`]));
  const sky=new C.SkyBox({sources});
  const originalPanorama=sky._panorama;
  const update=alignSkyBoxToLocalHorizon(sky,C.Cartesian3.fromDegrees(-93.6091,41.590364));
  const transform=originalPanorama.transform;
  for(const [lng,lat] of [[-93.6091,41.590364],[-91.1666,42.9955],[-95.8536,41.4217]]){
    const position=C.Cartesian3.fromDegrees(lng,lat);
    update(position);
    const actualUp=C.Matrix3.multiplyByVector(transform,C.Cartesian3.UNIT_Y,new C.Cartesian3());
    const expectedUp=C.Ellipsoid.WGS84.geodeticSurfaceNormal(position);
    assert.ok(C.Cartesian3.equalsEpsilon(actualUp,expectedUp,1e-12));
    assert.ok(Math.abs(C.Matrix3.determinant(transform)-1)<1e-12);
  }
  assert.equal(sky.sources,sources);
  assert.equal(sky._panorama,originalPanorama);
  assert.equal(originalPanorama.transform,transform);
  assert.equal(originalPanorama._returnCommand,true,'preserve the SkyBox environment render path');
  sky.destroy();
});

test('sky orientation tolerates a future implementation without the installed adapter',()=>{
  const sky={sources:{},show:true};
  assert.doesNotThrow(()=>alignSkyBoxToLocalHorizon(sky,C.Cartesian3.fromDegrees(-93,42))(C.Cartesian3.ZERO));
});
