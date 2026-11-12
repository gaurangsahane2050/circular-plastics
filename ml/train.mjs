// Trains the plastic-type classifier and saves it to public/model/ in TensorFlow.js format.
// Same idea as Google Teachable Machine: reuse MobileNet (already trained on ImageNet) to turn
// each photo into features, then train only a small classifier on top of those features.
// Run: node ml/download.mjs  then  node ml/train.mjs [mobilenet width, default 0.50]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";

const LABELS = ["PET", "HDPE", "PP", "LDPE", "UNCLEAR"]; // same order as the app uses
const WIDTH = process.argv[2] || "0.50";
const BASE_URL = `https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_${WIDTH}_224/model.json`;
const OUT = "public/model";

await tf.setBackend("wasm");

// Centre-crop to a square, resize to 224x224 and scale pixels to [-1, 1].
// The browser code in lib/classify.ts must do exactly the same thing.
async function loadImage(file, grey = false) {
  const raw = await sharp(file).resize(224, 224, { fit: "cover" }).removeAlpha().raw().toBuffer();
  return tf.tidy(() => {
    const rgb = tf.tensor3d(new Uint8Array(raw), [224, 224, 3]).toFloat();
    return (grey ? rgb.mean(2, true).tile([1, 1, 3]) : rgb).div(127.5).sub(1);
  });
}

// every 5th photo of each class goes to the test set, the rest is for training
const train = [], test = [];
LABELS.forEach((label, i) => {
  const files = fs.readdirSync(path.join("ml/data", label)).sort();
  files.forEach((f, n) => (n % 5 === 0 ? test : train).push({ file: path.join("ml/data", label, f), y: i }));
});
console.log(`train ${train.length} photos, test ${test.length} photos`);

// MobileNet without its last layers, so it outputs features instead of ImageNet classes
const mobilenet = await tf.loadLayersModel(BASE_URL);
const cut = mobilenet.getLayer("conv_pw_13_relu");
const base = tf.model({ inputs: mobilenet.inputs, outputs: cut.output });

// Training photos are also used in black and white, so the model can't lean on colour alone
// (lots of LDPE photos are black bin bags, which made a black tiffin look like LDPE).
// Test photos are only used as they are, so the test score stays honest.
async function features(set, versions) {
  const out = [], ys = [];
  for (const { file, y } of set) {
    for (const grey of versions) {
      const img = await loadImage(file, grey);
      out.push(base.predict(img.expandDims()));
      ys.push(y);
      img.dispose();
    }
  }
  return { x: tf.concat(out), y: tf.oneHot(ys, LABELS.length) };
}
const trainData = await features(train, [false, true]);
const testData = await features(test, [false]);

// the only part we train: average the feature map, one hidden layer, then 5 outputs
const head = tf.sequential({
  layers: [
    tf.layers.globalAveragePooling2d({ inputShape: cut.outputShape.slice(1) }),
    tf.layers.dropout({ rate: 0.3 }),
    tf.layers.dense({ units: 100, activation: "relu" }),
    tf.layers.dense({ units: LABELS.length, activation: "softmax" }),
  ],
});
head.compile({ optimizer: tf.train.adam(0.001), loss: "categoricalCrossentropy", metrics: ["accuracy"] });
// HDPE and LDPE have the fewest photos, so mistakes on them count more
const classWeight = Object.fromEntries(LABELS.map((_, i) => [i, train.length / (LABELS.length * train.filter((s) => s.y === i).length)]));
await head.fit(trainData.x, trainData.y, { epochs: 40, batchSize: 16, shuffle: true, verbose: 0, classWeight });

// Test set results, including how accurate each confidence band is.
// This is what tells us whether the 85% / 60% thresholds in the app make sense.
const probs = await head.predict(testData.x).array();
const truth = test.map((s) => s.y);
const confusion = LABELS.map(() => LABELS.map(() => 0));
const bands = { high: [0, 0], mid: [0, 0], low: [0, 0] }; // [right, total]
const kinds = { symbol: [0, 0], wholeItem: [0, 0] }; // close-up of the symbol vs photo of the whole item
probs.forEach((p, i) => {
  const guess = p.indexOf(Math.max(...p));
  confusion[truth[i]][guess]++;
  const band = p[guess] >= 0.85 ? "high" : p[guess] >= 0.6 ? "mid" : "low";
  const kind = path.basename(test[i].file).startsWith("tb_") ? "wholeItem" : "symbol";
  for (const tally of [bands[band], kinds[kind]]) {
    tally[0] += guess === truth[i];
    tally[1]++;
  }
});
const summary = (tallies) => Object.fromEntries(Object.entries(tallies).map(([k, [r, t]]) => [k, { photos: t, accuracy: t ? +(r / t).toFixed(2) : null }]));
const correct = confusion.reduce((sum, row, i) => sum + row[i], 0);
const results = {
  mobilenet: `v1 ${WIDTH}`,
  trainPhotos: train.length,
  testPhotos: test.length,
  testAccuracy: +(correct / test.length).toFixed(3),
  perClassRecall: Object.fromEntries(LABELS.map((l, i) => [l, +(confusion[i][i] / confusion[i].reduce((a, b) => a + b)).toFixed(2)])),
  confusion: { rows_are_truth_cols_are_guess: LABELS, matrix: confusion },
  byPhotoKind: summary(kinds),
  confidenceBands: summary(bands),
};
console.log(JSON.stringify(results, null, 2));
fs.writeFileSync("ml/results.json", JSON.stringify(results, null, 2));

// Glue MobileNet and our head into one model so the browser loads a single file.
// tfjs-node is not needed: we take the model files from a custom save handler and write them ourselves.
const full = tf.model({ inputs: base.inputs, outputs: head.apply(base.outputs[0]) });
fs.mkdirSync(OUT, { recursive: true });
await full.save(tf.io.withSaveHandler(async (art) => {
  fs.writeFileSync(path.join(OUT, "weights.bin"), Buffer.from(art.weightData));
  const modelJson = { modelTopology: art.modelTopology, format: art.format, weightsManifest: [{ paths: ["weights.bin"], weights: art.weightSpecs }] };
  fs.writeFileSync(path.join(OUT, "model.json"), JSON.stringify(modelJson));
  return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } };
}));
fs.writeFileSync(path.join(OUT, "metadata.json"), JSON.stringify({ labels: LABELS, imageSize: 224, testAccuracy: results.testAccuracy }, null, 2));
console.log("saved to", OUT);
