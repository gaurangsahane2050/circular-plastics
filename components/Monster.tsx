"use client";
// Basellion, our recycling monster. Drawn as SVG, moved with CSS animations (see globals.css).
import { useLang } from "@/lib/i18n";

export type Mood = "happy" | "hungry" | "sad" | "eating" | "spitting" | "thinking";

// how Basellion feels depends on how long ago the user last gave something for recycling
// (someone who just signed up hasn't let Basellion down yet, so they start hungry, not sad)
export function moodFor(daysSinceLast: number | null): Mood {
  if (daysSinceLast === null) return "hungry";
  if (daysSinceLast > 14) return "sad";
  return daysSinceLast > 7 ? "hungry" : "happy";
}

const SAD = { body: "#a3ab9c", belly: "#d6dacf", dark: "#868d80" };
const HUNGRY = { body: "#62c290", belly: "#c8eed8", dark: "#46a673" };
const WELL = { body: "#3fbf7a", belly: "#bdf2d3", dark: "#2c9d60" };
const INK = "#1f2937";

function Eyes({ mood, body }: { mood: Mood; body: string }) {
  if (mood === "eating") {
    // closed, happy eyes: ^ ^
    return (
      <g stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M66 100 Q78 86 90 100" /><path d="M110 100 Q122 86 134 100" />
      </g>
    );
  }
  if (mood === "spitting") {
    // squeezed eyes: > <
    return (
      <g stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M68 88 L86 97 L68 106" /><path d="M132 88 L114 97 L132 106" />
      </g>
    );
  }
  // where the pupils look
  const [dx, dy] = { happy: [2, 2], hungry: [0, -6], sad: [0, 5], thinking: [6, -4] }[mood];
  return (
    <g>
      {[78, 122].map((x) => (
        <g key={x}>
          <circle cx={x} cy="96" r="17" fill="#fff" />
          <circle cx={x + dx} cy={96 + dy} r="8.5" fill={INK} />
          <circle cx={x + dx - 3} cy={93 + dy} r="3" fill="#fff" />
          {/* heavy eyelid when sad */}
          {mood === "sad" && <path d={`M${x - 18} 96 A18 18 0 0 1 ${x + 18} 96 Z`} fill={body} />}
        </g>
      ))}
      {mood === "sad" && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round">
          <path d="M64 82 L86 74" /><path d="M136 82 L114 74" />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  const line = { stroke: INK, strokeWidth: 4, strokeLinecap: "round" as const, fill: "none" };
  if (mood === "eating") return <ellipse className="monster-chomp" cx="100" cy="130" rx="18" ry="15" fill={INK} />;
  if (mood === "spitting") {
    return (
      <g>
        <ellipse cx="100" cy="130" rx="15" ry="11" fill={INK} />
        <ellipse cx="104" cy="139" rx="9" ry="6" fill="#ff7a9a" />
      </g>
    );
  }
  if (mood === "hungry") return <ellipse cx="100" cy="130" rx="7" ry="8" fill={INK} />;
  if (mood === "sad") return <path d="M86 136 Q100 122 114 136" {...line} />;
  if (mood === "thinking") return <path d="M90 130 Q100 126 110 131" {...line} />;
  return <path d="M84 124 Q100 142 116 124" {...line} />;
}

export default function Monster({ mood, item, message, size = 190, onTap }: {
  mood: Mood;
  item?: string | null; // photo that gets eaten or spat out
  message?: string;
  size?: number;
  onTap?: () => void;
}) {
  const c = mood === "sad" ? SAD : mood === "hungry" ? HUNGRY : WELL;
  const Wrap = onTap ? "button" : "div";
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center">
      <p aria-live="polite" className="mb-1 max-w-64 rounded-2xl bg-white px-4 py-2 text-center text-sm font-medium text-slate-900 shadow-sm">
        {message ?? t(`m.${mood}`)}
      </p>
      <Wrap className="relative" style={{ width: size, height: size }} onClick={onTap} aria-label={onTap ? t("m.tap") : undefined}>
        <svg viewBox="0 0 200 200" className={`monster monster-${mood} h-full w-full`} role="img" aria-label={t("m.alt")}>
          <ellipse cx="100" cy="191" rx="52" ry="6" fill="#000" opacity="0.12" />
          <g className="monster-body">
            {/* sprout on the head: fresh leaves, or a dry dead twig when Basellion is sad */}
            {mood === "sad" ? (
              <g stroke="#8b6b4a" strokeWidth="4" strokeLinecap="round" fill="none">
                <path d="M100 46 Q102 28 118 22" /><path d="M108 32 L101 20" /><path d="M114 25 L125 30" />
              </g>
            ) : (
              <g className="monster-sprout">
                <path d="M100 46 V22" stroke="#2e7d4f" strokeWidth="4" strokeLinecap="round" />
                <path d="M100 27 Q84 10 75 22 Q87 31 100 27Z" fill="#7bd88f" />
                <path d="M100 25 Q117 7 127 19 Q113 29 100 25Z" fill="#a3eab0" />
              </g>
            )}
            <ellipse cx="78" cy="181" rx="15" ry="9" fill={c.dark} />
            <ellipse cx="122" cy="181" rx="15" ry="9" fill={c.dark} />
            <circle cx="58" cy="62" r="16" fill={c.body} />
            <circle cx="142" cy="62" r="16" fill={c.body} />
            <path d="M100 44 C150 44 172 84 172 124 C172 164 142 184 100 184 C58 184 28 164 28 124 C28 84 50 44 100 44Z" fill={c.body} />
            <ellipse cx="100" cy="150" rx="42" ry="27" fill={c.belly} />
            <ellipse cx="31" cy="130" rx="9" ry="16" fill={c.dark} />
            <ellipse cx="169" cy="130" rx="9" ry="16" fill={c.dark} />
            <Eyes mood={mood} body={c.body} />
            {(mood === "happy" || mood === "eating") && (
              <g fill="#ff9eb5" opacity="0.7">
                <ellipse cx="60" cy="118" rx="9" ry="5" /><ellipse cx="140" cy="118" rx="9" ry="5" />
              </g>
            )}
            <Mouth mood={mood} />
            {mood === "sad" && <path className="monster-tear" d="M64 112 Q60 120 64 124 Q68 120 64 112Z" fill="#7cc4f2" />}
          </g>
        </svg>
        {item && (mood === "eating" || mood === "spitting") && (
          // eslint-disable-next-line @next/next/no-img-element -- local photo preview
          <img key={mood} src={item} alt="" className={`absolute top-[64%] left-1/2 h-14 w-14 rounded-lg object-cover shadow ${mood === "eating" ? "item-in" : "item-out"}`} />
        )}
      </Wrap>
    </div>
  );
}
