# Landmark brief

A landmark is a small voxel monument that stands in a topic's zone on a floating island and says what the topic is. Someone should be able to name the subject from the picture alone, from any side, at small size.

## File
`tools/landmarks/library/<name>.mjs`, an ES module with no imports:

```js
export default function build(a) { /* calls on a */ }
```

- Grid: x and z from -16 to 15, y from 0 to 47, y up, y = 0 on the ground. Centre on x = 0, z = 0.
- `a.set(x,y,z,m)`, `a.get(x,y,z)`, `a.box(x0,y0,z0,x1,y1,z1,m)`, `a.cyl(cx,y0,cz,r,h,m)`, `a.ball(cx,cy,cz,r,m)`, `a.ellipsoid(cx,cy,cz,rx,ry,rz,m)`, `a.line(x0,y0,z0,x1,y1,z1,r,m)`. A material of `null` removes voxels.
- Materials: stone, stone2, trim, metal, roof, roof2, glass, wood, glow, accent, dark. `accent` becomes the topic's own colour: use it on the parts that should carry it. `glow` lights at night: use a little.

## Shape
- 18 to 28 wide, 22 to 44 tall. One bold silhouette; nothing thinner than 2 voxels.
- On a plinth or paved base 1 to 2 high and 24 to 28 across.
- Main face toward +x. It must still read from behind.

## Check
`node tools/landmarks/render.mjs <file.mjs> <file.png>` saves two views (both see +x; one also +z, the other -z). Look at it, fix the worst problem, render once more. Two renders per landmark at most.

`tools/landmarks/library/lighthouse.mjs` is a finished example, if you need one.

## Report
One line per landmark: what it is and what is still wrong with it.
