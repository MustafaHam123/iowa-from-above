import { Cartesian3, Ellipsoid, Matrix3, Matrix4, SkyBox, Transforms } from "cesium";

const localSkyFrame = Transforms.localFrameToFixedFrameGenerator("east", "up");

/** Keep the existing sunset images and SkyBox environment pass; correct orientation only. */
export function alignSkyBoxToLocalHorizon(skyBox: SkyBox, initialPosition: Cartesian3) {
  // Cesium 1.144's SkyBox delegates to CubeMapPanorama, but doesn't expose its
  // transform. The installed implementation uses this matrix in its sky shader.
  // Our cube faces are Y-up; TEME star-map axes are not Iowa's local vertical.
  const panorama = (skyBox as SkyBox & { _panorama?: { _transform?: Matrix3 } })._panorama;
  const rotation = new Matrix3();
  const frame = new Matrix4();
  const update = (position: Cartesian3) => {
    if (!panorama || Cartesian3.magnitudeSquared(position) < 1) return;
    localSkyFrame(position, Ellipsoid.WGS84, frame);
    Matrix4.getMatrix3(frame, rotation);
    panorama._transform = rotation;
  };
  update(initialPosition);
  return update;
}
