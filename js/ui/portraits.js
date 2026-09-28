// Circular species portraits and avatar previews rendered from the 3D models
// with a small offscreen renderer; cached as data URLs.
(function (ZG) {
  const T = THREE;
  const P = (ZG.Portraits = {});
  const cache = new Map();
  let r = null, scene = null, cam = null;

  function setup() {
    if (r) return true;
    try {
      const c = document.createElement('canvas');
      r = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      return false;
    }
    r.setSize(256, 256, false);
    r.outputEncoding = T.LinearEncoding;
    scene = new T.Scene();
    scene.add(new T.HemisphereLight('#ffffff', '#6b7a55', 0.7));
    const d = new T.DirectionalLight('#fff6e6', 0.85);
    d.position.set(3, 5, 6);
    scene.add(d);
    cam = new T.PerspectiveCamera(30, 1, 0.05, 100);
    return true;
  }

  function shoot(obj, target, radius, dir, bg) {
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const dist = radius / Math.tan((cam.fov * Math.PI) / 360);
    cam.position.set(target.x + dir.x * dist, target.y + dir.y * dist, target.z + dir.z * dist);
    cam.lookAt(target);
    scene.background = bg ? new T.Color(bg) : null;
    r.render(scene, cam);
    scene.remove(obj);
    return r.domElement.toDataURL('image/png');
  }

  // Head-and-shoulders portrait of a species (like a field-guide roundel).
  P.species = function (spId) {
    if (cache.has(spId)) return cache.get(spId);
    if (!setup()) return '';
    const m = ZG.Models.animal(spId, 'M', false);
    m.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(m.root);
    const size = box.getSize(new T.Vector3());
    const center = box.getCenter(new T.Vector3());
    const head = new T.Vector3();
    m.head.getWorldPosition(head);
    const small = Math.max(size.x, size.y, size.z) < 1.3;
    const target = head.clone().lerp(center, small ? 0.6 : 0.35);
    const radius = Math.max(0.28, small ? Math.max(size.y, size.z) * 0.62 : Math.max(size.y * 0.42, head.distanceTo(center) * 0.75, 0.45));
    const dir = new T.Vector3(0.62, 0.22, 0.75).normalize();
    const url = shoot(m.root, target, radius, dir, '#d9eee2');
    cache.set(spId, url);
    return url;
  };

  P.avatar = function (look) {
    if (!setup()) return '';
    const a = ZG.Models.avatar(look);
    return shoot(a.root, new T.Vector3(0, 1.15, 0), 1.2, new T.Vector3(0.35, 0.12, 1).normalize(), null);
  };

  // <img> helper with fallback emoji
  P.img = function (spId, cls) {
    const url = P.species(spId);
    const sp = ZG.SPECIES[spId];
    return url ? `<img class="${cls || 'portrait'}" src="${url}" alt="${sp.name}">` : `<span class="${cls || 'portrait'} emo">${sp.emoji}</span>`;
  };
})((globalThis.ZG = globalThis.ZG || {}));
