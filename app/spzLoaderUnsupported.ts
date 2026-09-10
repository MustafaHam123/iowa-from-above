/**
 * Iowa From Above only loads GLB models. Cesium's optional SPZ decoder embeds
 * a WebAssembly binary that Webpack currently minifies into invalid JavaScript.
 * Keep the unused decoder out of the browser bundle while retaining a clear
 * failure if an SPZ asset is ever added later.
 */
export async function loadSpz(): Promise<never> {
  throw new Error("SPZ models are not supported by Iowa From Above.");
}
