import type { LayersModel, Tensor } from "@tensorflow/tfjs";
import type { Plastic } from "./supabase";
import { squareCanvas, type Picture } from "./image";

// Our trained model (see ml/train.mjs) runs here, inside the browser.
// The photo is never uploaded anywhere.
let model: LayersModel | null = null;
let labels: Plastic[] = [];
let backendChosen = false;

// TensorFlow.js, loaded only when someone actually takes a photo.
// The graphics card makes it fast; some phones and browsers block WebGL, then the plain CPU still works.
export async function loadTf() {
  const tf = await import("@tensorflow/tfjs");
  if (!backendChosen) {
    const gpu = await tf.setBackend("webgl").catch(() => false);
    if (!gpu) await tf.setBackend("cpu");
    backendChosen = true;
  }
  return tf;
}

export type Guess = { type: Plastic; confidence: number; scores: Record<Plastic, number> };

export async function classify(img: Picture): Promise<Guess> {
  const tf = await loadTf();
  if (!model) {
    model = await tf.loadLayersModel("/model/model.json");
    labels = (await (await fetch("/model/metadata.json")).json()).labels;
  }
  // same preparation as training: centre square, 224x224, pixels scaled to [-1, 1]
  const probs = tf.tidy(() => {
    const x = tf.browser.fromPixels(squareCanvas(img, 224)).toFloat().div(127.5).sub(1).expandDims();
    return Array.from((model!.predict(x) as Tensor).dataSync());
  });
  const best = probs.indexOf(Math.max(...probs));
  const scores = Object.fromEntries(labels.map((label, i) => [label, probs[i]])) as Record<Plastic, number>;
  return { type: labels[best], confidence: probs[best], scores };
}
