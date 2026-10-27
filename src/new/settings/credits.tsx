"use client";

import { Sheet } from "../ui/sheet";
import { Btn } from "../ui/parts";

// Credits (docs/RESEARCH-show-art-and-cast-photos.md): where shows' art, cast photos and the TV listings come from. TMDB's terms
// ask for its logo and its notice; TVmaze's licence (CC BY-SA) for a credit with a link; Wikimedia Commons' photos for their
// photographers' credit. ESPN's data (sports' games, players and headshots: docs/PLAN-sports-data.md) has no published terms for
// this use, so it's credited plainly, and as not connected with us. And the art belongs to the networks: anyone can ask for
// something to come down (Report a problem; the desk's "No art or photos" switch takes a show's down).

/** TMDB's approved logo ("alt short"), from TMDB's own logos page. */
const TMDB_LOGO = "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg";

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline underline-offset-2">
    {children}
  </a>
);

export function CreditsSheet({ open, onOpenChange, onReport }: { open: boolean; onOpenChange: (open: boolean) => void; onReport: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Credits" subtitle="Where the art, photos, listings and sports data come from">
      <div data-credits className="flex flex-col gap-5 text-[14px] leading-snug text-muted-foreground">
        <section data-credit="tmdb">
          {/* eslint-disable-next-line @next/next/no-img-element -- TMDB's own logo file, as its attribution page gives it */}
          <img src={TMDB_LOGO} alt="TMDB" className="mb-2 h-4 w-auto" />
          <p>
            Shows&apos; art and most cast photos come from <A href="https://www.themoviedb.org">TMDB</A>. This product uses TMDB and the TMDB APIs but is not
            endorsed, certified, or otherwise approved by TMDB.
          </p>
        </section>
        <section data-credit="tvmaze">
          <b className="block text-[15px] text-foreground">TVmaze</b>
          <p>
            TV listings, and some posters and photos, from <A href="https://www.tvmaze.com">TVmaze</A> (CC BY-SA).
          </p>
        </section>
        <section data-credit="espn">
          <b className="block text-[15px] text-foreground">ESPN</b>
          <p>
            Sports&apos; games, teams, players and headshots come from <A href="https://www.espn.com">ESPN</A>. Game Your Show isn&apos;t connected with ESPN.
          </p>
        </section>
        <section data-credit="wikimedia">
          <b className="block text-[15px] text-foreground">Wikipedia and Wikimedia Commons</b>
          <p>
            Athletes&apos; photos come from <A href="https://commons.wikimedia.org">Wikimedia Commons</A>, by their photographers, under Creative Commons licences
            (each photo&apos;s page on Wikipedia names its author). Formula 1&apos;s fields come from <A href="https://jolpi.ca">Jolpica</A>.
          </p>
        </section>
        <section data-credit="rights">
          <b className="block text-[15px] text-foreground">The shows&apos; own</b>
          <p>Shows&apos; art and cast photos belong to their networks and studios. Game Your Show isn&apos;t connected with any of them. Something you want taken down? Tell us and it&apos;s gone.</p>
          <Btn data-credits-report className="mt-2.5 h-11 text-[15px]" onClick={onReport}>
            Ask for something to come down
          </Btn>
        </section>
      </div>
    </Sheet>
  );
}
