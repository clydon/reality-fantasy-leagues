"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import showcase from "@/components/landing/showcase.json";
import { useCatalog, type CatalogSeason } from "../data";
import { GAME_STYLE } from "../games";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { Wordmark } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { startWith } from "../way-in";
import { useHydrated, useReducedMotion } from "./hooks";
import "./welcome.css";

// The landing (/welcome, docs/PLAN-new-design.md step 9 part 2): a port of the mock's landing.js welcomeRoute, the
// front door distilled to a hero and six sections (three taps, ways to play, the couch and watch along, spoiler-safe,
// any show, free and questions), then the last call. Start free goes to first run (a show tile starts it with that
// show picked); Join with a code to the invite. Every face and number is a real season's (showcase.json, from
// scripts/dev-test/export-showcase.js); the people on "your couch" are demo names. A season still airing shows only its
// faces and starting tribes: the points and survivors come from finished seasons, so the front door never says how one
// on now is going.

type Castaway = (typeof showcase.seasons)[number]["cast"][number];
type Season = (typeof showcase.seasons)[number];
const seasonOf = (slug: string, n: number) => showcase.seasons.find((s) => s.slug === slug && s.season === n)!;
const S51 = seasonOf("survivor", 51);
const S49 = seasonOf("survivor", 49);
const TRT = seasonOf("the-traitors-us", 5);
const CHL = seasonOf("the-challenge", 37);
const by = (s: Season, name: string) => s.cast.find((c) => c.name.startsWith(name));
const some = (s: Season, names: string[]) => names.map((n) => by(s, n)).filter((c): c is Castaway => !!c);
const first = (name: string) => name.split(" ")[0];
const showName = (s: Season) => `${s.show.replace(/\s*\([^)]*\)$/, "")} ${s.season}`;

const ROLL = ["Survivor", "The Traitors", "The Challenge", "Big Brother", "Love Island", "Drag Race", "your show"];
const TICKER = ["Survivor", "The Traitors", "The Challenge", "Big Brother", "Love Island", "Drag Race", "The Amazing Race", "Below Deck", "Your show"];
const FAQ: [string, string][] = [
  ["Is it really free?", "Yes. Every show, every game type, every player. Nothing is locked behind Autopilot."],
  ["Which shows can I play?", "Survivor, The Traitors and The Challenge are ready to go. Any other show you can follow right away, and turn into a game with one copy and paste."],
  ["What if I watch later?", "Nothing gets spoiled. Results, standings and chat stay hidden for you until you tap Reveal."],
  ["Do I need an app?", "No. It runs in your phone's browser, and you can add it to your home screen."],
];
const COUCH = [
  ["M", "#a76bb0", "Maya", "Kristin is SO calm"],
  ["D", "#d9704a", "Dev", "that challenge setup is brutal"],
  ["M", "#a76bb0", "Maya", "Thien looks nervous..."],
  ["S", "#5089c9", "Sam", "water well strategy talk"],
  ["P", "#e56b9f", "Priya", "IDOL CLUE"],
  ["D", "#d9704a", "Dev", "Jeff said dig deep, marking it"],
] as const;

const Chev = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const Tick = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="m5 12 5 5 9-10" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const Cup = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M7 4h10v5a5 5 0 0 1-10 0zM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M12 14v4M8 21h8" />
  </svg>
);
const Star = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" className={off ? "o" : undefined} aria-hidden>
    <path d="m12 2 3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" />
  </svg>
);

// eslint-disable-next-line @next/next/no-img-element -- small, already-sized jpgs from public/landing
const Photo = ({ c, className }: { c: Castaway; className?: string }) => (c.photo ? <img src={c.photo} alt="" loading="lazy" decoding="async" className={className} /> : null);

export function Landing({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [code, setCode] = useState(false);
  const nav = useNav();
  const reduce = useReducedMotion();
  const catalog = useCatalog().data?.seasons ?? null;

  // Scroll reveals (each section's pieces rise in once), and the top bar's hairline once you've scrolled.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.15 });
    el.querySelectorAll(".lp-up, .lp-faces").forEach((n) => io.observe(n));
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const start = (seasonId?: string) => {
    if (seasonId) startWith([seasonId]);
    nav.push(paths.start(1));
  };

  return (
    <div className="lp" id="lp" ref={root} data-landing>
      <header className={`lp-top${scrolled ? " scrolled" : ""}`}>
        <NavLink href={paths.welcome} aria-label="Game Your Show" className="origin-left scale-[.86]">
          <Wordmark />
        </NavLink>
        {signedIn ? (
          // A full load: the app opens on whichever design the account chose.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          <button type="button" className="lp-btn pri ml-auto" data-open-app onClick={() => window.location.assign("/")}>
            Open the app
          </button>
        ) : (
          <>
            <NavLink className="lp-signin" href={paths.signin()}>
              Sign in
            </NavLink>
            <button type="button" className="lp-btn pri" data-lp="start" onClick={() => start()}>
              Start free
            </button>
          </>
        )}
      </header>

      <Hero reduce={reduce} onStart={() => start()} onCode={() => setCode(true)} />
      <div className="lp-ticker" aria-hidden>
        <div className="row">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="cap">
              {t}
            </span>
          ))}
        </div>
      </div>
      <ThreeTaps catalog={catalog} onStart={start} />
      <WaysToPlay />
      <YourCouch reduce={reduce} />
      <SpoilerSafe reduce={reduce} />
      <AnyShow />
      <Free />

      <section className="lp-final" aria-labelledby="lpFin">
        <div className="lp-in">
          <h2 id="lpFin" className="cap">
            Pick a show.
            <br />
            Make it
            <br />a game.
          </h2>
          <p>Two minutes, free, and the next episode is closer than you think.</p>
          <div className="lp-ctas">
            <button type="button" className="lp-btn ink wide" data-lp="start" onClick={() => start()}>
              Start free
              <Chev />
            </button>
            <button type="button" className="lp-btn out wide" data-lp="code" onClick={() => setCode(true)}>
              Join with a code
            </button>
          </div>
        </div>
      </section>
      <footer className="lp-foot">
        <Wordmark />
        <nav aria-label="Footer">
          <NavLink href={paths.signin()}>Sign in</NavLink>
          <a href="#lp" onClick={(e) => (e.preventDefault(), window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }))}>
            Back to top
          </a>
        </nav>
        <p className="legal">
          Game Your Show is a fan-made game and is not affiliated with, endorsed by or sponsored by any network, studio or show. Show names and cast likenesses belong to their
          respective owners.
        </p>
      </footer>
      <CodeSheet open={code} onOpenChange={setCode} onCode={(c) => nav.push(paths.join(c))} />
    </div>
  );
}

// ---------- the hero: the rolling show name, the two ways in, the cast wall ----------

function Hero({ reduce, onStart, onCode }: { reduce: boolean; onStart: () => void; onCode: () => void }) {
  return (
    <section className="lp-hero" aria-labelledby="lpH1">
      <div className="lp-in">
        <span className="lp-tag cap">Free for your whole couch</span>
        <h1 id="lpH1" className="cap" aria-label="Turn any TV show into a game">
          <span className="lp-line" aria-hidden>
            Turn
          </span>
          <Roll reduce={reduce} />
          <span className="lp-line" aria-hidden>
            into a game.
          </span>
        </h1>
        <p className="lp-lede">
          Draft the cast. Set a lineup. Call who goes home and play bingo while you watch. Then find out who on your couch <b>really</b> knows the show.
        </p>
        <div className="lp-ctas">
          <button type="button" className="lp-btn pri wide" data-lp="start" onClick={onStart}>
            Start free
            <Chev />
          </button>
          <button type="button" className="lp-btn out wide" data-lp="code" onClick={onCode}>
            Join with a code
          </button>
        </div>
        <div className="lp-fine">
          {["No credit card", "No app store", "Never spoiled"].map((t) => (
            <span key={t}>
              <Tick />
              {t}
            </span>
          ))}
        </div>
      </div>
      <Wall />
    </section>
  );
}

/** The show name rolls through, on a plate sized once to the longest name so nothing moves while they roll. */
function Roll({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [i, setI] = useState(0);
  const [width, setWidth] = useState<string | undefined>(undefined);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const size = () => {
      const fs = parseFloat(getComputedStyle(el).fontSize) || 1;
      const widest = Math.max(...Array.from(el.children, (c) => (c as HTMLElement).scrollWidth));
      setWidth(`${widest / fs + 0.55}em`);
    };
    size();
    document.fonts?.ready.then(size);
  }, []);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n < ROLL.length - 1 ? n + 1 : n)), 1700);
    return () => clearInterval(t);
  }, [reduce]);
  // Reduced motion: no roll, just "your show".
  const at = reduce ? ROLL.length - 1 : i;
  return (
    <span className="lp-roll" ref={ref} aria-hidden style={{ width }}>
      {ROLL.map((name, k) => (
        <span key={name} style={{ transform: k < at ? "translateY(-110%)" : k > at ? "translateY(110%)" : undefined, opacity: k === at ? 1 : 0 }}>
          {name}
        </span>
      ))}
    </span>
  );
}

/** Real faces, each named with its show, drifting in three rows. */
function Wall() {
  const of = (s: Season) => s.cast.filter((c) => c.photo).map((c) => ({ c, s }));
  const rows = [[...of(S51), ...of(TRT).slice(0, 6)], [...of(TRT), ...of(S49).slice(0, 6)], of(CHL).slice(0, 20)];
  return (
    <div className="lp-wall" aria-hidden>
      {rows.map((row, ri) => (
        <div key={ri} className={`lp-wrow${ri % 2 ? " rev" : ""}`} style={{ "--d": `${70 + ri * 12}s` } as React.CSSProperties}>
          {[...row, ...row].map(({ c, s }, k) => (
            <div key={k} className="lp-cell">
              <Photo c={c} />
              <span className="nm">
                <b className="cap">{first(c.name)}</b>
                <small>{showName(s)}</small>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- three taps to episode night ----------

function ThreeTaps({ catalog, onStart }: { catalog: CatalogSeason[] | null; onStart: (seasonId?: string) => void }) {
  // The first three shows first run would show (on now first), one season each.
  // The curated shows set up as games (the catalog has every show people added too since step 10).
  const tiles = (catalog ?? []).filter((s) => s.curated && s.ready).filter((s, i, all) => all.findIndex((x) => x.show === s.show) === i).slice(0, 3);
  const team = some(S51, ["Kristin", "Mike", "Brady"]);
  return (
    <section className="lp-sec" aria-labelledby="lpHow">
      <div className="lp-in">
        <h2 id="lpHow" className="cap lp-h2 lp-up">
          Three taps to
          <br />
          episode night.
        </h2>
        <div className="lp-steps">
          <div className="lp-step lp-up">
            <span className="n num">1</span>
            <h3 className="cap">Pick your shows</h3>
            <p>Survivor, The Traitors and The Challenge come ready with the cast and scoring. Anything else, follow it now and make it a game when you like.</p>
            <div className="vis">
              <div className="lp-shows" data-lp-shows>
                {tiles.map((s) => (
                  <button key={s.seasonId} type="button" className="lp-show" data-pick={s.label} onClick={() => onStart(s.seasonId)}>
                    {s.artUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL
                      <img src={s.artUrl} alt="" style={{ objectPosition: s.artPosition }} />
                    )}
                    <span className="go">
                      <PlusIcon />
                    </span>
                    <b className="cap">{s.show}</b>
                    <small>
                      {s.season}
                      {s.airsOn ? ` · ${s.airsOn}` : ""}
                    </small>
                  </button>
                ))}
                <button type="button" className="lp-show add" data-pick="any" onClick={() => onStart()}>
                  <b className="cap" style={{ fontSize: 16 }}>
                    + Any show
                  </b>
                  <small>Search them all</small>
                </button>
              </div>
              <div className="lp-hint">
                <Chev />
                Tap one to start
              </div>
            </div>
          </div>
          <div className="lp-step lp-up">
            <span className="n num">2</span>
            <h3 className="cap">Bring your couch</h3>
            <p>Your couch is your people, for every show and every season. Send one code. Or just play solo and invite anyone later.</p>
            <div className="vis">
              <div className="lp-invite">
                <span className="lp-tag cap" style={{ fontSize: 11 }}>
                  Invite
                </span>
                <div>
                  <div className="code num">K7Q2XZ</div>
                  <small>Couch Council · Survivor 51</small>
                </div>
              </div>
              <div className="lp-seats">
                {(
                  [
                    ["Y", "#45a89a", "You"],
                    ["M", "#a76bb0", "Maya"],
                    ["D", "#d9704a", "Dev"],
                  ] as const
                ).map(([a, c, n]) => (
                  <span key={n} className="lp-seat">
                    <i style={{ background: c }}>{a}</i>
                    {n}
                  </span>
                ))}
                <span className="lp-seat empty">
                  <i>+</i>Seat
                </span>
              </div>
            </div>
          </div>
          <div className="lp-step lp-up">
            <span className="n num">3</span>
            <h3 className="cap">Play every episode</h3>
            <p>Set your moves before it airs. Results come in after, and nobody sees them until they tap Reveal.</p>
            <div className="vis">
              <div className="lp-tiles">
                {team.map((c) => (
                  <div key={c.name} className="lp-tile">
                    <Photo c={c} />
                    <div className="cap">{first(c.name)}</div>
                    <small>{c.tribe}</small>
                  </div>
                ))}
              </div>
              <div className="lp-plate">
                <span className="t good cap">You</span>
                <span className="b">
                  <b className="cap">+12.5 last week</b>
                  <small>Tied for 1st on your couch</small>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- play it your way ----------

function WaysToPlay() {
  const reel = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  // Finished seasons only: Survivor 49's teams, lineups and picks.
  const team = some(S49, ["Savannah", "Sophi", "Jawan"]);
  const lineup = S49.cast.filter((c) => !c.exitEp || c.exitEp >= 13).sort((a, b) => b.total - a.total).slice(0, 3);
  const picks = some(S49, ["Kristina", "Sophi", "Savannah", "Sage"]);
  const out = (c: Castaway) => !!c.exitEp && c.exitEp < 13;
  return (
    <section className="lp-sec" aria-labelledby="lpPlay">
      <div className="lp-in">
        <h2 id="lpPlay" className="cap lp-h2 lp-up">
          Play it
          <br />
          your way.
        </h2>
        <p className="lp-lede lp-up">Run a whole season, or play one episode at a time. Every game works for any show, and you can run several on the same couch.</p>
        <div className="lp-reel" ref={reel} onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / 302))}>
          <article className="lp-game" style={{ "--g": GAME_STYLE.Outlast.colour } as React.CSSProperties}>
            <span className="kind cap">Season game · draft</span>
            <h3 className="cap">Outlast</h3>
            <p>Draft a team. Your players score for every boot they outlast, so the last one standing carries you.</p>
            <div className="vis">
              {team.map((c) => (
                <div key={c.name} className={`lp-team${out(c) ? " out" : ""}`}>
                  <Photo c={c} />
                  <div className="pl">
                    <b className="cap">{first(c.name)}</b>
                    <small>
                      {out(c) ? (
                        <>
                          <span className="lp-chip" style={{ background: "var(--live)", color: "var(--live-foreground)" }}>
                            Out
                          </span>{" "}
                          Episode {c.exitEp}
                        </>
                      ) : (
                        <>
                          <span className="lp-chip" style={{ background: "var(--chyron)", color: "var(--chyron-foreground)" }}>
                            Finale
                          </span>{" "}
                          made it to the end
                        </>
                      )}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className="lp-game" style={{ "--g": GAME_STYLE["Weekly Lineup"].colour } as React.CSSProperties}>
            <span className="kind cap">Season game · draft</span>
            <h3 className="cap">Weekly Lineup</h3>
            <p>Draft a roster, then start your best three before each episode airs. Only starters score.</p>
            <div className="vis">
              <div className="lp-tiles">
                {lineup.map((c) => (
                  <div key={c.name} className="lp-tile">
                    <Photo c={c} />
                    <div className="cap">{first(c.name)}</div>
                    <small>{c.total} pts</small>
                  </div>
                ))}
              </div>
              <div className="lp-plate">
                <span className="t cap">Lineup</span>
                <span className="b">
                  <b className="cap">Locks Wed 8:05 PM</b>
                  <small>Start 3 · bench 2</small>
                </span>
              </div>
            </div>
          </article>
          <article className="lp-game" style={{ "--g": GAME_STYLE["Survival Pool"].colour } as React.CSSProperties}>
            <span className="kind cap">Season game · no draft</span>
            <h3 className="cap">Survival Pool</h3>
            <p>Each episode, pick one person you think survives. Never the same one twice. Longest streak wins.</p>
            <div className="vis">
              <div className="lp-streak">
                <span className="num">4</span>
                <span className="text-muted-foreground" style={{ paddingBottom: 10 }}>
                  in a row
                </span>
              </div>
              <div className="lp-picks">
                {picks.map((c, i) => (
                  <div key={c.name} className={`lp-pick${i < 3 ? "" : " now"}`}>
                    <Photo c={c} />
                    {i < 3 && <b>✓</b>}
                  </div>
                ))}
                <div className="lp-pick nx">+</div>
              </div>
            </div>
          </article>
        </div>
        <div className="lp-dots" aria-hidden>
          {[0, 1, 2].map((k) => (
            <i key={k} className={k === at ? "on" : undefined} />
          ))}
        </div>
        <div className="lp-sub cap">And every episode</div>
        <div className="lp-eg">
          <div className="lp-egc lp-up">
            <span className="lp-tag cap" style={{ background: "#e56b9f", fontSize: 11 }}>
              Predict
            </span>
            <h4 className="cap">Who goes home?</h4>
            <p>One-tap calls before it airs.</p>
            <div className="vis lp-faces3">
              {some(S51, ["Thien", "Carter", "Danny"]).map((c, i) => (
                <Photo key={c.name} c={c} className={i === 1 ? "on" : undefined} />
              ))}
            </div>
          </div>
          <div className="lp-egc lp-up">
            <span className="lp-tag cap" style={{ fontSize: 11 }}>
              Bingo
            </span>
            <h4 className="cap">A fresh card</h4>
            <p>The show&apos;s clichés. First line wins.</p>
            <div className="vis lp-bingo">
              {Array.from({ length: 25 }, (_, i) => (
                <i key={i} className={i === 12 ? "f" : [0, 6, 18, 24, 2, 9].includes(i) ? "m" : undefined} />
              ))}
            </div>
          </div>
          <div className="lp-egc lp-up">
            <span className="lp-tag cap good" style={{ fontSize: 11 }}>
              Watch along
            </span>
            <h4 className="cap">In sync</h4>
            <p>The couch&apos;s comments as you reach them.</p>
            <div className="vis">
              {COUCH.slice(0, 2).map(([a, c, , x]) => (
                <div key={x} className="lp-cm">
                  <span className="a" style={{ background: c }}>
                    {a}
                  </span>
                  <span>{x.replace("challenge ", "")}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-egc lp-up">
            <span className="lp-tag cap" style={{ background: "#8f84d8", fontSize: 11 }}>
              Rate it
            </span>
            <h4 className="cap">Two seconds</h4>
            <p>After the credits. Then the couch verdict.</p>
            <div className="vis">
              <div className="lp-stars">
                <Star />
                <Star />
                <Star />
                <Star />
                <Star off />
              </div>
              <div style={{ marginTop: 6, fontSize: 12 }} className="text-muted-foreground">
                <b className="num" style={{ color: "var(--foreground)", fontSize: 20 }}>
                  4.5
                </b>{" "}
                couch verdict
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- the couch: the week, the watch along, the shelf ----------

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type Listing = [time: string, title: string, ep: string, colour?: string, face?: Castaway];
const WEEK: Record<number, Listing[]> = {
  3: [["8:05 PM", "Survivor", "S51 · Ep 5", "#f2804b", by(S51, "Kristin")]],
  4: [["9:00 PM", "The Traitors", "S5 · Ep 4", "#c23a4b", TRT.cast[6]]],
  2: [["8:00 PM", "The Challenge", "S37 · Ep 7", "#5089c9", CHL.cast[4]]],
  1: [["8:00 PM", "Below Deck Med", "S10 · Ep 7"]],
};

function YourCouch({ reduce }: { reduce: boolean }) {
  // This phone's week from today (after hydration: the server's today may not be the phone's).
  const hydrated = useHydrated();
  const days = useMemo(() => {
    if (!hydrated) return [];
    const d0 = new Date();
    return Array.from({ length: 7 }, (_, i) => new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i));
  }, [hydrated]);
  return (
    <section className="lp-sec lp-couch" aria-labelledby="lpCouch">
      <div className="lp-in">
        <span className="lp-tag cap q lp-up">Your couch</span>
        <h2 id="lpCouch" className="cap lp-h2 lp-up">
          Same friends.
          <br />
          Every show.
        </h2>
        <p className="lp-lede lp-up">
          A league ends with the finale. <b>A couch doesn&apos;t.</b> It keeps your people and your history, and lines up everything you&apos;re all watching this week.
        </p>
        <div className="lp-sub cap">This week on the couch</div>
        <div className="lp-guide">
          {days.map((d, i) => {
            const items = WEEK[d.getDay()] ?? [];
            if (i && !items.length) return null;
            return (
              <div key={i} className={`lp-day${i === 0 ? " today" : ""}`}>
                <div className="dh cap">
                  <b>{i === 0 ? "Today" : DAY[d.getDay()]}</b>
                  <small>
                    {MON[d.getMonth()]} {d.getDate()}
                  </small>
                </div>
                {items.length ? (
                  items.map(([tm, tt, ep, c, p]) => (
                    <div key={tt} className={`lp-li${c ? "" : " watch"}`} style={c ? { background: c } : undefined}>
                      {p && <Photo c={p} />}
                      <span className="tm">{tm}</span>
                      <span className="tt">{tt}</span>
                      <span className="ep">
                        {ep}
                        {c ? "" : " · watching"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="lp-li watch none">Nothing on</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="lp-wa lp-up">
          <WatchPhone reduce={reduce} />
          <div>
            <span className="lp-tag cap live" style={{ fontSize: 11 }}>
              Watch along
            </span>
            <h3 className="cap" style={{ marginTop: 10 }}>
              The couch, even when it&apos;s not.
            </h3>
            <p>
              Tap Start when your episode starts, live or streaming. What everyone said shows up <b>as you reach that moment</b>, never a second early.
            </p>
          </div>
        </div>
        <div className="lp-shelf lp-up">
          {(
            [
              ["gold", "Survivor 49", "Maya won"],
              ["", "Traitors 4", "You won"],
              ["", "Survivor 52", "Run it back"],
            ] as const
          ).map(([g, n, s]) => (
            <div key={n} className={`lp-tro ${g}`}>
              <Cup />
              <b className="cap">{n}</b>
              <small>{s}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The watch-along phone: the clock runs and the couch's comments arrive with it. */
function WatchPhone({ reduce }: { reduce: boolean }) {
  const [t, setT] = useState(21 * 60 + 40);
  const [shown, setShown] = useState(2);
  useEffect(() => {
    if (reduce) return;
    const clock = setInterval(() => setT((x) => x + 8), 1000);
    const feed = setInterval(() => setShown((n) => n + 1), 2600);
    return () => {
      clearInterval(clock);
      clearInterval(feed);
    };
  }, [reduce]);
  const feed = Array.from({ length: Math.min(shown, 4) }, (_, k) => {
    const n = shown - Math.min(shown, 4) + k;
    return { n, line: COUCH[n % COUCH.length] };
  });
  return (
    // A phone in a watch along: Night in both themes, as the watch along is (step 15 part 4).
    <div className="lp-waphone dark text-foreground" aria-hidden>
      <div className="bar">
        <b className="cap">Survivor 51</b>
        <small>
          <i />
          Live
        </small>
      </div>
      <div className="clk num">
        {Math.floor(t / 60)}:{String(t % 60).padStart(2, "0")}
      </div>
      <div className="pb">
        <i style={{ width: `${Math.min(100, (t / 2580) * 100)}%` }} />
      </div>
      <div className="feed">
        {feed.map(({ n, line: [a, c, who, x] }) => (
          <div key={n} className="lp-cm">
            <span className="a" style={{ background: c }}>
              {a}
            </span>
            <div>
              <small>{who}</small>
              {x}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- spoiler-safe: the gate, then Survivor 49's real points race to the finale ----------

const RACE = ["#ffc531", "#35b5a5", "#e56b9f", "#5089c9", "#f2804b"];

function SpoilerSafe({ reduce }: { reduce: boolean }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const top = [...S49.cast].sort((a, b) => b.total - a.total).slice(0, 5);
  const NE = S49.episodesScored;
  const W = 360;
  const H = 250;
  const [PL, PR, PT, PB] = [6, 96, 12, 22];
  const cum = top.map((c) => c.perEp.reduce<number[]>((a, v) => (a.push((a.at(-1) ?? 0) + v), a), []));
  const max = Math.max(...cum.flat());
  const X = (i: number) => PL + ((W - PL - PR) * i) / (NE - 1);
  const Y = (v: number) => PT + (H - PT - PB) * (1 - v / max);
  const lines = useRef<(SVGPathElement | null)[]>([]);
  const heads = useRef<(SVGGElement | null)[]>([]);
  const labels = useRef<(SVGTextElement | null)[]>([]);
  const epRef = useRef<HTMLSpanElement>(null);

  // Drawn by hand each frame (five paths, no re-render): up to episode p, eased.
  const draw = (p: number) => {
    const i = Math.min(Math.floor(p), NE - 1);
    const f = p - i;
    if (epRef.current) epRef.current.textContent = `EP ${Math.min(NE, i + 1)}`;
    cum.forEach((c, k) => {
      let d = `M${X(0)},${Y(c[0])}`;
      for (let j = 1; j <= i; j++) d += ` L${X(j)},${Y(c[j])}`;
      const v = i < NE - 1 ? c[i] + (c[i + 1] - c[i]) * f : c[NE - 1];
      const x = i < NE - 1 ? X(i) + (X(i + 1) - X(i)) * f : X(NE - 1);
      d += ` L${x},${Y(v)}`;
      lines.current[k]?.setAttribute("d", d);
      heads.current[k]?.setAttribute("transform", `translate(${x},${Y(v)})`);
      if (labels.current[k]) labels.current[k]!.textContent = `${first(top[k].name)} ${Math.round(v)}`;
    });
  };
  useEffect(() => {
    draw(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- the race starts at episode 1

  const reveal = () => {
    setOpen(true);
    const t0 = performance.now() + 350;
    const dur = reduce ? 1 : 4200;
    const step = (now: number) => {
      const k = Math.max(0, Math.min((now - t0) / dur, 1));
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      draw(e * (NE - 1));
      if (k < 1) requestAnimationFrame(step);
      else setDone(true);
    };
    requestAnimationFrame(step);
  };
  const w = top[0];
  return (
    <section className="lp-sec" aria-labelledby="lpSpoil">
      <div className="lp-in">
        <span className="lp-tag cap good lp-up">Spoiler-safe</span>
        <h2 id="lpSpoil" className="cap lp-h2 lp-up">
          Watch Thursday.
          <br />
          Still win.
        </h2>
        <p className="lp-lede lp-up">
          Results arrive as a nudge, not a headline. <b>Nothing shows until you tap Reveal</b>: not the standings, not the chat, not your score.
        </p>
        <div className={`lp-gate lp-up${open ? " open" : ""}`} data-gate={open ? "open" : "shut"}>
          <div className="lock">
            <span className="lp-tag cap">Survivor 49 · Finale</span>
            <h3 className="cap">Results are in</h3>
            <p className="text-muted-foreground" style={{ fontSize: 14, lineHeight: 1.5 }}>
              {NE} episodes, {S49.cast.length} castaways, every point. Try it: this is a real season.
            </p>
            <div className="lp-ghost" />
            <div className="lp-ghost s" />
            <div className="lp-ghost" />
            <div className="lp-ghost s" />
            <button type="button" className="lp-btn pri wide" data-reveal style={{ height: 54, fontSize: 17, fontWeight: 800, marginTop: 6 }} onClick={reveal}>
              Reveal Survivor 49
            </button>
          </div>
          <div className="lp-race" aria-live="polite">
            <div className="lp-race-top">
              <span className="cap text-muted-foreground" style={{ fontSize: 13 }}>
                Top scorers, episode by episode
              </span>
              <span className="num ep" ref={epRef}>
                EP 1
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cumulative points for Survivor 49's top scorers across ${NE} episodes`}>
              <defs>
                {top.map((c, k) => (
                  <clipPath key={k} id={`lpcp${k}`}>
                    <circle r={11} />
                  </clipPath>
                ))}
              </defs>
              {[0, 25, 50, 75].filter((v) => v <= max).map((v) => (
                <line key={v} x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="var(--border)" />
              ))}
              {Array.from({ length: Math.ceil(NE / 3) }, (_, n) => n * 3).map((i) => (
                <text key={i} x={X(i)} y={H - 4} className="axis" textAnchor="middle">
                  EP {i + 1}
                </text>
              ))}
              {top.map((c, k) => (
                <path
                  key={c.name}
                  ref={(el) => {
                    lines.current[k] = el;
                  }}
                  className="lp-ln"
                  stroke={RACE[k]}
                />
              ))}
              {top.map((c, k) => (
                <g
                  key={c.name}
                  ref={(el) => {
                    heads.current[k] = el;
                  }}
                >
                  <circle r={13} fill={RACE[k]} />
                  {c.photo && <image href={c.photo} width={22} height={22} x={-11} y={-11} clipPath={`url(#lpcp${k})`} />}
                  <text
                    x={17}
                    y={5}
                    className="lbl"
                    fill={RACE[k]}
                    ref={(el) => {
                      labels.current[k] = el;
                    }}
                  />
                </g>
              ))}
            </svg>
            <div className={`lp-winner${done ? " on" : ""}`}>
              <Photo c={w} />
              <div className="lp-plate">
                <span className="t cap">Top scorer</span>
                <span className="b">
                  <b className="cap">{w.name}</b>
                  <small>
                    {w.total} points across {NE} episodes
                  </small>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- any show ----------

function AnyShow() {
  return (
    <section className="lp-sec" aria-labelledby="lpAny">
      <div className="lp-in">
        <span className="lp-tag cap lp-up">Any show</span>
        <h2 id="lpAny" className="cap lp-h2 lp-up">
          Yes, that
          <br />
          one too.
        </h2>
        <p className="lp-lede lp-up">
          Follow any show from day one: rate episodes, watch along, chat. <b>When you want a game, one copy and paste</b> sets up the cast and the scoring.
        </p>
        <div className="lp-faces" aria-hidden>
          {CHL.cast
            .filter((c) => c.photo)
            .map((c, i) => (
              <div key={c.name} style={{ transitionDelay: `${i * 24}ms` }}>
                <Photo c={c} />
              </div>
            ))}
        </div>
        <div className="lp-facecap">
          <span>The Challenge 37, set up from one paste</span>
          <b className="num">{CHL.cast.length}</b>
        </div>
        <div className="lp-paste lp-up">
          {(
            [
              ["Copy our prompt", "We write the research question for the show and season."],
              ["Paste it into any AI chat", "ChatGPT, Claude, Gemini: the free versions are plenty."],
              ["Paste the answer back", "The cast, the groups and the scoring, ready to check and draft."],
            ] as const
          ).map(([b, p], i) => (
            <div key={b} className="lp-pst">
              <span className="n num">{i + 1}</span>
              <div>
                <b>{b}</b>
                <p>{p}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="lp-chips lp-up">
          {["Survivor", "The Traitors", "The Challenge"].map((n) => (
            <span key={n} className="ready">
              {n}
            </span>
          ))}
          {["Big Brother", "Love Island", "Drag Race", "The Amazing Race"].map((n) => (
            <span key={n}>{n}</span>
          ))}
          {["Below Deck", "Love Is Blind", "Your show"].map((n) => (
            <span key={n} className="follow">
              {n}
            </span>
          ))}
        </div>
        <p className="lp-key">White: ready, results filled in for you. Solid: set up by players. Dashed: follow now, make it a game anytime.</p>
      </div>
    </section>
  );
}

// ---------- free, and the questions ----------

function Free() {
  return (
    <section className="lp-sec lp-free" aria-labelledby="lpFree">
      <div className="lp-in">
        <span className="lp-tag cap good lp-up">Free</span>
        <h2 id="lpFree" className="cap lp-h2 lp-up">
          Free.
          <br />
          All of it.
        </h2>
        <div className="lp-freelist lp-up">
          {["Every show, even yours", "Every game type", "Unlimited players", "Unlimited couches", "Chat, bingo, watch along", "Spoiler protection"].map((t) => (
            <div key={t}>
              <Tick />
              {t}
            </div>
          ))}
        </div>
        <p className="lp-auto lp-up">
          <b>Optional Autopilot</b> fills in each episode&apos;s results for the commissioner the morning after. Same games either way; it only saves a few minutes a week.
        </p>
        <div className="lp-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <PlusIcon />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Join with a code ----------

/** The code from the invite a friend sent, then its page (the couch first). */
function CodeSheet({ open, onOpenChange, onCode }: { open: boolean; onOpenChange: (o: boolean) => void; onCode: (code: string) => void }) {
  const [code, setCode] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [open]);
  const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Join with a code" subtitle="From the invite your friend sent">
      <form
        className="flex flex-col gap-2.5"
        data-code-sheet
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length < 6) return;
          onOpenChange(false);
          onCode(code);
        }}
      >
        <input
          ref={input}
          data-code-input
          value={code}
          onChange={(e) => setCode(clean(e.target.value))}
          maxLength={6}
          placeholder="K7Q2XZ"
          autoComplete="off"
          autoCapitalize="characters"
          aria-label="Invite code"
          className="type-num h-[68px] w-full rounded-[3px] bg-background pl-[.3em] text-center text-[40px] uppercase tracking-[.3em] outline-1 -outline-offset-1 outline-input placeholder:text-input focus:outline-2 focus:outline-chyron-line"
        />
        <Btn
          wide
          onClick={async () => {
            const text = await navigator.clipboard?.readText().catch(() => "");
            if (text) setCode(clean(text));
          }}
        >
          Paste from clipboard
        </Btn>
        <Btn type="submit" tone="must" wide className="type-caption h-14 text-[20px]" disabled={code.length < 6}>
          Find the couch
        </Btn>
        <p className="text-center text-[12px] text-muted-foreground">Got a link instead? Just open it.</p>
      </form>
    </Sheet>
  );
}
