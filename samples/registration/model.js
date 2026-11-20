import {BufferGeometry, Float32BufferAttribute, Vector3} from 'three';

// Each crown has a rounded rectangular rim and an occlusal surface built from
// unequal cusp hills, an oblique groove and a tapered neck. Units are mm.
const crowns = [
  {x:-8.6, z:1.4, width:3.8, depth:4.7, turn:-.19, cusps:[1.5,1.15,1.02,.85]},
  {x:0, z:0, width:4.8, depth:5.05, turn:-.015, cusps:[1.65,1.25,1.5,1.02]},
  {x:9.55, z:.85, width:4.5, depth:4.8, turn:.16, cusps:[1.22,1.5,1.08,1.34]}
];
const cuspCenters=[[-.44,-.43],[.48,-.4],[-.45,.42],[.4,.4]];
const count=80, segments=26;
const point=(v)=>Math.sign(v)*Math.pow(Math.abs(v),.67);

function sample(c, level, angle) {
  const baseX=point(Math.cos(angle)), baseZ=point(Math.sin(angle));
  let radius,height;
  if (level <= .42) {
    const p=level/.42;
    radius=.72+.28*Math.sin(p*Math.PI/2);
    height=-3.5+4.6*p;
  } else {
    const p=(level-.42)/.58;
    radius=1-p;
    height=1.1+.65*Math.sin(p*Math.PI/2);
  }
  const nx=baseX*radius, nz=baseZ*radius;
  const blend=Math.min(1,Math.max(0,(level-.42)/.17));
  for(let i=0;i<cuspCenters.length;i++){
    const [cx,cz]=cuspCenters[i];
    height+=blend*1.24*c.cusps[i]*Math.exp(-((nx-cx)**2/.105+(nz-cz)**2/.15));
  }
  const fissure=nz-.15*Math.sin(3.8*nx);
  height-=blend*(.56*Math.exp(-fissure*fissure/.012)*Math.exp(-nx*nx/.65)
    +.24*Math.exp(-((nx+.16*nz)**2)/.018)*Math.exp(-nz*nz/.4));
  const fluting=1+.024*Math.cos(5*angle+c.turn)*Math.min(1,radius)**3;
  const x=nx*c.width*fluting, z=nz*c.depth*fluting;
  return new Vector3(c.x+x*Math.cos(c.turn)-z*Math.sin(c.turn),height,c.z+x*Math.sin(c.turn)+z*Math.cos(c.turn));
}

export function makeSegment(){
  const vertices=[],indices=[], lines=[];
  for(const c of crowns){
    const offset=vertices.length;
    for(let j=0;j<segments;j++){
      for(let i=0;i<count;i++) vertices.push(sample(c,j/segments,2*Math.PI*i/count));
    }
    for(let j=0;j<segments-1;j++){
      for(let i=0;i<count;i++){
        const a=offset+j*count+i,b=offset+j*count+(i+1)%count;
        indices.push(a,a+count,b, b,a+count,b+count);
      }
    }
    const top=vertices.push(sample(c,1,0))-1;
    const base=vertices.push(new Vector3(c.x,-3.5,c.z))-1;
    for(let i=0;i<count;i++){
      const next=(i+1)%count;
      indices.push(offset+(segments-1)*count+i,top,offset+(segments-1)*count+next,offset+i,offset+next,base);
    }
    for(const level of [.02,.22,.42,.49,.57,.67,.78,.9]){
      lines.push(Array.from({length:count+1},(_,i)=>sample(c,level,2*Math.PI*i/count)));
    }
    for(let i=0;i<12;i++){
      lines.push(Array.from({length:segments+1},(_,j)=>sample(c,j/segments,i*Math.PI/6)));
    }
  }
  const geo=new BufferGeometry();
  geo.setAttribute('position',new Float32BufferAttribute(vertices.flatMap(v=>v.toArray()),3));
  geo.setIndex(indices); geo.computeVertexNormals();
  const picks=[sample(crowns[0],.7,4.1),sample(crowns[2],.68,5.1),sample(crowns[1],.53,1.7)];
  return {geo,vertices,picks,lines};
}
