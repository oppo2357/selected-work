const parts = new Map(Object.entries({
  nose: 'Front body and windscreen', tail: 'Rear doors and bumper',
  'cab-left': 'Left cab door', 'cab-right': 'Right cab door',
  'cargo-left': 'Left cargo panel', 'cargo-right': 'Right cargo panel', roof: 'Roof',
  'wheel-lf': 'Left front wheel', 'wheel-rf': 'Right front wheel',
  'wheel-lr': 'Left rear wheel', 'wheel-rr': 'Right rear wheel',
}));
const $ = id => document.getElementById(id);
const storageKey = 'courier-walkaround-v1';
let sheet = Object.create(null);
let part = 'nose';
let paintSelection = () => {};
const conditions = new Map([['ok', 'OK'], ['attention', 'Needs attention']]);
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  for (const key of parts.keys()) {
    const row = saved?.[key];
    if (row && (row.condition === '' || conditions.has(row.condition)) && typeof row.note === 'string') {
      sheet[key] = {condition: row.condition, note: row.note.slice(0, 600)};
    }
  }
} catch { $('storage').textContent = 'Local saving is unavailable. Export to keep your inspection.'; }
for (const [key, label] of parts) $('part').add(new Option(label, key));
function selectPart(key) {
  if (!parts.has(key)) return;
  part = key;
  $('part').value = key;
  const row = sheet[key] || {condition: '', note: ''};
  $('note').value = row.note;
  for (const button of document.querySelectorAll('[data-condition]')) {
    button.setAttribute('aria-pressed', String(row.condition === button.dataset.condition));
  }
  const checked = Object.values(sheet).filter(value => value.condition).length;
  $('progress').textContent = checked + ' of ' + parts.size + ' parts recorded';
  $('meter').value = checked;
  $('clear').disabled = !row.condition && !row.note;
  paintSelection(key);
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(sheet)); }
  catch { $('storage').textContent = 'Local saving is unavailable. Export to keep your inspection.'; }
}
$('part').onchange = event => selectPart(event.target.value);
for (const button of document.querySelectorAll('[data-condition]')) {
  button.onclick = () => {
    sheet[part] = {condition: button.dataset.condition, note: $('note').value};
    save(); selectPart(part);
  };
}
$('note').oninput = () => {
  sheet[part] = {condition: sheet[part]?.condition || '', note: $('note').value};
  $('clear').disabled = !sheet[part].condition && !sheet[part].note; save();
};
$('clear').onclick = () => { delete sheet[part]; save(); selectPart(part); };
$('export').onclick = () => {
  const data = {schemaVersion: 1, vehicle: 'courier-van', parts: Array.from(parts, ([id, label]) =>
    ({id, label, condition: sheet[id]?.condition || 'unreviewed', note: sheet[id]?.note || ''}))};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'courier-inspection.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
selectPart(part);

async function start() {
  const canvas = $('vehicle');
  const app = new pc.Application(canvas, {graphicsDeviceOptions: {alpha: false, antialias: true, powerPreference: 'low-power'}});
  app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  app.scene.ambientLight = new pc.Color(.63, .64, .65);
  app.autoRender = false;
  const camera = new pc.Entity('Inspection camera');
  camera.addComponent('camera', {clearColor: new pc.Color(.76,.77,.75), fov: 37, nearClip: .1, farClip: 70});
  app.root.addChild(camera);
  const target = new pc.Vec3(0,.88,0);
  let yaw = .86, pitch = .30;
  function pose() {
    const ratio = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const radius = Math.max(5.8, 6.55 / ratio);
    const horizontal = radius * Math.cos(pitch);
    camera.setPosition(horizontal*Math.sin(yaw), target.y+radius*Math.sin(pitch), horizontal*Math.cos(yaw));
    camera.lookAt(target); app.renderNextFrame = true;
  }
  function resize() {
    app.graphicsDevice.resizeCanvas(canvas.clientWidth, canvas.clientHeight); pose();
  }
  new ResizeObserver(resize).observe(canvas);
  function illuminate(name, rotation, color, intensity, shadows) {
    const light = new pc.Entity(name);
    light.addComponent('light', {type:'directional', color, intensity, castShadows:shadows, shadowDistance:13,
      shadowResolution:2048, shadowBias:.18, normalOffsetBias:.02});
    light.setEulerAngles(...rotation); app.root.addChild(light);
  }
  illuminate('Overhead key', [-72,-26,0], new pc.Color(1,.97,.91), 1.40, false);
  illuminate('Front fill', [-25,28,0], new pc.Color(.92,.96,1), .95, false);
  illuminate('Roof edge', [-32,154,0], new pc.Color(1,.92,.82), .65, false);
  const floor = new pc.Entity('Studio floor');
  const surface = new pc.StandardMaterial(); surface.diffuse = new pc.Color(.70,.71,.70);
  surface.gloss = .08; surface.update();
  floor.addComponent('render', {type:'plane', castShadows:false, receiveShadows:true, material:surface});
  floor.setLocalScale(100,1,100); floor.setPosition(0,-.006,0); app.root.addChild(floor);
  const contactMap=document.createElement('canvas'); contactMap.width=256;contactMap.height=512;
  const ctx=contactMap.getContext('2d');
  function shade(x,y,w,h,opacity){
    ctx.save();ctx.translate(x,y);ctx.scale(w,h);
    const g=ctx.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,'rgba(36,39,38,'+opacity+')');g.addColorStop(.55,'rgba(36,39,38,'+(opacity*.58)+')');g.addColorStop(1,'rgba(36,39,38,0)');
    ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  shade(128,256,115,227,.68);
  for(const x of [66,190])for(const y of [135,376])shade(x,y,23,27,.67);
  const texture=new pc.Texture(app.graphicsDevice,{format:pc.PIXELFORMAT_R8_G8_B8_A8,mipmaps:true});texture.setSource(contactMap);
  const shadowMaterial=new pc.StandardMaterial();shadowMaterial.useLighting=false;
  shadowMaterial.emissive=new pc.Color(1,1,1);shadowMaterial.emissiveMap=texture;
  shadowMaterial.opacityMap=texture;shadowMaterial.opacityMapChannel='a';shadowMaterial.blendType=pc.BLEND_NORMAL;shadowMaterial.depthWrite=false;shadowMaterial.update();
  const contact=new pc.Entity('Contact shadow');contact.addComponent('render',{type:'plane',castShadows:false,receiveShadows:false,material:shadowMaterial});
  contact.setLocalScale(3.15,1,5.1);contact.setPosition(0,-.003,0);app.root.addChild(contact);
  const asset = await new Promise((resolve,reject) => app.assets.loadFromUrl('courier.glb','container',
    (error, loaded) => error ? reject(error) : resolve(loaded)));
  const van = asset.resource.instantiateRenderEntity(); app.root.addChild(van);
  const highlighted = new Map(), meshes = [];
  for (const [key] of parts) {
    const group = van.findByName(key);
    if (!group) throw Error('Missing part '+key);
    for (const render of group.findComponents('render')) {
      for (const instance of render.meshInstances) {
        const material = instance.material;
        if (!highlighted.has(material)) {
          const tint = material.clone();
          tint.diffuse.lerp(material.diffuse,new pc.Color(.76,.82,.73),.10);
          tint.emissive = new pc.Color(.022,.035,.028); tint.update(); highlighted.set(material,tint);
        }
        const positions = [], indices = [];
        instance.mesh.getPositions(positions); instance.mesh.getIndices(indices);
        const transform = instance.node.getWorldTransform();
        const vertices = [];
        for (let i=0; i<positions.length; i+=3) vertices.push(transform.transformPoint(new pc.Vec3(...positions.slice(i,i+3))));
        meshes.push({key, instance, material, vertices, indices});
      }
    }
  }
  paintSelection = key => {
    for (const m of meshes) m.instance.material = key === m.key ? highlighted.get(m.material) : m.material;
    app.renderNextFrame = true;
  };
  function pick(x,y) {
    const rect = canvas.getBoundingClientRect();
    const localX = x-rect.left, localY = y-rect.top;
    const from = camera.camera.screenToWorld(localX,localY,.1);
    const to = camera.camera.screenToWorld(localX,localY,60);
    const ray = new pc.Ray(from,to.sub(from).normalize());
    let nearest = Infinity, winner = null;
    const edge1 = new pc.Vec3(), edge2 = new pc.Vec3(), across = new pc.Vec3();
    const offset = new pc.Vec3(), perpendicular = new pc.Vec3();
    function hitDistance(a,b,c) {
      edge1.sub2(b,a); edge2.sub2(c,a); across.cross(ray.direction,edge2);
      const det=edge1.dot(across);
      if (Math.abs(det)<1e-9) return Infinity;
      offset.sub2(ray.origin,a);
      const u=offset.dot(across)/det;
      if (u<0 || u>1) return Infinity;
      perpendicular.cross(offset,edge1);
      const v=ray.direction.dot(perpendicular)/det;
      if (v<0 || u+v>1) return Infinity;
      const distance=edge2.dot(perpendicular)/det;
      return distance>=0 ? distance : Infinity;
    }
    for (const {key, instance, vertices, indices} of meshes) {
      if (!instance.aabb.intersectsRay(ray)) continue;
      const length = indices.length || vertices.length;
      for (let i=0; i<length; i+=3) {
        const vertex = k => vertices[indices.length ? indices[k] : k];
        const distance=hitDistance(vertex(i),vertex(i+1),vertex(i+2));
        if (distance < nearest) { nearest = distance; winner = key; }
      }
    }
    if (winner) selectPart(winner);
  }
  let drag;
  canvas.onpointerdown = e => {
    if (drag || e.button !== 0) return;
    drag = {id:e.pointerId,x:e.clientX,y:e.clientY,yaw,pitch,moved:false}; canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if (Math.abs(dx)+Math.abs(dy)>5) drag.moved=true;
    if (drag.moved) { yaw=drag.yaw-dx*.009; pitch=Math.max(.07,Math.min(1.19,drag.pitch+dy*.006)); pose(); }
  };
  canvas.onpointerup = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const tap = !drag.moved; drag=null;
    if (tap) pick(e.clientX,e.clientY);
  };
  canvas.onlostpointercapture = canvas.onpointercancel = () => { drag=null; };
  canvas.onkeydown = e => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    if (e.key==='ArrowLeft') yaw-=.16;
    if (e.key==='ArrowRight') yaw+=.16;
    if (e.key==='ArrowUp') pitch=Math.min(1.19,pitch+.12);
    if (e.key==='ArrowDown') pitch=Math.max(.07,pitch-.12);
    pose();
  };
  $('front').onclick = () => { yaw=.08; pitch=.20; pose(); };
  $('rear').onclick = () => { yaw=Math.PI-.08; pitch=.20; pose(); };
  $('reset-view').onclick = () => { yaw=.86; pitch=.30; pose(); };
  selectPart(part); resize(); app.start();
  $('model-status').textContent=''; canvas.dataset.ready='true';
}
start().catch(err => {
  console.error(err); $('model-status').textContent='3D view unavailable. Use the part menu to complete the sheet.';
  for (const id of ['front','rear','reset-view']) $(id).disabled=true;
});
