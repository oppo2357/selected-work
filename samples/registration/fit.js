import {Matrix4, Vector3} from 'three';

// A labeled triplet establishes a right-handed local coordinate frame.
// The first two picks set the axis. The third sets its plane.
function landmarkFrame([origin, second, third]) {
  const x = new Vector3().subVectors(second, origin);
  const yHint = new Vector3().subVectors(third, origin);
  const z = new Vector3().crossVectors(x, yHint);
  if (x.lengthSq() < 1e-12 || z.lengthSq() < 1e-12) throw Error('Landmarks must define a plane.');
  x.normalize();
  z.normalize();
  const y = new Vector3().crossVectors(z, x);
  return new Matrix4().makeBasis(x,y,z).setPosition(origin);
}

export function fitLandmarks(moving, fixed) {
  return landmarkFrame(fixed).multiply(landmarkFrame(moving).invert());
}

export function surfaceRms(moving, fixed, transform) {
  const sample = new Vector3();
  let sum = 0;
  for (let i = 0; i < moving.length; i++) {
    sum += sample.copy(moving[i]).applyMatrix4(transform).distanceToSquared(fixed[i]);
  }
  return Math.sqrt(sum / fixed.length);
}
