import { createClient } from "@supabase/supabase-js";

// "Ask Basellion": the user describes their waste in words, a language model lists the plastic items.
// This runs on the server so the OpenAI key never reaches the browser. Set it in .env.local:
//   OPENAI_API_KEY=sk-...        (required)
//   OPENAI_MODEL=gpt-5.6-luna    (optional, OpenAI's low-cost model)
// Only the typed text is sent to OpenAI, never the user's name, phone or address.

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

const INSTRUCTIONS = `You are Basellion (written बेसेलियन in Hindi and Marathi), the friendly recycling monster in an Indian app
that collects plastic waste from homes. The user describes waste in words (English, Hindi, Marathi or a mix).
List every separate piece of packaging: its name, plastic type, how many, and roughly how many grams each piece weighs.
Plastic types: PET (code 1: clear, stiff bottles), HDPE (code 2: shampoo/detergent bottles, milk cans),
PP (code 5: tubs, tiffins, caps, and chips, biscuit and chocolate wrappers), LDPE (code 4: milk pouches, carry bags, cling film).
Most biscuit, chips and chocolate packs sold in India are printed PP (code 5), even shiny ones: treat them as PP.
Use NOT_RECYCLABLE only for glass, metal, paper, food, or a pack the user says is printed "Other" or 7.
For a branded pack, list each piece a typical pack sold in India contains as its own item (outer pack, inner tray,
each inner wrapper) with its count, and say it is typical. If the user says what is printed on the pack, that wins.
Set sure to false when packs vary or you are guessing, and remind the user to check the code printed on the pack.
Reply in 1 to 3 short, warm sentences. Never ask for personal details. If the message is not about waste, reply briefly with no items.`;

// the exact shape the model must answer in (OpenAI "structured outputs")
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "items"],
  properties: {
    reply: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "plastic", "count", "grams_each", "sure"],
        properties: {
          name: { type: "string" },
          plastic: { type: "string", enum: ["PET", "HDPE", "PP", "LDPE", "NOT_RECYCLABLE"] },
          count: { type: "integer" },
          grams_each: { type: "number" },
          sure: { type: "boolean" },
        },
      },
    },
  },
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "Ask Basellion isn't set up yet: add OPENAI_API_KEY to .env.local." }, { status: 503 });
  }

  // only logged-in users, so strangers can't spend our OpenAI credit
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  // keep requests small: the last 8 messages, 400 characters each
  const { messages, lang } = (await request.json()) as { lang?: string; messages: { role: "user" | "assistant"; content: string }[] };
  const language = { hi: "Hindi (Devanagari script)", mr: "Marathi (Devanagari script)" }[lang ?? ""] ?? "English";
  const recent = (messages ?? []).slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 400) }));

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "low", // a quick answer is enough here
      messages: [
        { role: "developer", content: `${INSTRUCTIONS}\nWrite the reply and the item names in ${language}. Keep plastic codes as PET, HDPE, PP, LDPE.` },
        ...recent,
      ],
      response_format: { type: "json_schema", json_schema: { name: "waste_items", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok) {
    console.error("OpenAI error", res.status, await res.text());
    return Response.json({ error: "Basellion couldn't think right now. Please try again." }, { status: 502 });
  }
  const answer = await res.json();
  return Response.json(JSON.parse(answer.choices[0].message.content));
}
