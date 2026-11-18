"use client";

import { useId, type ReactNode } from "react";

// The gallery's pictograms (the user, 2026-11-17: "a monocolor icon-like depiction of the game"; Round 2: solid pictograms). One
// distinct silhouette per base, solid shapes with knocked-out details, in currentColor so a square can draw it bone, muted or on a
// chosen fill. Drawn here as vectors on a 48 grid: stand-ins until the nano-banana set can be made (the Gemini key's billing was
// paused on 2026-11-17, so no image could be generated); a base's id picks its icon, a change's icon word picks one too.

type Art = { fill: ReactNode; knock?: ReactNode };

/** A figure from the shoulders up: a round head over rounded shoulders, `s` its scale, (cx, top) its top centre. */
const bust = (cx: number, top: number, s = 1, k = "b") => (
  <g key={k}>
    <circle cx={cx} cy={top + 4.6 * s} r={4.6 * s} />
    <path d={`M${cx - 8.2 * s} ${top + 21 * s}v${-3.6 * s}a${8.2 * s} ${7 * s} 0 0 1 ${16.4 * s} 0v${3.6 * s}z`} />
  </g>
);
/** A poker chip seen from above: a disc with notches knocked out, `r` its radius. */
const chip = (cx: number, cy: number, r: number, k = "c"): Art => ({
  fill: <circle key={k} cx={cx} cy={cy} r={r} />,
  knock: (
    <g key={`${k}k`}>
      <circle cx={cx} cy={cy} r={r * 0.55} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x={cx - r * 0.12} y={cy - r} width={r * 0.24} height={r * 0.28} transform={`rotate(${a} ${cx} ${cy})`} />
      ))}
    </g>
  ),
});
const star = (cx: number, cy: number, r: number, k = "s") => {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return <path key={k} d={`M${p.join("L")}z`} />;
};
const bolt = (x: number, y: number, s = 1, k = "bolt") => <path key={k} d={`M${x + 3 * s} ${y}l${-6 * s} ${11 * s}h${4.5 * s}l${-2.5 * s} ${9 * s}l${8 * s} ${-12 * s}h${-4.6 * s}l${2.6 * s} ${-8 * s}z`} />;
const check = (x: number, y: number, s = 1, k = "chk") => <path key={k} d={`M${x} ${y + 4 * s}l${3.2 * s} ${3.2 * s}l${7 * s} ${-7.4 * s}l${2.2 * s} ${2.2 * s}l${-9.2 * s} ${9.6 * s}l${-5.4 * s} ${-5.4 * s}z`} />;
const heart = (cx: number, cy: number, s = 1, k = "h") => <path key={k} d={`M${cx} ${cy + 8 * s}c${-9 * s} ${-6 * s} ${-11 * s} ${-11 * s} ${-7 * s} ${-14.5 * s}c${2.6 * s} ${-2.2 * s} ${5.6 * s} ${-1.4 * s} ${7 * s} ${1.2 * s}c${1.4 * s} ${-2.6 * s} ${4.4 * s} ${-3.4 * s} ${7 * s} ${-1.2 * s}c${4 * s} ${3.5 * s} ${2 * s} ${8.5 * s} ${-7 * s} ${14.5 * s}z`} />;
const drop = (cx: number, top: number, s = 1, k = "d") => <path key={k} d={`M${cx} ${top}c${-4 * s} ${7 * s} ${-8 * s} ${11 * s} ${-8 * s} ${16 * s}a${8 * s} ${8 * s} 0 0 0 ${16 * s} 0c0 ${-5 * s} ${-4 * s} ${-9 * s} ${-8 * s} ${-16 * s}z`} />;
const tv = (x: number, y: number, w: number, h: number, k = "tv") => (
  <g key={k}>
    <rect x={x} y={y} width={w} height={h} rx={2.5} />
    <rect x={x + w / 2 - 4} y={y + h + 1.5} width={8} height={2.4} rx={1} />
  </g>
);
const bubble = (x: number, y: number, w: number, h: number, k = "bub") => <path key={k} d={`M${x + 3} ${y}h${w - 6}a3 3 0 0 1 3 3v${h - 6}a3 3 0 0 1 -3 3h${-w * 0.45}l-6 5v-5h${-(w * 0.55 - 6)}a3 3 0 0 1 -3 -3v${-(h - 6)}a3 3 0 0 1 3 -3z`} />;
const qmark = (cx: number, cy: number, s = 1, k = "q") => (
  <g key={k}>
    <path d={`M${cx - 4.6 * s} ${cy - 4 * s}a${4.8 * s} ${4.8 * s} 0 1 1 ${7.2 * s} ${4.2 * s}c${-1.6 * s} ${0.9 * s} ${-1.8 * s} ${1.6 * s} ${-1.8 * s} ${3 * s}h${-3.6 * s}c0 ${-2.8 * s} ${1 * s} ${-4 * s} ${3 * s} ${-5.2 * s}a${1.4 * s} ${1.4 * s} 0 1 0 ${-1.6 * s} ${-2.4 * s}z`} />
    <circle cx={cx} cy={cy + 7 * s} r={2 * s} />
  </g>
);
const arrowUp = (cx: number, y: number, h: number, k = "au") => <path key={k} d={`M${cx} ${y}l7 7h-4.4v${h - 7}h-5.2v${-(h - 7)}h-4.4z`} />;
const arrowDown = (cx: number, y: number, h: number, k = "ad") => <path key={k} d={`M${cx} ${y + h}l7 -7h-4.4v${-(h - 7)}h-5.2v${h - 7}h-4.4z`} />;
const robot = (cx: number, top: number, s = 1, k = "r"): Art => ({
  fill: (
    <g key={k}>
      <rect x={cx - 9 * s} y={top + 5 * s} width={18 * s} height={14 * s} rx={3.4 * s} />
      <rect x={cx - 1.2 * s} y={top} width={2.4 * s} height={5 * s} />
      <circle cx={cx} cy={top} r={2 * s} />
      <rect x={cx - 11.4 * s} y={top + 9.5 * s} width={2.4 * s} height={5 * s} rx={1} />
      <rect x={cx + 9 * s} y={top + 9.5 * s} width={2.4 * s} height={5 * s} rx={1} />
    </g>
  ),
  knock: (
    <g key={`${k}k`}>
      <circle cx={cx - 4 * s} cy={top + 11 * s} r={2.2 * s} />
      <circle cx={cx + 4 * s} cy={top + 11 * s} r={2.2 * s} />
      <rect x={cx - 4 * s} y={top + 15.3 * s} width={8 * s} height={1.6 * s} rx={0.8} />
    </g>
  ),
});
const merge = (...a: Art[]): Art => ({ fill: <>{a.map((x, i) => <g key={i}>{x.fill}</g>)}</>, knock: <>{a.map((x, i) => <g key={i}>{x.knock}</g>)}</> });
const only = (fill: ReactNode): Art => ({ fill });

/** Each base's pictogram (and a few a change's icon word names). */
const ART: Record<string, () => Art> = {
  fantasy: () => only([bust(11, 15, 0.82, "a"), bust(37, 15, 0.82, "b"), bust(24, 11, 1, "c"), star(24, 5.5, 4.4)]),
  h2h: () => only([bust(11, 13, 0.9, "a"), bust(37, 13, 0.9, "b"), bolt(22, 12, 0.85)]),
  outlast: () => ({
    fill: [<path key="g" d="M13 6h22v4c0 6-6 9-6 14s6 8 6 14v4H13v-4c0-6 6-9 6-14s-6-8-6-14z" />],
    knock: [<path key="s" d="M18 10h12c-.6 3.4-4.4 6-6 8.6-1.6-2.6-5.4-5.2-6-8.6z" />, <path key="t" d="M17.6 40c.8-3.6 4.6-6.4 6.4-7.4 1.8 1 5.6 3.8 6.4 7.4z" />],
  }),
  bestball: () => only([<rect key="p1" x="17" y="30" width="14" height="14" rx="1" />, <rect key="p2" x="3" y="36" width="14" height="8" rx="1" />, <rect key="p3" x="31" y="38" width="14" height="6" rx="1" />, bust(24, 9, 0.9, "a"), bust(10, 15, 0.8, "b"), bust(38, 18, 0.74, "c")]),
  auction: () => only([<rect key="h" x="14" y="5" width="20" height="10" rx="2" transform="rotate(-35 24 10)" />, <rect key="s" x="22" y="12" width="5" height="22" rx="2" transform="rotate(-35 24 23)" />, <rect key="b" x="6" y="36" width="24" height="7" rx="2" />]),
  cap: () => ({
    fill: [<path key="t" d="M4 24L16 10h26a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2H16z" />],
    knock: [<circle key="o" cx="13" cy="24" r="2.6" />, bust(30, 13, 0.82)],
  }),
  market: () => only([<rect key="a" x="6" y="30" width="7" height="12" rx="1" />, <rect key="b" x="17" y="23" width="7" height="19" rx="1" />, <rect key="c" x="28" y="15" width="7" height="27" rx="1" />, <path key="l" d="M5 26L17 15l7 5L37 8l-3-3h11v11l-3-3-17.4 14.4-7-5L8 29.4z" />]),
  guillotine: () => only([bust(8, 6, 0.6, "a"), bust(19, 6, 0.6, "b"), bust(40, 6, 0.6, "c"), bust(30, 24, 0.75, "d"), <rect key="l1" x="2" y="21" width="7" height="2.6" />, <rect key="l2" x="12" y="21" width="7" height="2.6" />, <rect key="l3" x="22" y="21" width="7" height="2.6" />, <rect key="l4" x="32" y="21" width="7" height="2.6" />, <rect key="l5" x="42" y="21" width="5" height="2.6" />]),
  reverse: () => only([bust(19, 21, 1.05, "a"), <path key="u" d="M26 18V12a8 8 0 0 1 16 0v14h4.6L39 34l-7.6-8H36V12a2 2 0 0 0-4 0v6z" />]),
  hat: () => only([<rect key="br" x="4" y="32" width="40" height="5" rx="2.5" />, <path key="cr" d="M12 32V12a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v20z" />, star(40, 9, 4.6)]),
  spread: () => ({
    fill: [<rect key="r" x="3" y="10" width="42" height="28" rx="3" />],
    knock: [<rect key="d1" x="16.2" y="10" width="2.2" height="28" />, <rect key="d2" x="29.6" y="10" width="2.2" height="28" />, bust(9.8, 16, 0.62, "a"), bust(24, 16, 0.62, "b"), bust(38.2, 16, 0.62, "c")],
  }),
  keeper: () => ({
    fill: [<path key="sh" d="M14 22v-6a10 10 0 0 1 20 0v6h-5v-6a5 5 0 0 0-10 0v6z" />, <rect key="b" x="9" y="21" width="30" height="23" rx="3" />],
    knock: [bust(24, 24, 0.75)],
  }),
  onemoment: () => only([drop(22, 6, 1.35), star(38, 10, 5)]),
  pool: () => ({ fill: [<circle key="r" cx="24" cy="24" r="19" />], knock: [<circle key="h" cx="24" cy="24" r="9.5" />, <rect key="a" x="22" y="4" width="4" height="9" />, <rect key="b" x="22" y="35" width="4" height="9" />, <rect key="c" x="4" y="22" width="9" height="4" />, <rect key="d" x="35" y="22" width="9" height="4" />] }),
  lives: () => ({ fill: [heart(16, 26, 0.95, "a"), heart(33, 26, 0.95, "b")], knock: [<path key="z" d="M34 16l-3 5 4 3-3 6 1 .6 4-6.6-4-3 2.4-4.4z" />] }),
  norepeat: () => only([<path key="c" d="M24 6a18 18 0 1 1-17 12l4.8 1.6A13 13 0 1 0 24 11v5l-8-7.6L24 1z" />, <rect key="sl" x="6" y="21.6" width="36" height="4.8" rx="2.4" transform="rotate(45 24 24)" />]),
  picks: () => ({ fill: [bust(19, 13, 1.1, "a"), <circle key="c" cx="35" cy="33" r="9" />], knock: [check(30.6, 28.4, 0.8)] }),
  objectives: () => ({ fill: [<circle key="t" cx="22" cy="26" r="17" />, <path key="ar" d="M27 21l15-15 1 4 4 1-15 15z" />], knock: [<circle key="a" cx="22" cy="26" r="11.5" />, <circle key="b" cx="22" cy="26" r="6" fill="black" />] }),
  confidence: () => only([<rect key="a" x="6" y="8" width="36" height="7" rx="2" />, <rect key="b" x="6" y="20" width="27" height="7" rx="2" />, <rect key="c" x="6" y="32" width="18" height="7" rx="2" />]),
  sheet: () => ({
    fill: [<rect key="b" x="9" y="7" width="30" height="37" rx="3" />, <rect key="cl" x="17" y="3" width="14" height="7" rx="2" />],
    knock: [check(13.6, 13.4, 0.7, "c1"), <rect key="l1" x="25" y="17" width="9" height="2.8" />, check(13.6, 22.4, 0.7, "c2"), <rect key="l2" x="25" y="26" width="9" height="2.8" />, <rect key="b3" x="14" y="33" width="6" height="6" />, <rect key="l3" x="25" y="35" width="9" height="2.8" />],
  }),
  seasonpred: () => only([<path key="cr" d="M10 16l6 6 8-12 8 12 6-6-3 14H13z" />, bust(24, 25, 0.95)]),
  bootorder: () => only([bust(12, 2, 0.62, "a"), bust(12, 17, 0.62, "b"), bust(12, 32, 0.62, "c"), arrowDown(34, 6, 36)]),
  most: () => only([drop(9, 24, 0.55, "a"), drop(22, 16, 0.85, "b"), drop(38, 6, 1.15, "c")]),
  calls: () => ({ fill: [bubble(4, 6, 26, 18, "a"), bubble(18, 20, 26, 16, "b")], knock: [check(23.4, 23.4, 0.7)] }),
  overunder: () => only([<rect key="l" x="4" y="22.6" width="40" height="3" rx="1.5" />, arrowUp(24, 2, 17, "u"), arrowDown(24, 29, 17, "d")]),
  pairs: () => only([bust(13, 15, 0.95, "a"), bust(35, 15, 0.95, "b"), <rect key="br" x="11" y="8" width="26" height="2.6" rx="1.3" />, arrowUp(35, 0, 9, "u")]),
  split: () => ({ fill: [<circle key="p" cx="24" cy="24" r="19" />], knock: [<path key="w" d="M24 24V3.6a20.6 20.6 0 0 1 18.4 11.2z" />, <rect key="ln" x="23" y="5" width="2" height="19" />] }),
  quote: () => ({ fill: [bubble(4, 6, 40, 30)], knock: [<path key="q1" d="M13 26c0-6 3-10 7-11v3c-2 1-3 3-3 5h3v6h-7z" />, <path key="q2" d="M25 26c0-6 3-10 7-11v3c-2 1-3 3-3 5h3v6h-7z" />] }),
  seal: () => ({ fill: [<rect key="e" x="4" y="11" width="40" height="27" rx="3" />, <circle key="s" cx="24" cy="31" r="8.5" />], knock: [<path key="f" d="M6 13l18 13 18-13v3L24 29 6 16z" />, star(24, 31, 4.6)] }),
  bank: () => ({
    fill: [<rect key="a" x="8" y="31" width="32" height="10" rx="5" />, <rect key="b" x="8" y="19" width="32" height="10" rx="5" />, <rect key="c" x="8" y="7" width="32" height="10" rx="5" />],
    knock: [8, 20, 32].flatMap((y) => [<rect key={`${y}l`} x="14" y={y + 3} width="4" height="4" rx="1" />, <rect key={`${y}m`} x="22" y={y + 3} width="4" height="4" rx="1" />, <rect key={`${y}r`} x="30" y={y + 3} width="4" height="4" rx="1" />]),
  }),
  props: () => ({ fill: [<path key="t" d="M6 9h36v9a4 4 0 0 0 0 8v13H6V26a4 4 0 0 0 0-8z" />], knock: [<rect key="a" x="13" y="14" width="18" height="3" />, <rect key="b" x="13" y="22" width="22" height="3" />, <rect key="c" x="13" y="30" width="14" height="3" />] }),
  parlay: () => ({ fill: [<rect key="a" x="3" y="15" width="25" height="15" rx="7.5" transform="rotate(-30 15 22)" />, <rect key="b" x="20" y="18" width="25" height="15" rx="7.5" transform="rotate(-30 33 25)" />], knock: [<rect key="ah" x="8" y="19.6" width="15" height="5.8" rx="2.9" transform="rotate(-30 15 22)" />, <rect key="bh" x="25" y="22.6" width="15" height="5.8" rx="2.9" transform="rotate(-30 33 25)" />] }),
  pot: () => ({ fill: [<path key="bowl" d="M4 26h40c0 9-8 16-20 16S4 35 4 26z" />, <circle key="a" cx="16" cy="18" r="6" />, <circle key="b" cx="29" cy="16" r="6" />, <circle key="c" cx="23" cy="8" r="5" />], knock: [<rect key="cut" x="23" y="24" width="2" height="20" />] }),
  double: () => merge(chip(17, 26, 13, "a"), chip(31, 20, 13, "b")),
  jackpot: () => merge(chip(24, 24, 11, "a"), { fill: <path key="arc" d="M24 4a20 20 0 0 1 19 14l3-1-1 9-7-5 2.6-1A15.4 15.4 0 0 0 24 9z" /> }, { fill: <path key="arc2" d="M24 44A20 20 0 0 1 5 30l-3 1 1-9 7 5-2.6 1A15.4 15.4 0 0 0 24 39z" /> }),
  h2hpicks: () => ({ fill: [<path key="a" d="M4 14a8 8 0 0 1 16 0c0 7-8 16-8 16S4 21 4 14z" />, <path key="b" d="M28 14a8 8 0 0 1 16 0c0 7-8 16-8 16S28 21 28 14z" />, bolt(22, 22, 0.75)], knock: [<circle key="ah" cx="12" cy="14" r="3" />, <circle key="bh" cx="36" cy="14" r="3" />] }),
  teams: () => only([bust(8, 14, 0.62, "a"), bust(17, 10, 0.75, "b"), bust(31, 10, 0.75, "c"), bust(40, 14, 0.62, "d"), <rect key="div" x="23" y="6" width="2" height="36" rx="1" />]),
  race: () => ({ fill: [<rect key="p" x="8" y="4" width="3.6" height="40" rx="1.6" />, <path key="f" d="M11 6h30v20H11z" />], knock: [<rect key="a" x="16" y="6" width="5" height="5" />, <rect key="b" x="26" y="6" width="5" height="5" />, <rect key="c" x="36" y="6" width="5" height="5" />, <rect key="d" x="11" y="11" width="5" height="5" />, <rect key="e" x="21" y="11" width="5" height="5" />, <rect key="f2" x="31" y="11" width="5" height="5" />, <rect key="g" x="16" y="16" width="5" height="5" />, <rect key="h" x="26" y="16" width="5" height="5" />, <rect key="i" x="36" y="16" width="5" height="5" />, <rect key="j" x="11" y="21" width="5" height="5" />, <rect key="k" x="21" y="21" width="5" height="5" />, <rect key="l" x="31" y="21" width="5" height="5" />] }),
  coop: () => only([heart(24, 13, 0.62), bust(10, 20, 0.7, "a"), bust(24, 20, 0.7, "b"), bust(38, 20, 0.7, "c"), <rect key="arm" x="8" y="34" width="32" height="3.4" rx="1.7" />]),
  twovone: () => only([bust(9, 13, 0.75, "a"), bust(20, 13, 0.75, "b"), bust(38, 11, 0.95, "c"), <rect key="d" x="28.4" y="6" width="2" height="36" rx="1" />]),
  vsbot: () => merge({ fill: bust(12, 13, 0.95, "a") }, robot(36, 12, 0.9), { fill: <rect key="d" x="23" y="8" width="2" height="34" rx="1" /> }),
  bingo: () => ({ fill: [<rect key="c" x="5" y="5" width="38" height="38" rx="3" />], knock: [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (((r + c) % 2 === 0 && !(r === 1 && c === 1)) || r === c ? <circle key={`${r}${c}`} cx={13 + c * 11} cy={13 + r * 11} r="3.6" /> : <rect key={`${r}${c}`} x={9.6 + c * 11} y={9.6 + r * 11} width="6.8" height="6.8" rx="1" />))) }),
  trivia: () => ({ fill: [bubble(4, 4, 40, 32)], knock: [qmark(24, 18, 1.15)] }),
  bingotrivia: () => ({ fill: [<rect key="c" x="3" y="12" width="24" height="24" rx="2.5" />, <circle key="q" cx="35" cy="17" r="11" />], knock: [<rect key="a" x="7" y="16" width="6" height="6" />, <circle key="b" cx="20" cy="19" r="3" />, <circle key="c2" cx="10" cy="29" r="3" />, <rect key="d" x="17" y="26" width="6" height="6" />, qmark(35, 15.6, 0.72, "qq")] }),
  livecalls: () => ({ fill: [<circle key="w" cx="24" cy="27" r="17" />, <rect key="b" x="20" y="4" width="8" height="4" rx="1.5" />, <rect key="s" x="22.6" y="7" width="2.8" height="4" />], knock: [bolt(22.4, 17, 0.95)] }),
  traitors: () => ({ fill: [<path key="m" d="M3 18c6-4 14-4 21 1 7-5 15-5 21-1 0 9-4 15-11 15-5 0-7-4-10-4s-5 4-10 4C7 33 3 27 3 18z" />, <rect key="st" x="38" y="28" width="3" height="16" rx="1.5" transform="rotate(-20 40 36)" />], knock: [<ellipse key="e1" cx="14" cy="22" rx="5" ry="3.4" />, <ellipse key="e2" cx="34" cy="22" rx="5" ry="3.4" />] }),
  host: () => ({ fill: [<rect key="h" x="16" y="3" width="16" height="25" rx="8" />, <path key="a" d="M11 22h3a10 10 0 0 0 20 0h3a13 13 0 0 1-11.4 12.9V40h6v4H17.4v-4h6v-5.1A13 13 0 0 1 11 22z" />], knock: [<rect key="g1" x="16" y="10" width="7" height="2" />, <rect key="g2" x="16" y="15" width="7" height="2" />] }),
  majority: () => only([bust(7, 20, 0.58, "a"), bust(17, 16, 0.66, "b"), bust(31, 16, 0.66, "c"), bust(41, 20, 0.58, "d"), bust(24, 18, 0.95, "e"), check(18, 1, 0.9)]),
  bounty: () => ({ fill: [star(24, 24, 21)], knock: [<circle key="c" cx="24" cy="25" r="6.4" />] }),
  twist: () => ({ fill: [<rect key="d" x="5" y="13" width="28" height="28" rx="5" />, <path key="a" d="M30 4a14 14 0 0 1 14 14h4l-6.6 7-6.4-7h4a9 9 0 0 0-9-9z" />], knock: [<circle key="p1" cx="12" cy="20" r="2.6" />, <circle key="p2" cx="19" cy="27" r="2.6" />, <circle key="p3" cx="26" cy="34" r="2.6" />, <circle key="p4" cx="26" cy="20" r="2.6" />, <circle key="p5" cx="12" cy="34" r="2.6" />] }),
  solo: () => only([<path key="l" d="M18 3h12l9 21H9z" opacity=".38" />, bust(24, 22, 1.05)]),
  beatbot: () => merge(robot(17, 10, 1.05), { fill: <circle key="c" cx="36" cy="33" r="9" />, knock: check(31.6, 28.4, 0.8) }),
  minis: () => only([<rect key="a" x="3" y="17" width="12" height="12" rx="2" />, <circle key="b" cx="24" cy="23" r="7" />, <path key="c" d="M39 15l7.6 14H31.4z" />, <rect key="u" x="3" y="36" width="42" height="3" rx="1.5" />]),
  halves: () => ({ fill: [<path key="a" d="M21 4.2A20 20 0 0 0 21 43.8z" />, <path key="b" d="M27 4.2A20 20 0 0 1 27 43.8z" />], knock: [<path key="bh" d="M27 9.6a14.6 14.6 0 0 1 0 28.8z" />] }),
  redraft: () => only([bust(24, 14, 0.75, "fig"), <path key="t" d="M24 4a20 20 0 0 1 19 14l3-1-1 9-7-5 2.6-1A15.4 15.4 0 0 0 24 8.6z" />, <path key="b" d="M24 44A20 20 0 0 1 5 30l-3 1 1-9 7 5-2.6 1A15.4 15.4 0 0 0 24 39.4z" />]),
  twoshows: () => only([tv(3, 9, 19, 15, "a"), tv(26, 9, 19, 15, "b"), <rect key="l" x="20" y="15.4" width="8" height="2.6" rx="1.3" />, <rect key="ba" x="3" y="34" width="42" height="3" rx="1.5" opacity=".38" />]),
  none: () => ({ fill: [<circle key="c" cx="24" cy="24" r="16" />], knock: [<circle key="h" cx="24" cy="24" r="11.6" />, <rect key="s" x="8" y="21.8" width="32" height="4.4" transform="rotate(45 24 24)" />] }),
  // A sport's own: categories, roto, a bracket, squares; and a trophy for pick'em.
  "s-cats": () => only([<rect key="a" x="5" y="24" width="7" height="18" rx="1" />, <rect key="b" x="15" y="12" width="7" height="30" rx="1" />, <rect key="c" x="25" y="20" width="7" height="22" rx="1" />, <rect key="d" x="35" y="6" width="7" height="36" rx="1" />]),
  "s-roto": () => ({ fill: [<path key="g" d="M4 34a20 20 0 0 1 40 0z" />, <rect key="n" x="22.6" y="11" width="2.8" height="23" rx="1.4" transform="rotate(40 24 34)" />], knock: [<path key="i" d="M11 34a13 13 0 0 1 26 0z" />] }),
  "s-bracket": () => only([<path key="l" d="M3 8h10v8h8v-3h4v22h-4v-3h-8v8H3v-3h7V30H3v-3h10v-8h8v-3h-8V11H3z" />, <path key="r" d="M25 22.6h8V19h4v10h-4v-3.4h-8z" />, <rect key="w" x="38" y="20" width="7" height="8" rx="1" />]),
  "s-squares": () => ({ fill: [<rect key="g" x="4" y="4" width="40" height="40" rx="2" />], knock: [0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => (r === 1 && c === 2 ? null : <rect key={`${r}${c}`} x={6.5 + c * 9.6} y={6.5 + r * 9.6} width="7.4" height="7.4" />))) }),
  trophy: () => ({ fill: [<path key="c" d="M14 5h20v10a10 10 0 0 1-20 0z" />, <path key="h" d="M9 8h5v4H12a2 2 0 0 0 2 2v4a6 6 0 0 1-5-6zM39 8h-5v4h2a2 2 0 0 1-2 2v4a6 6 0 0 0 5-6z" />, <rect key="s" x="21.6" y="24" width="4.8" height="9" />, <rect key="b" x="13" y="33" width="22" height="9" rx="1.5" />], knock: [star(24, 13, 4.4)] }),
};
/** A sport's base that shares a show base's idea draws its icon. */
const SAME: Record<string, string> = { "s-season": "h2h", "s-best": "bestball", "s-short": "fantasy", "s-pickem": "trophy", "s-few": "picks", "s-props": "sheet", "s-ou": "overunder", "s-bank": "bank", "s-live": "livecalls" };

/** A change's icon word, drawn: the bases' pictograms where one fits, else a plain mark. */
const WORD: Record<string, string> = {
  couch: "coop", teams: "teams", pair: "pairs", person: "solo", bot: "vsbot", plus: "fantasy", trophy: "trophy", versus: "h2h", calendar: "bingo", cut: "guillotine", flag: "race",
  heart: "lives", hands: "coop", streak: "pool", chart: "market", grid: "s-cats", rows: "confidence", none: "none", chat: "calls", coin: "double", double: "double", bank: "bank", pie: "split",
  one: "solo", link: "parlay", ticket: "props", jackpot: "jackpot", team: "fantasy", order: "bootorder", tag: "cap", spread: "spread", slot: "pairs", keep: "keeper", swap: "redraft", filter: "objectives",
  target: "objectives", repeat: "norepeat", two: "pairs", sheet: "sheet", star: "seasonpred", book: "quote", check: "sheet", crown: "seasonpred", times: "double", reverse: "reverse", join: "redraft",
  mask: "traitors", mic: "host", dice: "twist", crowd: "majority", clock: "livecalls", redraft: "redraft", shuffle: "redraft", halves: "halves", stack: "minis", tv: "twoshows", door: "keeper", eye: "solo",
};

export function Pictogram({ id, className = "size-11" }: { id: string; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const key = ART[id] ? id : SAME[id] ?? WORD[id] ?? id;
  const art = ART[key]?.() ?? null;
  if (!art) return <svg viewBox="0 0 48 48" className={className} aria-hidden><rect x="10" y="10" width="28" height="28" rx="4" fill="currentColor" opacity=".3" /></svg>;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden fill="currentColor">
      {art.knock && (
        <defs>
          <mask id={`k${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
            <rect width="48" height="48" fill="white" />
            <g fill="black">{art.knock}</g>
          </mask>
        </defs>
      )}
      <g mask={art.knock ? `url(#k${uid})` : undefined}>{art.fill}</g>
    </svg>
  );
}

/** Every pictogram's id, for the contact sheet the round's check draws. */
export const PICTOGRAMS = Object.keys(ART);
