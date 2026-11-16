// Harp (harmony): a concert harp standing on a plinth, its gilded column and curved neck framing the strings,
// the soundboard sloping up from the foot, facing the side so the strings show front and back.
export default function build(a) {
  a.box(-11, 0, -12, 11, 0, 12, "stone2");
  a.box(-5, 1, -10, 5, 2, 10, "stone");
  a.box(-2, 3, -10, 2, 4, 4, "wood");                                // base
  for (let y = 5; y <= 40; y++) a.box(-1, y, -9, 1, y, -8, "metal");  // column
  a.ball(0, 42, -8.5, 2.2, "metal"); a.ball(0, 3, -8.5, 2, "metal");
  const neck = (z) => 40 - 6 * Math.sin(((z + 8) / 18) * Math.PI) - (z + 8) * 0.25;   // curved neck from the column to the top of the soundboard
  for (let z = -8; z <= 10; z += 0.5) a.box(-1, Math.round(neck(z)), Math.round(z), 1, Math.round(neck(z)) + 1, Math.round(z), "wood");
  const board = (z) => 5 + ((z + 6) / 16) * 30;                       // soundboard rising from the foot to the neck's end
  for (let z = -6; z <= 10; z += 0.5) a.box(-2, Math.round(board(z)) - 1, Math.round(z), 2, Math.round(board(z)), Math.round(z), "roof");
  for (let z = -6; z <= 9; z++) { const y0 = Math.round(board(z)) + 1, y1 = Math.round(neck(z)) - 1; for (let y = y0; y <= y1; y++) a.set(0, y, z, z % 7 === 0 ? "accent" : "stone"); }   // strings
}
