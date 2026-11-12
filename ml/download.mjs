// Downloads the training photos into ml/data/<CLASS>/ (folder per class).
// Sources (all openly licensed, credited in README):
//   aytvill/plastic-recycling-codes  - MIT, close-ups of the recycling symbol, sorted by resin code
//   viola77data/recycling-dataset    - Apache-2.0, a few "not plastic" examples
//   TrashBusters/combined            - MIT, photos of whole items (bottles, tubs, bags) with fine labels
// Run: node ml/download.mjs
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";

const HF = "https://huggingface.co";

// symbol close-ups: our class -> [dataset, folder in that dataset, max images]
const FOLDERS = {
  PET: [["aytvill/plastic-recycling-codes", "1_polyethylene_PET", 200]],
  HDPE: [["aytvill/plastic-recycling-codes", "2_high_density_polyethylene_PE-HD", 200]],
  LDPE: [["aytvill/plastic-recycling-codes", "4_low_density_polyethylene_PE-LD", 200]],
  PP: [["aytvill/plastic-recycling-codes", "5_polypropylene_PP", 200]],
  UNCLEAR: [
    ["aytvill/plastic-recycling-codes", "8_no_plastic", 200],
    ["viola77data/recycling-dataset", "glass", 25],
    ["viola77data/recycling-dataset", "aluminium", 25],
    ["viola77data/recycling-dataset", "cardboard", 25],
    ["viola77data/recycling-dataset", "paper", 25],
  ],
};

// Whole items. The dataset labels the object, not the resin, so we only use objects
// that are almost always one resin (water/soda bottles are PET, carry bags are LDPE, ...).
// Glass bottles, cans and styrofoam go to UNCLEAR so the model learns they are not our plastics.
const WHOLE_ITEMS = {
  PET: [["plastic_water_bottles", 150], ["plastic_soda_bottles", 150]],
  HDPE: [["plastic_detergent_bottles", 200]],
  PP: [["plastic_food_containers", 250], ["Q_Plastic Containers", 100]], // tubs, tiffins, boxes, incl. black ones
  LDPE: [["plastic_shopping_bags", 120], ["plastic_trash_bags", 120], ["N_Plastic Bag", 80]],
  UNCLEAR: [["glass_beverage_bottles", 80], ["aluminum_soda_cans", 50], ["paper_cups", 40], ["styrofoam_cups", 40], ["cardboard_boxes", 30]],
};
const SHARDS = [0, 1, 2].map((i) => `data/train-0000${i}-of-00003.parquet`);

async function save(url, file) {
  const res = await fetch(url);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file));
}

// 1. symbol close-ups, one file at a time from the dataset folders
for (const [label, sources] of Object.entries(FOLDERS)) {
  const dir = path.join("ml", "data", label);
  fs.mkdirSync(dir, { recursive: true });
  for (const [dataset, folder, max] of sources) {
    const res = await fetch(`${HF}/api/datasets/${dataset}/tree/main/${encodeURIComponent(folder)}`);
    const files = (await res.json()).filter((f) => /\.(jpe?g|png)$/i.test(f.path)).slice(0, max).map((f) => f.path);
    for (const file of files) {
      const out = path.join(dir, dataset.split("/")[0] + "_" + path.basename(file));
      if (!fs.existsSync(out)) await save(`${HF}/datasets/${dataset}/resolve/main/${encodeURI(file)}`, out);
    }
    console.log(label, "<-", folder, files.length);
  }
}

// 2. whole items: the dataset is stored as 3 big parquet files (~1.5 GB), so download them
// once into ml/raw/ and pick out the rows we want
const wanted = Object.fromEntries(Object.entries(WHOLE_ITEMS).flatMap(([label, list]) => list.map(([orig, max]) => [orig, { label, max, taken: 0 }])));
fs.mkdirSync("ml/raw", { recursive: true });
for (const [i, shard] of SHARDS.entries()) {
  const local = `ml/raw/trashbusters-train-${i}.parquet`;
  if (!fs.existsSync(local)) await save(`${HF}/datasets/TrashBusters/combined/resolve/main/${shard}`, local);
  // utf8: false keeps the image bytes as bytes (otherwise they get decoded as text and break)
  const rows = await parquetReadObjects({ file: await asyncBufferFromFile(local), columns: ["original_label", "image"], utf8: false });
  for (const row of rows) {
    const label = row.original_label;
    const w = wanted[label];
    if (!w || w.taken >= w.max) continue;
    const ext = row.image.bytes[0] === 0x89 ? "png" : "jpg";
    const name = `tb_${label.replace(/\W+/g, "_")}_${w.taken++}.${ext}`;
    fs.writeFileSync(path.join("ml", "data", w.label, name), row.image.bytes);
  }
}
for (const [orig, w] of Object.entries(wanted)) console.log(w.label, "<-", orig, w.taken);
