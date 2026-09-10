/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
};

const {
  clampToRadius,
  FLIGHT_BOUNDARY_RADIUS_METERS,
} = require("../app/flightBoundaries.ts");

test("flight boundary preserves positions inside the objective radius", () => {
  const position = { lat: 41.6, lng: -93.6 };

  assert.equal(
    clampToRadius(position, { lat: 41.59, lng: -93.61 }, 6_000),
    position,
  );
});

test("flight boundary clamps distant positions to the objective radius", () => {
  const center = { lat: 41.59, lng: -93.61 };
  const constrained = clampToRadius(
    { lat: 42.5, lng: -92.2 },
    center,
    FLIGHT_BOUNDARY_RADIUS_METERS,
  );
  const northMeters = (constrained.lat - center.lat) * 111_320;
  const eastMeters =
    (constrained.lng - center.lng) *
    111_320 *
    Math.cos((center.lat * Math.PI) / 180);

  assert.ok(
    Math.abs(Math.hypot(northMeters, eastMeters) - 6_000) < 0.001,
  );
});
