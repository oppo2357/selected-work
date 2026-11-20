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

export function minimumAltitude([a,b,c]) {
  const longest=Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a));
  if (longest===0) return 0;
  return new Vector3().crossVectors(new Vector3().subVectors(b,a),new Vector3().subVectors(c,a)).length()/longest;
}

export function surfaceErrors(moving, fixed, transform) {
  const sample = new Vector3();
  let sum = 0, peak = 0, index = 0;
  for (let i = 0; i < moving.length; i++) {
    const squared=sample.copy(moving[i]).applyMatrix4(transform).distanceToSquared(fixed[i]);
    sum+=squared;
    if (squared>peak){peak=squared;index=i;}
  }
  return {rms:Math.sqrt(sum/fixed.length),max:Math.sqrt(peak),index};
}
