"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import showcase from "./showcase.json";
import { api } from "@/lib/api";
import { publicMediaSrc } from "@/lib/game/selectors";
import { resolveArtStyle, type ArtStyle } from "@/lib/show-art-style";
import "./landing.css";

// The signed-out front door at "/" (AuthGate renders it when there's no session cookie). It's what a
// first-time visitor and a search engine see, so it's server-rendered with its own metadata and FAQ
// JSON-LD, and leads with "free, any show, DIY". Sign in lives at /sign-in, creating an account at
// /account. Every face and number comes from real seasons (showcase.json, exported by
// scripts/dev-test/export-showcase.js); the people on "your couch" are made-up demo names.
// Ported from .impeccable/mocks/overdrive/landing.html.

type Castaway = (typeof showcase.seasons)[number]["cast"][number];
const season = (slug: string, n: number) => showcase.seasons.find((s) => s.slug === slug && s.season === n)!;
const S51 = season("survivor", 51);
const S49 = season("survivor", 49);
const TRT = season("the-traitors-us", 5);
const CHL = season("the-challenge", 37);
const by = (s: typeof S51, n: string) => s.cast.find((c) => c.name.startsWith(n))!;
const first = (n: string) => n.split(" ")[0];
const tribeColor = (s: typeof S51, t: string | null) => (t && (s.tribes as Record<string, string>)[t]) || "#888";

const ROLL = ["Survivor", "The Traitors", "The Challenge", "Big Brother", "Love Island", "Drag Race", "your show"];
const TICKER = ["Survivor", "The Traitors", "The Challenge", "Big Brother", "Love Island", "RuPaul's Drag Race", "The Amazing Race", "Dancing with the Stars", "Below Deck", "Your show"];
const COUCH = { maya: "#a76bb0", dev: "#d9704a", you: "#45a89a", sam: "#5089c9", priya: "#e56b9f" };

const FAQ: [string, string][] = [
  ["Is Game Your Show really free?", "Yes. Every show, every game type, every player and every feature is free. An optional Autopilot can run the weekly results research for you, but nothing is locked behind it and the free way works just as well."],
  ["Which shows can I play?", "Survivor, The Traitors and The Challenge are ready with casts and results filled in for you. Any other show you add yourself with one copy and paste: Big Brother, Love Island, Drag Race, The Amazing Race, Dancing with the Stars and more."],
  ["Do I need a paid AI subscription to add a show?", "No. Any AI chat that can search the web works, including the free versions of ChatGPT, Claude and Gemini."],
  ["What if I watch the episode later?", "Nothing gets spoiled. Results, standings and chat stay hidden for you until you tap Reveal. You can even start a catch-up league on a season that already aired and play it episode by episode."],
  ["How many people can play?", "Any number. Most couches have three to six people; the games work just as well with twenty or more, and computer players can fill empty seats."],
  ["Do I need to download an app?", "No. It runs in your phone's browser, and you can add it to your home screen so it opens like an app."],
];
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Game Your Show",
    url: "https://www.gameyourshow.com/",
    applicationCategory: "GameApplication",
    operatingSystem: "Any (web, installable)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: "Turn any TV show into a fantasy game you play with friends: draft the cast, set weekly lineups, pick who survives, play episode bingo.",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  },
];

const Chev = () => <svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>;
const Tick = () => <svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" /></svg>;
const Plus = () => <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
const Cup = () => <svg viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0zM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M12 14v4M8 21h8" /></svg>;
const Star = ({ off }: { off?: boolean }) => <svg viewBox="0 0 24 24" className={off ? "o" : undefined}><path d="m12 2 3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" /></svg>;

function Photo({ c, size = 240, className }: { c: Castaway; size?: number; className?: string }) {
  return c.photo ? <Image src={c.photo} alt="" width={size} height={size} sizes={`${size}px`} className={className} /> : null;
}

export function LandingPage({ onTour }: { onTour: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Scroll reveals and the header hairline.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.18 });
    el.querySelectorAll(".reveal-up, .faces, .ranks").forEach((n) => io.observe(n));
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <div className="gys-landing dark" ref={root}>
      {JSON_LD.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j).replace(/</g, "\\u003c") }} />
      ))}

      <header className={`top${scrolled ? " scrolled" : ""}`}>
        <div className="wrap in">
          <Link className="mark cap" href="/" aria-label="Game Your Show home"><span className="o">Game</span><span className="w">Your</span><span className="o">Show</span></Link>
          {/* Preview: a quiet nod that what's here is still arriving, without a banner shouting it. */}
          <span className="preview" title="An early look: some of what's on this page is still on its way."><i />Preview</span>
          <nav aria-label="Sections"><a href="#how">How it works</a><a href="#play">Ways to play</a><a href="#any">Any show</a><a href="#free">Free</a></nav>
          <div className="right"><Link className="signin" href="/sign-in">Sign in</Link><Link className="btn pri" href="/account">Start free</Link></div>
        </div>
      </header>

      <main>
        <Hero onTour={onTour} />
        <div className="ticker" aria-label="Shows you can play"><div className="row">{[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}</span>)}</div></div>
        <HowItWorks />
        <WaysToPlay />
        <SpoilerSafe />
        <AnyShow />
        <Couch />
        <WatchAlong />
        <Free />
        <section className="sec" aria-labelledby="faq-h">
          <div className="wrap faq">
            <h2 id="faq-h" className="cap kick-h reveal-up" style={{ marginBottom: 28 }}>Questions</h2>
            {FAQ.map(([q, a]) => (
              <details key={q} className="reveal-up"><summary>{q}<Plus /></summary><p>{a}</p></details>
            ))}
          </div>
        </section>
        <section className="final" aria-labelledby="fin-h">
          <div className="wrap">
            <h2 id="fin-h" className="cap">Pick a show. Make it a game.</h2>
            <p>Bring your couch. It takes two minutes, it&apos;s free, and the next episode is closer than you think.</p>
            <div className="ctas"><Link className="btn pri" href="/account">Start a couch<Chev /></Link><Link className="btn out" href="/account">Join with a code</Link></div>
          </div>
          <div className="faces2" aria-hidden="true">
            {[...S51.cast.slice(5, 9), ...TRT.cast.slice(0, 4), ...S49.cast.slice(0, 4)].map((c) => <Photo key={c.name} c={c} size={220} />)}
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap in">
          <Link className="mark cap" href="/" aria-label="Game Your Show"><span className="o">Game</span><span className="w">Your</span><span className="o">Show</span></Link>
          <nav aria-label="Footer"><a href="#how">How it works</a><a href="#play">Ways to play</a><a href="#any">Any show</a><a href="#free">Free</a><Link href="/sign-in">Sign in</Link></nav>
          <p className="legal">
            Game Your Show is in preview: some of what you see here is still being built. It&apos;s a fan-made game and isn&apos;t affiliated with, endorsed by or sponsored by any network, studio or show. Show names and cast likenesses belong to their respective owners.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ---------------- hero ----------------
function Hero({ onTour }: { onTour: () => void }) {
  const roll = useRef<HTMLSpanElement>(null);

  // The show name rolls on the plate, sized once to the longest name so nothing moves, and lands
  // on "your show".
  useEffect(() => {
    const r = roll.current;
    if (!r) return;
    // Measured once the webfont is in (the fallback is narrower), and again on resize. The plate's
    // type shrinks when the longest name won't fit the column (wide desktop headlines).
    const size = () => {
      r.style.fontSize = "";
      const probe = document.createElement("span");
      probe.style.visibility = "hidden";
      r.appendChild(probe);
      const fs = parseFloat(getComputedStyle(r).fontSize);
      const widest = Math.max(...ROLL.map((n) => { probe.textContent = n; return probe.offsetWidth; })) / fs + 0.55;
      probe.remove();
      const room = (r.parentElement?.clientWidth ?? 0) / fs;
      r.style.fontSize = `${Math.min(1, room / widest)}em`;
      r.style.width = `${widest}em`;
    };
    size();
    document.fonts?.ready.then(size);
    window.addEventListener("resize", size);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { r.firstElementChild!.textContent = ROLL.at(-1)!; return () => window.removeEventListener("resize", size); }
    let i = 0;
    const t = setInterval(() => {
      if (i >= ROLL.length - 1) return clearInterval(t);
      const old = r.firstElementChild as HTMLElement;
      i++;
      const nu = document.createElement("span");
      nu.textContent = ROLL[i];
      nu.style.transform = "translateY(110%)";
      r.appendChild(nu);
      requestAnimationFrame(() => { old.style.transform = "translateY(-110%)"; old.style.opacity = "0"; nu.style.transform = ""; });
      setTimeout(() => old.remove(), 600);
    }, 1700);
    return () => { clearInterval(t); window.removeEventListener("resize", size); };
  }, []);

  const withSeason = (s: typeof S51) => s.cast.filter((c) => c.photo).map((c) => ({ c, s }));
  const rows = [
    [...withSeason(S51), ...withSeason(TRT).slice(0, 6)],
    [...withSeason(TRT), ...withSeason(S49).slice(0, 6)],
    withSeason(CHL).slice(0, 20),
  ];
  return (
    <section className="hero" aria-labelledby="h1">
      <div className="wrap grid">
        <div>
          <span className="tag cap">Free for your whole couch</span>
          <h1 id="h1" className="cap" style={{ marginTop: 18 }} aria-label="Turn any TV show into a game">
            <span className="ln" aria-hidden="true">Turn</span>
            <span className="roll" ref={roll} aria-hidden="true"><span>{ROLL[0]}</span></span>
            <span className="ln" aria-hidden="true">into a game.</span>
          </h1>
          <p className="lede">Draft the cast. Set a lineup every week. Call who goes home, play bingo while you watch, and find out who on your couch <b>really</b> knows the show. <b>Free, for any show you bring.</b></p>
          <div className="ctas" id="start">
            <Link className="btn pri" href="/account">Start a couch<Chev /></Link>
            <Link className="btn out" href="/account">Join with a code</Link>
          </div>
          <div className="fine">
            <span><Tick />No credit card</span><span><Tick />No app store, works on any phone</span><span><Tick />Never spoiled</span>
            <button type="button" onClick={onTour} className="tourlink">Take the 5-minute tour</button>
          </div>
        </div>
        <div className="wall" aria-hidden="true">
          {rows.map((row, ri) => (
            <div key={ri} className={`wrow${ri % 2 ? " rev" : ""}`} style={{ "--d": `${70 + ri * 12}s` } as React.CSSProperties}>
              {[...row, ...row].map(({ c, s }, k) => {
                return (
                  <div key={k} className="wcell">
                    <Photo c={c} size={190} />
                    <span className="nm"><span className="cap">{first(c.name)}</span><small>{s.show.replace(/ \(US\)$/, "")} {s.season}</small></span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------- how it works ----------------
function HowItWorks() {
  const picks: [string, string, string][] = [
    ["Survivor", "Survivor", "Season 51 · Wed"],
    ["The Traitors", "The Traitors", "Season 5 · Thu"],
    ["The Challenge", "The Challenge", "Season 37"],
  ];
  // The show's own artwork (the same art the front door's show roll uses), not a cast photo. Until
  // it arrives, or for a show without any, the tile is the plain panel.
  const [art, setArt] = useState<Record<string, { src: string; style: ArtStyle | null }>>({});
  useEffect(() => {
    let live = true;
    api.showArt().then(({ shows }) => {
      const out: typeof art = {};
      for (const [match] of picks) {
        const hit = shows.find((x) => x.name.toLowerCase().startsWith(match.toLowerCase()));
        const src = publicMediaSrc(hit?.artUrl);
        if (hit && src) out[match] = { src, style: hit.artStyle };
      }
      if (live) setArt(out);
    }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- picks is a constant
  }, []);
  return (
    <section className="sec" id="how" aria-labelledby="how-h">
      <div className="wrap">
        <h2 id="how-h" className="cap kick-h reveal-up">Three taps to<br />episode night.</h2>
        <div className="steps">
          <div className="step reveal-up">
            <span className="num n">01</span><h3 className="cap">Pick a show</h3>
            <p>Survivor, The Traitors and The Challenge are ready with the full cast and scoring. Anything else, you add yourself in a couple of minutes.</p>
            <div className="phone"><div className="ph-h cap">Pick a show <small>Step 1 of 4</small></div>
              <div className="showgrid">
                {picks.map(([m, n, se], i) => {
                  const a = art[m];
                  const st = resolveArtStyle(a?.style);
                  return (
                    <div key={n} className={`sp${i === 0 ? " sel" : ""}`}>
                      {a && (
                        // eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL
                        <img src={a.src} alt="" style={{ objectPosition: `${st.x}% 50%` }} />
                      )}
                      <b className="cap">{n}</b><small>{se}</small>
                    </div>
                  );
                })}
                <div className="sp add"><b className="cap" style={{ fontSize: 16 }}>+ Any show</b><small>Add it yourself</small></div>
              </div>
            </div>
          </div>
          <div className="step reveal-up">
            <span className="num n">02</span><h3 className="cap">Start a couch</h3>
            <p>Your couch is your group: the people you play every show with. Send one code. Three friends or thirty, everyone&apos;s in.</p>
            <div className="phone"><div className="ph-h cap">Your couch <small>3 of 4 joined</small></div>
              <div className="invite"><span className="tag cap" style={{ fontSize: 12 }}>Invite</span><div className="code num">K7Q2</div><div style={{ fontSize: 13, color: "var(--plate-muted)" }}>Couch Council · Survivor 51</div></div>
              <div className="seats">
                <span className="seat"><i style={{ background: COUCH.you }}>Y</i>You</span><span className="seat"><i style={{ background: COUCH.maya }}>M</i>Maya</span><span className="seat"><i style={{ background: COUCH.dev }}>D</i>Dev</span><span className="seat empty"><i>+</i>Seat</span>
              </div>
              <div className="miniplate"><span className="t cap">Draft</span><span className="b"><b className="cap">Wed 7:30 PM</b><small>Snake draft · you pick 2nd</small></span></div>
            </div>
          </div>
          <div className="step reveal-up">
            <span className="num n">03</span><h3 className="cap">Play every episode</h3>
            <p>Set your lineup before it airs. Results come in after, and nobody sees them until they choose to.</p>
            <div className="phone"><div className="ph-h cap">Starting <small>Locks Wed 8:05 PM</small></div>
              <div className="tiles">
                {["Kristin", "Mike", "Brady"].map((n) => { const c = by(S51, n); return <div key={n} className="tile"><Photo c={c} size={160} /><div className="cap">{n}</div><small><i style={{ background: tribeColor(S51, c.tribe) }} />{c.tribe}</small></div>; })}
              </div>
              <div className="miniplate"><span className="t cap" style={{ background: "var(--good)", color: "var(--good-ink)" }}>You</span><span className="b"><b className="cap">+12.5 last week</b><small>Tied for 1st on your couch</small></span></div>
              <div className="pl8">
                {([["Maya", COUCH.maya, 38, "T1"], ["You", COUCH.you, 38, "T1", true], ["Dev", COUCH.dev, 31, "3"]] as const).map(([n, c, t, r, me], i) => (
                  <div key={n} className={`srow${me ? " me" : ""}${i === 0 ? " lead" : ""}`}><span className="r num">{r}</span><span className="d" style={{ background: c }} />{n}<span className="t num">{t}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- ways to play ----------------
const BINGO = ["Dig deep", "Idol", "Blindside", "Tears", "Tree mail", "Rain", "Fire talk", '"No friends"', "Medical", "Swap?", "Food", "Well chat", "FREE", "Advantage", "Jury", "Puzzle", "Vote split", "Spoken", "Shot in dark", "Chicken", "Falls", "Rice", "Loved one", "Drone", "LOL"];
function WaysToPlay() {
  return (
    <section className="sec" id="play" aria-labelledby="play-h" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <h2 id="play-h" className="cap kick-h reveal-up">Play it your way.</h2>
        <p className="lede reveal-up">Run a whole season, or just play along one episode at a time. Every game works for any show, and you can run several at once on the same couch.</p>
        <div className="games">
          <article className="game reveal-up"><span className="tag cap q">Season game</span><h3 className="cap">Classic</h3>
            <p>Snake-draft a team. Every castaway earns points for every boot they outlast, so the last one standing carries you.</p>
            <div className="vis">
              {["Savannah", "Sophi", "Jawan"].map((n) => { const c = by(S49, n); const out = !!c.exitEp && c.exitEp < 13; return (
                <div key={n} className={`teamrow${out ? " out" : ""}`}><Photo c={c} size={110} /><div className="pl"><b className="cap">{first(c.name)}</b>
                  <small>{out ? <><span className="chip" style={{ background: "var(--live)", color: "var(--live-ink)" }}>Out</span> Episode {c.exitEp}</> : <><span className="chip" style={{ background: "var(--chyron)", color: "var(--ink)" }}>Finale</span> made it to the end</>}</small></div></div>); })}
            </div>
          </article>
          <article className="game reveal-up"><span className="tag cap q">Season game</span><h3 className="cap">Active Roster</h3>
            <p>Draft a roster, then start your best each week before it airs. Only starters score, so every episode is a decision.</p>
            <div className="vis">
              <div className="tiles">{["Brady", "Maggie", "Sharonda"].map((n) => { const c = by(S51, n); return <div key={n} className="tile"><Photo c={c} size={160} /><div className="cap">{first(c.name)}</div><small><i style={{ background: tribeColor(S51, c.tribe) }} />{c.total} pts</small></div>; })}</div>
              <div className="miniplate"><span className="t cap">Lineup</span><span className="b"><b className="cap">Locks Wed 8:05 PM</b><small>Start 3 · bench 2</small></span></div>
            </div>
          </article>
          <article className="game reveal-up"><span className="tag cap q">Season game</span><h3 className="cap">Elimination Pool</h3>
            <p>No draft. Each episode, pick one person you think survives. You can&apos;t pick them again. Longest streak wins.</p>
            <div className="vis">
              <div className="streak"><span className="num">4</span><span className="muted" style={{ paddingBottom: 12 }}>in a row</span></div>
              <div className="picks">
                {["Kristin", "Maggie", "Brady", "Eric"].map((n, i) => <div key={n} className={`pickf ${i < 3 ? "ok" : "now"}`}><Photo c={by(S51, n)} size={124} />{i < 3 && <b>✓</b>}</div>)}
                <div className="pickf nx" style={{ width: 62 }}>+</div>
              </div>
            </div>
          </article>
        </div>
        <div className="episode-games">
          <div className="eg reveal-up"><span className="tag cap" style={{ background: "#e56b9f", color: "var(--ink)", alignSelf: "flex-start" }}>Every episode</span><h4 className="cap">Predictions</h4><p>One-tap calls before it airs. Scored after.</p>
            <div><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Who goes home?</div>
              <div className="opts">{["Thien", "Carter", "Danny"].map((n, i) => <span key={n} className={`opt${i === 1 ? " on" : ""}`}><Photo c={by(S51, n)} size={56} />{n}</span>)}</div></div></div>
          <div className="eg reveal-up"><span className="tag cap" style={{ alignSelf: "flex-start" }}>Every episode</span><h4 className="cap">Bingo</h4><p>A fresh card for the show&apos;s clichés. First line gets bragging rights.</p>
            <div className="bingo">{BINGO.map((b, i) => <i key={b} className={i === 12 ? "f" : [0, 6, 18, 24, 2, 9].includes(i) ? "m" : undefined}>{b}</i>)}</div></div>
          <div className="eg reveal-up"><span className="tag cap good" style={{ alignSelf: "flex-start" }}>Every episode</span><h4 className="cap">Watch along</h4><p>Your couch&apos;s comments, in sync with where you are.</p>
            <div>{([["M", COUCH.maya, "Maya", "21:40", "Kristin is SO calm"], ["D", COUCH.dev, "Dev", "21:56", "that challenge setup is brutal"]] as const).map(([a, c, n, t, x]) => <div key={t} className="cm"><span className="a" style={{ background: c }}>{a}</span><div><small>{n} at {t}</small>{x}</div></div>)}</div></div>
          <div className="eg reveal-up"><span className="tag cap" style={{ background: "#8f84d8", color: "var(--ink)", alignSelf: "flex-start" }}>Every episode</span><h4 className="cap">Rate it</h4><p>Two seconds after the credits. Then the couch verdict.</p>
            <div><div className="stars"><Star /><Star /><Star /><Star /><Star off /></div><div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}><b style={{ color: "var(--bone)", fontSize: 22 }} className="num">4.5</b> couch verdict · you agree</div></div></div>
        </div>
      </div>
    </section>
  );
}

// ---------------- spoiler gate + the Survivor 49 replay ----------------
const RACE_COL = ["#ffc531", "#35b5a5", "#e56b9f", "#5089c9", "#f2804b", "#a76bb0"];
function SpoilerSafe() {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState(0); // progress through the season, 0 .. episodes-1
  const [done, setDone] = useState(false);
  const top = [...S49.cast].sort((a, b) => b.total - a.total).slice(0, 6);
  const N = S49.episodesScored, W = 520, H = 300, PL = 8, PR = 110, PT = 10, PB = 24;
  const cum = top.map((c) => c.perEp.reduce<number[]>((a, v) => (a.push((a.at(-1) ?? 0) + v), a), []));
  const max = Math.max(...cum.flat());
  const X = (i: number) => PL + ((W - PL - PR) * i) / (N - 1);
  const Y = (v: number) => PT + (H - PT - PB) * (1 - v / max);

  function reveal() {
    setOpen(true);
    const t0 = performance.now() + 350, dur = 4200;
    const step = (now: number) => {
      const k = Math.max(0, Math.min((now - t0) / dur, 1));
      setP((k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) * (N - 1));
      if (k < 1) requestAnimationFrame(step);
      else setDone(true);
    };
    requestAnimationFrame(step);
  }
  const at = (c: number[]) => {
    const i = Math.min(Math.floor(p), N - 1), f = p - i;
    const v = i < N - 1 ? c[i] + (c[i + 1] - c[i]) * f : c[N - 1];
    const x = i < N - 1 ? X(i) + (X(i + 1) - X(i)) * f : X(N - 1);
    let d = `M${X(0)},${Y(c[0])}`;
    for (let j = 1; j <= i; j++) d += ` L${X(j)},${Y(c[j])}`;
    return { v, x, d: `${d} L${x},${Y(v)}` };
  };
  const winner = top[0];
  return (
    <section className="sec" aria-labelledby="sp-h" style={{ background: "linear-gradient(180deg,var(--ground),#120f18)" }}>
      <div className="wrap spoil">
        <div className="reveal-up">
          <span className="tag cap good">Spoiler-safe</span>
          <h2 id="sp-h" className="cap kick-h" style={{ marginTop: 16 }}>Watch Thursday.<br />Still win.</h2>
          <p className="lede">When results come in, everyone gets a nudge, not a headline. <b>Nothing shows until you tap Reveal</b>: not the standings, not the chat, not your score. Watch live, watch late, or binge a whole season you missed and play it as if it were airing.</p>
          <p className="lede" style={{ fontSize: 15 }}>Try it: this is a real season, scored by real games.</p>
        </div>
        <div className={`gate reveal-up${open ? " open" : ""}`}>
          <div className="lock">
            <span className="tag cap" style={{ alignSelf: "flex-start" }}>Survivor 49 · Finale</span>
            <h3 className="cap" style={{ fontSize: 40 }}>Results are in</h3>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.5 }}>{N} episodes, {S49.cast.length} castaways, every point from every game on this season. Hidden until you say so.</p>
            <div className="ghost" /><div className="ghost s" /><div className="ghost" /><div className="ghost s" />
            <button type="button" className="revealbtn" onClick={reveal}>Reveal Survivor 49</button>
            <small className="muted" style={{ textAlign: "center" }}>Aired fall 2025</small>
          </div>
          <div className="race" aria-live="polite">
            <div className="race-top"><span className="cap muted" style={{ fontSize: 14 }}>Top scorers, episode by episode</span><span className="num ep">EP {Math.min(N, Math.floor(p) + 1)}</span></div>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cumulative points for Survivor 49's top scorers across ${N} episodes`}>
              <defs>{top.map((_, k) => <clipPath key={k} id={`gys-cp${k}`}><circle r={13} /></clipPath>)}</defs>
              {[0, 25, 50, 75].map((v) => <line key={v} x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="#2e2a3a" />)}
              {Array.from({ length: Math.ceil(N / 2) }, (_, k) => k * 2).map((i) => <text key={i} x={X(i)} y={H - 6} className="axis" textAnchor="middle">EP {i + 1}</text>)}
              {cum.map((c, k) => <path key={k} className="ln" stroke={RACE_COL[k]} d={open ? at(c).d : ""} />)}
              {open && cum.map((c, k) => { const { v, x } = at(c); return (
                <g key={k} transform={`translate(${x},${Y(v)})`}>
                  <circle r={15} fill={RACE_COL[k]} />
                  {top[k].photo && <image href={top[k].photo!} width={26} height={26} x={-13} y={-13} clipPath={`url(#gys-cp${k})`} />}
                  <text x={20} y={4} className="lbl" fill={RACE_COL[k]}>{first(top[k].name)} {Math.round(v)}</text>
                </g>); })}
            </svg>
            <div className={`winner${done ? " on" : ""}`}>
              <Photo c={winner} size={144} />
              <div className="pl"><span className="t cap">Top scorer</span><span className="b"><b className="cap">{winner.name}</b><small>{winner.total} points across {N} episodes</small></span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- any show (DIY) ----------------
function AnyShow() {
  return (
    <section className="sec" id="any" aria-labelledby="any-h">
      <div className="wrap diy">
        <div>
          <span className="tag cap reveal-up">Do it yourself</span>
          <h2 id="any-h" className="cap kick-h reveal-up" style={{ marginTop: 16 }}>Any show.<br />Yes, that one.</h2>
          <p className="lede reveal-up">Other fantasy apps pick the shows for you. Here, <b>you bring the show</b>. One copy and paste turns any season into a playable game: the cast, the groups, what scores and how much.</p>
          <div className="paste reveal-up">
            <div className="pst"><span className="n num">1</span><div><b>Copy our prompt</b><p>Name the show and season. We write the research question for you.</p></div></div>
            <div className="pst"><span className="n num">2</span><div><b>Paste it into any AI chat</b><p>One that can search the web. The free versions are plenty.</p><div className="ai"><span>ChatGPT</span><span>Claude</span><span>Gemini</span><span>Whatever you use</span></div></div></div>
            <div className="pst"><span className="n num">3</span><div><b>Paste the answer back</b><p>We build the cast, the groups and the scoring. Check it, tweak any rule, and draft.</p></div></div>
          </div>
          <div className="showchips reveal-up" aria-label="Shows">
            {["Survivor", "The Traitors", "The Challenge"].map((s) => <span key={s} className="ready">{s}</span>)}
            {["Big Brother", "Love Island", "RuPaul's Drag Race", "The Amazing Race", "Dancing with the Stars"].map((s) => <span key={s}>{s}</span>)}
            {["Below Deck", "Real Housewives", "Award shows", "Your show"].map((s) => <span key={s} className="soon">{s}</span>)}
          </div>
          <p className="muted reveal-up" style={{ fontSize: 13, marginTop: 10 }}>White: ready to play, results filled in for you. Solid: added by players. Dashed: series, talk and live events, coming next.</p>
        </div>
        <div className="reveal-up">
          <div className="faces">{CHL.cast.filter((c) => c.photo).map((c, i) => <div key={c.name} style={{ transitionDelay: `${i * 28}ms` }}><Image src={c.photo!} alt={c.name} width={120} height={120} sizes="120px" /></div>)}</div>
          <div className="facecap"><span>The Challenge 37, set up from one paste</span><b className="num">{CHL.cast.length}</b></div>
          <div className="miniplate" style={{ marginTop: 16 }}><span className="t cap" style={{ background: "var(--good)", color: "var(--good-ink)" }}>Ready</span><span className="b"><b className="cap">{CHL.cast.length} contestants · 18 scoring moments</b><small>Dailies, eliminations, the final. Edit anything before you draft.</small></span></div>
        </div>
      </div>
    </section>
  );
}

// ---------------- the couch ----------------
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Listing = { tm: string; tt: string; ep: string; col: string | null; c: Castaway | null; clash?: boolean };
const LISTINGS: Record<number, Listing[]> = {
  1: [{ tm: "8:00 PM", tt: "Below Deck", ep: "S12 · Ep 7", col: null, c: null }],
  2: [{ tm: "8:00 PM", tt: "The Challenge", ep: "S37 · Ep 7", col: "#5089c9", c: CHL.cast[4] }],
  3: [{ tm: "8:05 PM", tt: "Survivor", ep: "S51 · Ep 5", col: "#f2804b", c: by(S51, "Kristin") }],
  4: [
    { tm: "9:00 PM", tt: "The Traitors", ep: "S5 · Ep 4", col: "#c23a4b", c: TRT.cast[6], clash: true },
    { tm: "9:00 PM", tt: "Love Island", ep: "S7 · Ep 17", col: null, c: null, clash: true },
  ],
};
function ListingCard({ l }: { l: Listing }) {
  return (
    <div className={`lst${l.col ? "" : " watch"}`} style={l.col ? { background: l.col } : undefined}>
      {l.c && <Photo c={l.c} size={140} />}
      <span className="tm">{l.tm}</span><span className="tt">{l.tt}</span><span className="ep">{l.ep}{l.col ? "" : " · watching"}</span>
    </div>
  );
}
function Couch() {
  // The week starts today. Rendered after mount so the server's date can't disagree with the visitor's.
  const [days, setDays] = useState<Date[]>([]);
  useEffect(() => {
    const d0 = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDays(Array.from({ length: 6 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); return d; }));
  }, []);
  const ranks = [["Maya", COUCH.maya, 41, 38, 33], ["Priya", COUCH.priya, 44, 31, 29], ["You", COUCH.you, 52, 24, 18], ["Dev", COUCH.dev, 35, 32, 21], ["Sam", COUCH.sam, 30, 26, 22]] as const;
  return (
    <section className="sec couchsec" aria-labelledby="couch-h">
      <div className="wrap">
        <span className="tag cap q reveal-up">Your couch</span>
        <h2 id="couch-h" className="cap kick-h reveal-up" style={{ marginTop: 16 }}>Same friends.<br />Every show. Every season.</h2>
        <p className="lede reveal-up">A league ends with the finale. <b>A couch doesn&apos;t.</b> It keeps your people, your history and your rivalries, and lines up everything you&apos;re all watching this week.</p>
        <div className="couchgrid">
          <div className="reveal-up">
            <div className="cap muted" style={{ fontSize: 14, marginBottom: 10, letterSpacing: ".04em" }}>This week on the couch</div>
            <div className="guide">
              {days.map((d, i) => {
                const it = LISTINGS[d.getDay()] ?? [];
                const clash = it.filter((l) => l.clash);
                return (
                  <div key={i} className={`gday${i === 0 ? " today" : ""}`}>
                    <div className="dh cap"><b>{i === 0 ? "Today" : DAY[d.getDay()]}</b><small>{MONTH[d.getMonth()]} {d.getDate()}</small></div>
                    {clash.length > 1 ? (
                      <div className="clash"><em>Same time · 9:00 PM</em>{clash.map((l) => <ListingCard key={l.tt} l={l} />)}</div>
                    ) : it.length ? it.map((l) => <ListingCard key={l.tt} l={l} />) : (
                      <div className="lst watch" style={{ minHeight: 60, alignItems: "center", justifyContent: "center", color: "var(--field)" }}>Nothing on</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="ranks reveal-up">
            <h4 className="cap">Power rankings <small>Across every show this year</small></h4>
            {ranks.map(([n, c, a, b, cc], i) => { const t = a + b + cc; return (
              <div key={n} className={`rk${i === 0 ? " lead" : ""}${n === "You" ? " me" : ""}`}>
                <span className="r num">{i + 1}</span><span className="a" style={{ background: c }}>{n[0]}</span>
                <span className="nm">{n}<span className="bar" style={{ width: `${(t / 112) * 100}%` }}><i style={{ width: `${(a / t) * 100}%`, background: "#f2804b" }} /><i style={{ width: `${(b / t) * 100}%`, background: "#c23a4b", transitionDelay: ".15s" }} /><i style={{ width: `${(cc / t) * 100}%`, background: "#5089c9", transitionDelay: ".3s" }} /></span></span>
                <span className="t num">{t}</span>
              </div>); })}
            <div className="shelf">
              <div className="tro gold"><Cup /><b className="cap">Survivor 49</b><small>Maya won</small></div>
              <div className="tro"><Cup /><b className="cap">Traitors 4</b><small>You won</small></div>
              <div className="tro"><Cup /><b className="cap">Survivor 52</b><small>Run it back</small></div>
            </div>
          </div>
        </div>
        <div className="feat">
          <div className="reveal-up"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg><b>Run it back</b><p>New season, same people, same rules. One tap and everyone&apos;s in for the premiere.</p></div>
          <div className="reveal-up"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg><b>One chat, spoiler-proof</b><p>Messages after an episode stay folded for anyone who hasn&apos;t watched it yet.</p></div>
          <div className="reveal-up"><svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg><b>Explore without playing</b><p>Watching something nobody&apos;s drafted? Follow the stats and recaps up to your episode, then turn it into a game when you&apos;re hooked.</p></div>
        </div>
      </div>
    </section>
  );
}

// ---------------- watch along ----------------
const WA_COMMENTS = [
  ["M", COUCH.maya, "Maya", "21:40", "Kristin is SO calm, love it"],
  ["D", COUCH.dev, "Dev", "21:56", "that challenge setup is brutal"],
  ["M", COUCH.maya, "Maya", "22:13", "Thien looks nervous..."],
  ["S", COUCH.sam, "Sam", "22:30", "water well strategy talk incoming"],
  ["P", COUCH.priya, "Priya", "22:48", "IDOL CLUE"],
  ["D", COUCH.dev, "Dev", "23:06", "Jeff said dig deep, marking it"],
] as const;
function WatchAlong() {
  const [n, setN] = useState(2); // comments shown so far
  const [t, setT] = useState(21 * 60 + 40);
  useEffect(() => {
    const a = setInterval(() => setT((x) => x + 8), 1000);
    const b = setInterval(() => setN((x) => x + 1), 2600);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  const shown = Array.from({ length: Math.min(n, 5) }, (_, k) => n - Math.min(n, 5) + k);
  return (
    <section className="sec" aria-labelledby="wa-h">
      <div className="wrap wa">
        <div className="waphone reveal-up" aria-hidden="true">
          <div className="bar"><b className="cap">Survivor 51</b><small><i />On air · Ep 5</small></div>
          <div className="clk num">{Math.floor(t / 60)}:{String(t % 60).padStart(2, "0")}</div>
          <div className="pb"><i style={{ width: `${(t / 2580) * 100}%` }} /></div>
          <div className="note">Comments arrive 30s after the moment, never before</div>
          <div className="feed">
            {shown.map((k) => { const [a, c, nm, ts, x] = WA_COMMENTS[k % WA_COMMENTS.length]; return <div key={k} className="cm"><span className="a" style={{ background: c }}>{a}</span><div><small>{nm} at {ts}</small>{x}</div></div>; })}
          </div>
          <div className="tabs"><span className="on">Couch</span><span>Bingo 4</span><span>Lineup</span></div>
        </div>
        <div>
          <span className="tag cap live reveal-up">Watch along</span>
          <h2 id="wa-h" className="cap kick-h reveal-up" style={{ marginTop: 16 }}>The couch,<br />even when<br />it&apos;s not.</h2>
          <p className="lede reveal-up">Hit Start when your episode starts, live or streaming. Everything your couch said shows up <b>as you reach that moment</b>, never a second early.</p>
          <div className="bul reveal-up">
            <div><Tick /><span><b>Watch Thursday, feel Wednesday.</b> Late viewers get the whole couch&apos;s reactions, in sync.</span></div>
            <div><Tick /><span><b>Your games come with you.</b> Bingo card and lineup are a tap away, with scores hidden.</span></div>
            <div><Tick /><span><b>Built to be late, not early.</b> If anything&apos;s off, comments wait for you.</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- free ----------------
function Free() {
  const items = ["Every show, including yours", "Every game type", "Unlimited players", "Unlimited leagues and couches", "Custom scoring rules", "Chat, bingo, watch along", "Spoiler protection", "Results by copy and paste"];
  return (
    <section className="sec" id="free" aria-labelledby="free-h" style={{ background: "linear-gradient(180deg,var(--ground),var(--rail))" }}>
      <div className="wrap free">
        <div>
          <span className="tag cap good reveal-up">Free</span>
          <h2 id="free-h" className="cap kick-h reveal-up" style={{ marginTop: 16 }}>Free.<br />All of it.</h2>
          <p className="lede reveal-up">Not a trial, not a starter tier. Everything that makes the game work is free, for every player, for as many couches and seasons as you like.</p>
          <div className="freelist reveal-up">{items.map((x) => <div key={x}><Tick />{x}</div>)}</div>
        </div>
        <aside className="auto reveal-up" aria-labelledby="auto-h">
          <span className="tag cap q">Optional</span>
          <h3 id="auto-h" className="cap">Autopilot, for the commissioner</h3>
          <p>Someone on your couch fills in each episode&apos;s results. With copy and paste that takes a couple of minutes. Autopilot does it on a schedule instead, so the results are waiting the morning after and your commissioner just glances and approves.</p>
          <div className="cmp">
            <div><b>Free</b><ol><li>Copy the prompt</li><li>Paste into an AI chat</li><li>Paste back, approve</li></ol></div>
            <div className="a"><b>Autopilot</b><ol><li>Wake up</li><li>Approve</li></ol></div>
          </div>
          <p style={{ marginTop: 14, fontSize: 13 }}>Same app, same games either way. It only saves a few minutes a week.</p>
        </aside>
      </div>
    </section>
  );
}
