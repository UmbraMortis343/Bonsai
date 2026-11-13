// Drawing and Design: a painter's easel holding a painted canvas facing +x, with a palette at its foot.
export default function build(a) {
  // plinth
  a.box(-13, 0, -13, 12, 0, 12, "stone2");
  a.box(-12, 1, -12, 11, 1, 11, "stone");

  // canvas leans back: front face x = fx(y)
  const y0 = 15, y1 = 37, zw = 10;
  const fx = (y) => 4 - (y - y0) * 0.27;
  // easel legs: two front legs splay out, meet near the top behind the canvas
  a.line(5, 2, -9, fx(40) - 1.5, 42, -1, 1, "wood");
  a.line(5, 2, 9, fx(40) - 1.5, 42, 1, 1, "wood");
  a.line(-11, 2, 0, fx(38) - 2, 39, 0, 1, "wood");          // back leg
  a.line(fx(44) - 1.5, 30, 0, fx(44) - 1.5, 44, 0, 1, "wood"); // mast above
  a.box(fx(13) - 1, 13, -12, fx(13) + 2, 14, 12, "wood");   // ledge
  a.box(fx(13) + 2, 15, -12, fx(13) + 2, 15, 12, "wood");   // ledge lip

  for (let y = y0; y <= y1; y++) {
    const x = Math.round(fx(y));
    for (let z = -zw; z <= zw; z++) {
      const edge = y === y0 || y === y1 || Math.abs(z) === zw;
      a.set(x - 1, y, z, "wood");                               // stretcher back
      let m = "stone";
      if (!edge) {
        const v = y - y0, hill1 = 9 + 4 * Math.cos((z + 3) / 4), hill2 = 4 + 2 * Math.cos((z - 5) / 3);
        if (v <= hill2) m = "roof";                             // foreground
        else if (v <= hill1) m = "accent";                      // hills in the topic colour
        else if (Math.hypot(z - 4, v - 16) <= 3.6) m = "glow";   // sun
        else m = "glass";                                       // sky
      } else m = "trim";
      a.set(x, y, z, m);
    }
  }
  a.box(fx(y1) - 1, y1 + 1, -2, fx(y1), y1 + 2, 2, "wood");  // top clamp

  // palette on the plinth in front, with paint blobs
  for (let x = 6; x <= 11; x++) for (let z = -11; z <= -2; z++) if (((x - 8.5) / 3.4) ** 2 + ((z + 6.5) / 5.4) ** 2 <= 1 && Math.hypot(x - 9, z + 3) > 1.3) a.set(x, 2, z, "wood");
  for (const [x, z, m] of [[7, -9, "accent"], [9, -10, "glow"], [10, -7, "roof"], [7, -6, "glass"], [9, -6, "dark"]]) a.set(x, 3, z, m);
  // brush jar with brushes
  a.cyl(8, 2, 7, 1.6, 4, "metal");
  a.line(8, 5, 7, 9, 12, 6, 0.5, "wood"); a.set(9, 13, 6, "accent");
  a.line(8, 5, 7, 7, 11, 8, 0.5, "wood"); a.set(7, 12, 8, "roof");
}
