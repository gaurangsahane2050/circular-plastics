// Finds separate items in a photo of waste laid out on a plain surface (floor, table, sheet).
// No AI here: anything that clearly differs from the colour along the photo's edge is "an item",
// and touching pixels are grouped together. Works only when the background is plain and the
// items don't touch, which is what the app asks people to do.

export type Box = { x: number; y: number; w: number; h: number }; // fractions of the photo, 0 to 1

const WIDTH = 160; // work on a small copy, it is fast and smooths out noise

export function findItems(img: HTMLImageElement): Box[] {
  const W = WIDTH;
  const H = Math.round((WIDTH * img.naturalHeight) / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;

  // 1. background colour = average colour along the edge of the photo
  const edge: number[] = [];
  for (let x = 0; x < W; x++) edge.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) edge.push(y * W, y * W + W - 1);
  const avg = [0, 1, 2].map((c) => edge.reduce((sum, i) => sum + px[i * 4 + c], 0) / edge.length);
  const dist = (i: number) => Math.hypot(px[i * 4] - avg[0], px[i * 4 + 1] - avg[1], px[i * 4 + 2] - avg[2]);
  const spread = edge.reduce((sum, i) => sum + dist(i), 0) / edge.length;
  if (spread > 35) return []; // busy background (a hand, a room): treat the photo as one item

  // 2. which pixels belong to an item, grown by 2 px so labels and gaps don't split one item
  const threshold = Math.max(40, spread * 3);
  let mask = Array.from({ length: W * H }, (_, i) => dist(i) > threshold);
  for (let round = 0; round < 2; round++) {
    mask = mask.map((on, i) => on || (i % W > 0 && mask[i - 1]) || (i % W < W - 1 && mask[i + 1]) || mask[i - W] || mask[i + W]);
  }

  // 3. group touching pixels into items and measure each one's box
  const seen = new Uint8Array(W * H);
  const boxes: (Box & { pixels: number })[] = [];
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || seen[start]) continue;
    let [x0, y0, x1, y1, pixels] = [W, H, 0, 0, 0];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      const y = Math.floor(i / W);
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      pixels++;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (n >= 0 && n < W * H && mask[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (pixels > W * H * 0.01) boxes.push({ x: x0 / W, y: y0 / H, w: (x1 - x0 + 1) / W, h: (y1 - y0 + 1) / H, pixels });
  }

  // 4. one big blob, or nothing, means "just one item"; otherwise number them left to right
  if (boxes.length < 2 || boxes.length > 8 || boxes.some((b) => b.w * b.h > 0.7)) return [];
  return boxes.sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2)).map(({ x, y, w, h }) => ({ x, y, w, h }));
}
