// Runs the saved model (public/model) on any photo, same preparation as the app.
// Handy when someone asks "why did it say that?"
// Run: node ml/check.mjs path/to/photo.jpg [more photos...]
import fs from "node:fs";
import sharp from "sharp";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";

await tf.setBackend("wasm");
const json = JSON.parse(fs.readFileSync("public/model/model.json", "utf8"));
const weights = fs.readFileSync("public/model/weights.bin");
const model = await tf.loadLayersModel(tf.io.fromMemory({
  modelTopology: json.modelTopology,
  weightSpecs: json.weightsManifest[0].weights,
  weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.length),
}));
const { labels } = JSON.parse(fs.readFileSync("public/model/metadata.json", "utf8"));

for (const file of process.argv.slice(2)) {
  const raw = await sharp(file).resize(224, 224, { fit: "cover" }).removeAlpha().raw().toBuffer();
  const probs = tf.tidy(() =>
    model.predict(tf.tensor3d(new Uint8Array(raw), [224, 224, 3]).toFloat().div(127.5).sub(1).expandDims()).dataSync());
  const ranked = labels.map((l, i) => [l, probs[i]]).sort((a, b) => b[1] - a[1]);
  console.log(file, "->", ranked.map(([l, p]) => `${l} ${Math.round(p * 100)}%`).join(", "));
}
