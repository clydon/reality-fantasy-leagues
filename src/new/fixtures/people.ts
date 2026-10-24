// The mock's demo people and their colours (index.html PEOPLE), and where the mock's pictures are served from
// (public/mock/showcase, published with the mock). Never a real username: the repo is public. Used by every
// fixture that shows the couch; it goes with the last of them (the streaming rail, step 14).
export const STEP = "14";

export const PEOPLE = { alex: "#45a89a", riley: "#a76bb0", jordan: "#d9704a", sam: "#5089c9" } as const;
export type Demo = keyof typeof PEOPLE;
export const COUCH: Demo[] = ["alex", "riley", "jordan", "sam"];

/** A show's key art. */
export const art = (key: string) => `/mock/showcase/art/${key}.jpg`;

/** A cast member's photo: castPhoto("survivor-51", "Maggie Nestor"). */
export const castPhoto = (season: string, name: string) => `/mock/showcase/img/${season}/${name.toLowerCase().replace(/[^a-z]+/g, "-")}.jpg`;
