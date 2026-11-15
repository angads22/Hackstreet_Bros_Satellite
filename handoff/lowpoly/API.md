# LowPoly engine: API and conventions

File: `js/lowpoly.js`. Plain ES5, one global `LowPoly`, no `import`, no `fetch`, no libraries, works from `file://`.
Load order: `lowpoly.js` first, then the model files, each wrapped in an IIFE that extends `LowPoly.models` / `LowPoly.scenes` and creates no globals.

The renderer is a software rasteriser into an `ImageData` on a 2D canvas (depth buffer, flat shading, back-face culling, optional supersampling). The output is identical on every machine.

## 1. Conventions (read these first, every model file depends on them)

| Topic | Rule |
| --- | --- |
| Coordinates | Right-handed, **+Y up**, +X right, +Z toward the viewer at `yaw 0`. Units are free; parts are authored around 0.1 to 5 units. |
| Triangle | `{v:[[x,y,z],[x,y,z],[x,y,z]], c:"colorName or #rrggbb", e:0 or 1}`. `e:1` = emissive: drawn at full brightness, ignores light. |
| Winding | **Counter-clockwise seen from outside is the front face.** Back faces are culled. A "double-sided" quad is simply both windings (4 triangles), so there is no extra field. |
| Mesh | `{tris:[...]}`. Plain data. Every builder returns a **new** mesh and never changes its input. Treat meshes as immutable. |
| Builder origin | Every solid builder is **centred on the origin** (box, cylinder, cone, sphere, prism and torus are symmetric about it; cylinder, cone and prism run from `-h/2` to `+h/2` along Y). `disc` lies in the XZ plane at `y=0` facing +Y. `quad` is exactly where you put its points. Use `LowPoly.base(mesh)` to stand a mesh on `y=0`, `LowPoly.center(mesh)` to centre it. |
| Rotation | Degrees, right-handed. `LowPoly.rotate(mesh,rx,ry,rz)` and `item.rot` use the **same** matrix: rotate about X first, then Y, then Z, all about the fixed world axes (`v' = Rz * Ry * Rx * v`). `+90` about Y takes +Z to +X. `+90` about X takes +Y to +Z. `+90` about Z takes +X to +Y. |
| Item transform | `scale` first (about the mesh origin), then `rot`, then `pos`. Negative scale mirrors and the winding is repaired automatically. |
| Part frame | Attachment point at the origin, extends **outward along +Y**; any face that must look somewhere looks along **+Z**. `size` is the bounding box `[x,y,z]`. |
| Body frame | Centred on the origin, Y is the body axis: nadir (toward Earth) = `-Y`, zenith = `+Y`, aft = `+Z`. |
| Light | `light.dir` is the direction **toward the light** (where the sun is). `[0,1,0]` lights top faces. In world space unless `light.space:"camera"`. Shading: `colour * (ambient * hemi + key * max(0, n.l))`, clamped. |
| Camera | `yaw 0, pitch 0` looks from +Z toward -Z, so the **+Z face is what you see**. Positive yaw moves the camera toward +X (model seems to turn clockwise seen from above). Positive pitch lifts the camera (you see top faces). Orbits `target`. |
| Dragging | Drag right: the front of the model moves right (`yaw` decreases). Drag down: the top tips toward you (`pitch` increases). Arrow keys follow the same rule. `spin > 0` turns the model counter-clockwise seen from above (`yaw` decreases). |
| `place` | `LowPoly.place(mesh,{pos,normal,roll})`: shortest rotation taking +Y to `normal`, then `roll` degrees about `normal` (right-handed), then move to `pos`. `normal` need not be unit length (a zero vector means +Y). A `normal` of exactly `[0,-1,0]` is turned **180 degrees about Z** (so +Z stays +Z and +X becomes -X). No NaN for any input. |
| Decals | Faces that are exactly coplanar (stripes, cells, LEDs on a face) resolve by draw order: the **later** triangle wins when it is within 0.003 % of the viewing distance of the earlier one (relative depth tolerance `3e-5`). So list the decal **after** the base in `merge([...])` (or draw it in a later item). An offset larger than that (0.003 % of the viewing distance, e.g. 0.002 units at distance 50) also works in any order. No shimmer when spinning. |
| Unknown ids | Registries are plain objects: `LowPoly.models.part.nope` is `undefined`. Use `LowPoly.model(kind,id,arg)` for a lookup that never throws, or `LowPoly.has(kind,id)`. |

## 2. Palette

Names are fixed. Default values below. At render time each name is overridden by the CSS custom property `--lp-<name>` (on the canvas or any ancestor, e.g. `:root{--lp-gold:#d4a017}`) when the page defines it. Anywhere a colour is expected you may also pass `"#rrggbb"`. An unknown name logs one warning and draws `steel`.

Direction: realistic mid-saturation space hardware, a little desaturated, warm key light over cool shadow. No neon, no purple or pink, no gradients.

| | | | |
| --- | --- | --- | --- |
| `white` #e6e4dc | `cream` #d8cba8 | `silver` #aeb4ba | `steel` #7d8791 |
| `graphite` #444a52 | `black` #1c1f24 | `gold` #c79a3e | `copper` #b1704a |
| `cell` #22365a | `cellEdge` #4d6a92 | `red` #b24231 | `orange` #cc7a2e |
| `yellow` #d1ac3a | `teal` #2e8a86 | `green` #5a8a4c | `glow` #f6c775 (emissive) |
| `glowCool` #9fd6ec (emissive) | `sea` #2b5f8a | `land` #70854f | `sand` #c3a874 |
| `ice` #dde8ee | `cloud` #f2f4f5 | `skin1` #e2b595 | `skin2` #b9825a |
| `skin3` #7b4f34 | `hair1` #2b2119 | `hair2` #7d5230 | `hair3` #b9a57c |
| `shirt1` #587a9a | `shirt2` #6b8a6a | `shirt3` #9c8366 | `tie` #8b3030 |
| `ground` #6c6a5f | `concrete` #9b9a92 | `grass` #5d7a40 | `metalDark` #555c65 |
| `sky` #8db3cf | `space` #0b0f16 | `star` #e3e8ee | |

39 names. `LowPoly.palette` is the live object (name to `#rrggbb`). `LowPoly.colorOf(name, el)` returns the final `#rrggbb` including a CSS override on `el` (default: the page).

Default light: `dir [-0.45,0.8,0.6]`, `key #c0b498` (warm), `ambient #5f6d85` (cool), `steps 0`.

## 3. Builders (all return a new mesh)

All colour arguments `c` are palette names or `#rrggbb`. A missing colour is `silver`.

| Call | Notes |
| --- | --- |
| `LowPoly.box(w,h,d,c)` | 12 triangles. |
| `LowPoly.cylinder(rTop,rBottom,h,sides,c,{capTop:true,capBottom:true,phase:0})` | `sides` 3 and up (default 8). Radii may differ (a frustum) or be 0 (a cone). `phase` rotates the facets in degrees (`sides:4, phase:45` gives a square aligned to the axes). Triangles: `2*sides` side + `sides` per cap. |
| `LowPoly.cone(r,h,sides,c)` | Apex at +Y, base cap on -Y. |
| `LowPoly.sphere(r,detail,c)` | Icosphere with a vertex on each pole. `detail` 0..3 = 20, 80, 320, 1280 triangles. |
| `LowPoly.prism(points2d,h,c)` | Extrude a polygon given as `[[x,z],...]` in the XZ plane along Y, from `-h/2` to `h/2`. Either orientation, concave allowed (ear clipping). Caps included. |
| `LowPoly.quad(p0,p1,p2,p3,c,doubleSided)` | Counter-clockwise `p0..p3` seen from the front. |
| `LowPoly.disc(r,sides,c,doubleSided)` | Flat, in XZ at `y=0`, faces +Y. |
| `LowPoly.torus(R,r,segments,sides,c)` | In the XZ plane, axis Y. `R` big radius, `r` tube radius. |
| `LowPoly.lathe(profile,sides,c,doubleSided)` | Extra. Revolve `[[radius,y],...]` around Y. Walk the profile **bottom to top** and faces point away from the axis. Use it for dishes, nozzle bells, domes, fairings. `doubleSided:true` for thin shells (a dish). A radius of 0 closes at the axis. |
| `LowPoly.merge([meshes])` | Concatenate (copies). Order is draw order for coplanar decals. |
| `LowPoly.move(mesh,x,y,z)` | |
| `LowPoly.rotate(mesh,rx,ry,rz)` | See conventions. |
| `LowPoly.scale(mesh,sx,sy,sz)` | `sy`, `sz` default to `sx`. Negative values mirror (winding fixed). |
| `LowPoly.mirror(mesh,axis)` | Extra. `axis` `"x"` (default), `"y"` or `"z"`. |
| `LowPoly.recolor(mesh,c)` | All triangles to `c`. |
| `LowPoly.emit(mesh,on)` | `e:1` on all triangles (`on:false` clears it). |
| `LowPoly.place(mesh,{pos,normal,roll})` | See conventions. |
| `LowPoly.base(mesh)` | Extra. Move so the lowest point is `y=0`. |
| `LowPoly.center(mesh)` | Extra. Move the bounding-box centre to the origin. |
| `LowPoly.bounds(mesh)` | `{min,max,size,center}` (all `[x,y,z]`). Empty mesh gives zeros. |
| `LowPoly.jitter(mesh,amount,seed)` | Seeded wobble of every vertex by up to `amount` per axis. Vertices at the same position (to 1e-5) move together, so no cracks. The same position and seed give the same wobble in different meshes. |
| `LowPoly.count(mesh)` | Triangle count. |
| `LowPoly.rng(seed)` | Extra. Seeded random function returning `[0,1)`. |
| `LowPoly.rotationMatrix(rx,ry,rz)` | Extra. Row-major 9 numbers, same matrix as `rotate`. |

Registry helpers: `LowPoly.fallback(kind)` (`"body"`, `"part"`, `"launcher"`, `"person"`, `"scene"`), `LowPoly.model(kind,id,arg)`, `LowPoly.has(kind,id)`.

## 4. Rendering

### `LowPoly.render(canvas, scene, opts)` draws one frame, returns `{width,height,ss,tris,ms,cssWidth,cssHeight}` or `null` (no 2D context, or a canvas with no size: never throws)

```
scene = {
  items:  [ {mesh, pos:[x,y,z], rot:[rx,ry,rz] degrees, scale:number|[sx,sy,sz], hidden:bool, alpha:0..1} ],
  camera: {yaw, pitch, dist, target:[x,y,z], fov:35}      // or {ortho:true, size, yaw, pitch, dist, target}
  light:  {dir:[x,y,z], key:"#rrggbb", ambient:"#rrggbb", steps:0, space:"world", hemi:0.25},
  background: null | {color:"name", stars:true|false, seed:n},
  label:  "text for aria-label"
}
```

Every field is optional.
- `camera`: defaults `yaw 25`, `pitch 15`, `fov 35` (vertical, degrees). `dist` and `target` missing means **auto-fit** the whole scene (target = centre of the bounding box). `ortho:true` uses `size` = vertical world extent (auto-fit if missing); anything behind the eye plane is clipped, so keep `dist` bigger than the scene.
- `light.steps`: `0` = smooth flat shading (default); `3..8` = banded (that many light levels).
- `light.space:"camera"` fixes the light to the camera (dir x = right, y = up, z = toward the viewer), `"world"` (default) fixes it to the world.
- `items[i].alpha < 1`: drawn after all opaque items, far to near (sorted by the view depth of the centre of each item's bounding box), blended, depth tested but no depth write. `alpha 0` draws nothing. Within one item triangles are blended in mesh order, so keep translucent items simple (one pane, one shell).
- `background`: `null` = transparent canvas (the page shows through). `{color,stars,seed}` fills with a palette colour. Stars are deterministic from `seed` and use screen-relative positions (resizing does not reshuffle them). A string means a colour name.
- Intersecting meshes are correct (depth buffer). Triangles crossing the camera plane are clipped.

`opts`: `width`, `height` (logical CSS pixels, default = the canvas layout size), `pixelRatio` (default `min(devicePixelRatio, 2)`), `quality` (`"auto"` default, `"low"`, `"high"`), `ss` (force a supersample factor 1..4), `maxPixels` (default 600000), `label`.

**Canvas sizing and the pixel budget.** Size the canvas with CSS (`width:480px;height:360px`, or `width:100%;height:auto` with width/height attributes giving the aspect). The engine sets the backing store itself:
1. Logical size = layout size (`clientWidth` x `clientHeight`). A canvas with no layout (`display:none`, 0x0) draws nothing and does not throw. A detached canvas draws at its own width/height.
2. Backing store = logical x `min(devicePixelRatio, 2)`, scaled down if needed so it never exceeds **600 000 pixels**. DPR 3 is treated as 2. So a 480x360 canvas is 480x360 at DPR 1 (drawn 2x supersampled, then averaged down) but 894x670 at DPR 2 (960x720 would be 691k), which the browser shows at 0.93 of device resolution with no supersampling: edges are slightly soft and a little stair-stepped when magnified. Canvases up to 150 000 CSS pixels in area (for example 440x340) are exactly 1:1 at DPR 2. A 800x600 canvas is exactly 1:1 at DPR 1 and 894x670 at DPR 2 or 3.
3. If the page gave the canvas no CSS size, the engine pins the size the canvas had (it does not grow when the backing store is enlarged).
   **Append the canvas to the page before you render into it**, or pass `opts.width` and `opts.height`. A canvas that is not in the document has no layout, so `render` draws it at its own `width`/`height` attributes (default 300x150) at DPR 1, and the page then stretches that picture to the CSS size. `LowPoly.view` is safe: it redraws once the canvas is attached.
4. Supersampling (`quality:"auto"`): if the internal buffer stays within 1 000 000 pixels the frame is drawn 2x (up to 3x for small canvases) and averaged down. This is a pure function of canvas size and DPR, not of timing, so screenshots are repeatable. `"low"` = DPR 1, no supersampling, 300 000 pixels. `"high"` allows up to 4x.

`LowPoly.toCanvas(scene,w,h,opts)` renders once into a new detached canvas (for `toDataURL` thumbnails).
`LowPoly.stats` = `{frames, lastMs, lastW, lastH, lastSS, lastTris}`.

### `LowPoly.view(canvas, scene, opts)` returns the controller `{scene, set(scene), redraw(), stop(), yaw, pitch, onFrame(fn), stopped}`

`opts`: `spin` degrees per second (default 0), `drag` (default true), `keys` (default true), `fps` (default 30), `quality` (as above), `label`, plus any `render` option.

- Draws once immediately, then only when something changed (drag, keys, `set`, resize, `redraw`) or while it is animating (spin or `onFrame` callbacks). A static view uses no animation frames at all.
- The loop **stops by itself** when the canvas leaves the document (no more `requestAnimationFrame` calls), **pauses** while the tab is hidden or the canvas is off screen (resumes and redraws on return), and does **not auto-spin** under `prefers-reduced-motion: reduce` (it still draws and is still draggable). **`onFrame` callbacks and a scene's `update(t,dt)` still run under reduced motion**: the engine only controls `spin`, so a scene author who animates things (orbits, thruster flicker, launch ascent) must check `matchMedia('(prefers-reduced-motion: reduce)').matches` in `update` and hold still.
- `drag:true`: pointer events (mouse, touch, pen), `touch-action: pan-y` so vertical swipes still scroll the page on a phone, `cursor: grab`. Pointer is captured while dragging (guarded, synthetic pointers are fine). A mouse drag starts at once. A **finger must move 8 px first**: if that first movement is horizontal the model turns (yaw and, from then on, pitch too); if it is vertical the gesture belongs to the page and the model is never touched. Only the first pointer drags; a second finger is ignored.
- `keys:true`: the canvas gets `tabindex="0"`; ArrowLeft/Right turn (yaw), ArrowUp/Down tilt (pitch), 6 degrees per press (15 with Shift).
- The canvas always gets `role="img"` and `aria-label` from `scene.label`, else `opts.label`, else an existing attribute, else `"3D model"`.
- `ctl.yaw` / `ctl.pitch` read and write `scene.camera.yaw/pitch` (pitch clamped to +-89.9, dragging to +-85).
- `ctl.onFrame(fn)` calls `fn(t, dt)` (seconds since the view started, seconds since the last frame, at most 0.1) before each draw, and keeps the loop running. Return `false` from `fn` to say "nothing changed, skip the draw". It returns a function that removes the callback.
- `ctl.set(scene)` swaps the scene. A scene wrapper `{scene, update, label}` from `LowPoly.scenes.x()` is also accepted by `view()` and `set()`: its `update` is registered as an `onFrame` callback.
- One view per canvas: calling `view` on a canvas that already has one stops the old one.
- `ctl.stop()` removes every listener and observer. The canvas keeps its last frame.

## 5. Registries (model files fill these in)

```
LowPoly.models.body[partId](part)       -> {mesh, size:[w,h,d], ports, label}
LowPoly.models.part[partId](part)       -> {mesh, size, label}
LowPoly.models.launcher[launcherId](l)  -> {mesh, size, label}
LowPoly.models.person[who](opts)        -> {mesh, label}
LowPoly.scenes.<name>(opts)             -> {scene, update(t,dt) optional, label, ...extras}
```

`ports = {instrument|power|comms|computer|propulsion|attitude: [ {pos:[x,y,z], normal:[x,y,z], roll:deg}, ... ]}`, best slot first. The assembler attaches a part with `LowPoly.place(part.mesh, port)`.

Safe lookup (use this from game code): `LowPoly.model("part", id, partData)` returns the registered model, or `LowPoly.fallback("part")` if the id is unknown **or the builder throws**. Fallbacks: a stubby grey cylinder with an orange tip (part), a grey bus with an orange band and 8 ports per kind (body), a plain stick rocket (launcher), a plain figure (person), a one-part scene.

Triangle budgets: small part ~60 (hero up to 120), body up to 200, satellite up to 1500, rocket up to 400, Earth up to 600, whole scene up to 2500.

## 6. Measured performance (headless Chromium on this busy 4-core machine; `LowPoly.render` call including `putImageData`, 100 frames, camera yaw changing every frame, model filling the frame)

| Canvas (CSS px, DPR) | Internal buffer | 600 tris (mean / p95) | 1500 tris | 2500 tris |
| --- | --- | --- | --- | --- |
| 800x600, DPR 1 | 800x600, no supersample | 0.9 / 1.2 ms | 1.5 / 2.0 ms | 1.5 / 2.1 ms |
| 480x360, DPR 1 | 480x360 drawn 2x | 1.9 / 2.7 ms | 2.5 / 3.5 ms | 2.4 / 2.7 ms |
| 480x480, DPR 2 | 774x774, no supersample | 1.3 / 1.7 ms | 1.7 / 2.1 ms | 2.0 / 2.5 ms |
| 96x96, DPR 2 | 192x192 drawn 3x | 1.8 / 2.9 ms | 1.7 / 1.8 ms | 1.9 / 2.1 ms |

The contract budget is 12 ms (600 tris) and 25 ms (1500 tris) at 800x600. About half the triangles are back faces and are culled, so the cost is dominated by pixels, not triangles. Worst case, every pixel of an 800x600 canvas covered and passing the depth test: about 0.5 to 0.9 ms per full-screen layer of overdraw (1 layer 1.8 ms, 5 layers 4.4 ms, 10 layers 7.1 ms, 20 layers 18 ms). A satellite on a starry background overdraws 1 to 3 times. Reading the canvas back every frame (which forces the upload) gives the same numbers.

## 7. Test and demo files

`work/engine/demo.html` (primitives, interactive view), `builders.html` (every builder from 7 angles), `palette.html` (swatches and a cohesion scene), `crisp.html` (DPR 1/2/3), `perf.html` + `perf.js` (frame times), `test-builders.js` (Node, 196 numeric checks: winding by signed volume, closed manifolds, place, jitter, registries), `test-browser.js` (Playwright, 127 checks covering the ten proofs plus alpha, onFrame, banding, near-plane clipping, decals, fill rule and item transforms; `node test-browser.js loop input` runs only some sections), `shots/` (screenshots).
