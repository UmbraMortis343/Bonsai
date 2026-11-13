// Seated scholar: a hooded figure in a teal mantle over a russet gown, sitting on a stone bench,
// head bowed over a large open book held in the lap. A stack of books and a lantern sit beside.
export default function build(a) {
  const mantle = "accent", gown = "roof2";
  // plinth
  a.box(-10, 0, -9, 10, 0, 9, "stone2");
  a.box(-9, 1, -8, 9, 1, 8, "trim");
  // bench behind and under the figure
  a.box(-7, 2, -9, 7, 7, -3, "stone2");
  a.box(-8, 8, -9, 8, 8, -2, "stone2");

  // gown: lap and thighs forward to the knees, then falling to the floor with a flared hem
  a.box(-4, 9, -7, 4, 12, 4, gown);
  a.box(-4, 9, -7, -4, 9, 4, null); a.box(4, 9, -7, 4, 9, 4, null);        // soften lower edges
  a.box(0, 12, 0, 0, 12, 4, null);                                          // groove between knees
  a.box(-4, 4, 3, 4, 8, 6, gown);
  a.box(-5, 2, 2, 5, 3, 7, gown);
  a.box(-5, 2, 2, 5, 2, 7, "metal");                                        // hem band
  for (const sx of [-1, 1]) a.box(sx * 2 - 1, 2, 8, sx * 2 + 1, 3, 8, "wood"); // shoes

  // torso in the mantle, upper body leaning forward
  a.box(-4, 13, -7, 4, 16, -2, mantle);
  a.box(-4, 17, -6, 4, 20, -1, mantle);
  a.box(-5, 19, -6, 5, 20, -2, mantle);                                     // shoulders
  for (const [x, z] of [[-4, -7], [4, -7], [-4, -2], [4, -2]]) a.box(x, 13, z, x, 16, z, null);
  a.box(-4, 13, -7, 4, 13, -2, "metal");                                    // sash
  a.box(-1, 14, -1, 1, 20, -1, gown);                                       // gown showing at the chest
  a.box(-1, 14, -2, 1, 16, -2, gown);

  // hood with the face looking down into the book
  a.box(-3, 21, -6, 3, 26, 0, mantle);                                      // hood, squared off
  for (const x of [-3, 3]) { a.box(x, 26, -6, x, 26, 0, null); a.box(x, 21, -6, x, 26, -6, null); }
  a.box(-2, 27, -5, 2, 27, -1, mantle);
  a.box(-2, 17, -7, 2, 22, -7, mantle);                                     // cowl hanging down the back
  a.box(-2, 21, -1, 2, 25, 1, null);                                        // hood opening
  a.box(-2, 21, -2, 2, 25, -1, "stone");                                    // face
  a.set(-1, 23, -1, "dark"); a.set(1, 23, -1, "dark");                      // eyes cast down
  a.box(-3, 26, -1, 3, 26, 0, mantle);                                      // hood brim
  a.box(-1, 27, -5, 1, 28, -2, mantle);                                     // hood peak
  a.set(0, 29, -4, mantle);
  a.box(-2, 21, -1, 2, 21, -1, "stone2");                                   // chin shadow / beard

  // wide sleeves: upper arms at the sides, forearms forward to the book, hands gripping its edges
  for (const sx of [-1, 1]) {
    a.box(sx * 5, 14, -5, sx * 6, 19, -2, mantle);
    a.box(sx * 4, 12, -2, sx * 6, 15, 0, mantle);
    a.box(sx * 5, 12, 1, sx * 6, 15, 1, "trim");                           // cuff
  }

  // open book on the lap, far edge raised toward the reader: wood cover, white pages, spine down the middle
  for (let x = -5; x <= 5; x++) for (let k = 0; k <= 5; k++) {
    const z = k, lift = Math.round(k * 0.7);
    a.set(x, 13 + lift, z, "wood");
    a.set(x, 14 + lift, z, x === 0 ? null : (k % 2 === 1 && Math.abs(x) >= 2 && Math.abs(x) <= 4) ? "stone2" : "stone");
    for (let y = 15 + lift; y <= 19; y++) if (Math.abs(x) <= 3) a.set(x, y, z, null);
  }

  for (const sx of [-1, 1]) a.box(sx * 6, 14, 2, sx * 6, 16, 3, "stone");  // hands gripping the edges

  // stack of books and a lantern on the plinth
  a.box(-9, 2, 4, -6, 2, 7, "roof");
  a.box(-9, 3, 4, -6, 3, 7, "accent");
  a.box(-8, 4, 5, -6, 4, 7, "wood");
  a.box(-9, 2, 4, -9, 3, 7, "stone");
  a.box(7, 2, 5, 9, 2, 7, "dark");
  a.box(7, 3, 5, 9, 5, 7, "glow");
  a.box(7, 6, 5, 9, 6, 7, "dark");
  a.set(8, 7, 6, "metal");
}
