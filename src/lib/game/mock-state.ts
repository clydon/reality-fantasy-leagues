import type { LeagueState } from "./types";

// Ported from the live app's buildMockSeasonState() (public/app.js), trimmed to what the
// Overview tab POC needs (no chat). Same anonymized stand-ins, same season shape, same data --
// kept in sync by hand for now, same caveat as state-logic.js's copy.
export function buildMockSeasonState(): LeagueState {
  const connie = { id: "demo_p_connie", name: "Connie", color: "#5089c4" };
  const annie = { id: "demo_p_annie", name: "Annie", color: "#a76bb0" };
  const joey = { id: "demo_p_joey", name: "Joey", color: "#c99a3e" };
  const players = [connie, annie, joey];

  const tribes = [
    { id: "demo_t_cila", name: "Cila", color: "#d9704a" },
    { id: "demo_t_kalo", name: "Kalo", color: "#45a89a" },
    { id: "demo_t_vatu", name: "Vatu", color: "#7c6bb0" },
  ];
  const T = { cila: "demo_t_cila", kalo: "demo_t_kalo", vatu: "demo_t_vatu" };

  const raw = [
    { k: "jenna", name: "Jenna Lewis-Dougherty", tribe: T.cila, placement: 1, method: "Voted Out", episode: 1 },
    { k: "kyle", name: "Kyle Fraser", tribe: T.vatu, placement: 2, method: "Medically Evacuated", episode: 1 },
    { k: "savannah", name: "Savannah Louie", tribe: T.cila, placement: 3, method: "Voted Out", episode: 2 },
    { k: "q", name: "Q Burdette", tribe: T.vatu, placement: 4, method: "Voted Out", episode: 3, owner: null, acquiredVia: "draft", formerOwner: connie.id, departedVia: "replenish", replenishClaimed: true },
    { k: "mike", name: "Mike White", tribe: T.kalo, placement: 5, method: "Voted Out", episode: 4, owner: null, acquiredVia: "draft", formerOwner: joey.id, departedVia: "replenish", replenishClaimed: true },
    { k: "angelina", name: "Angelina Keeley", tribe: T.vatu, placement: 6, method: "Voted Out", episode: 5 },
    { k: "charlie", name: "Charlie Davis", tribe: T.kalo, placement: 7, method: "Voted Out", episode: 6, owner: null, acquiredVia: "draft", formerOwner: joey.id, departedVia: "replenish", replenishClaimed: true },
    { k: "kamilla", name: "Kamilla Karthigesu", tribe: T.kalo, placement: 8, method: "Voted Out", episode: 6, owner: annie.id, acquiredVia: "draft" },
    { k: "genevieve", name: "Genevieve Mushaluk", tribe: T.vatu, placement: 9, method: "Voted Out", episode: 6, owner: null, acquiredVia: "draft", formerOwner: connie.id, departedVia: "trade" },
    { k: "colby", name: "Colby Donaldson", tribe: T.vatu, placement: 10, method: "Voted Out", episode: 6 },
    { k: "dee", name: "Dee Valladares", tribe: T.kalo, placement: 11, method: "Voted Out", episode: 7 },
    { k: "chrissy", name: "Chrissy Hofbeck", tribe: T.kalo, placement: 12, method: "Voted Out", episode: 8, owner: annie.id, acquiredVia: "draft" },
    { k: "coach", name: 'Benjamin "Coach" Wade', tribe: T.kalo, placement: 13, method: "Voted Out", episode: 8 },
    { k: "christian", name: "Christian Hubicki", tribe: T.cila, placement: 14, method: "Voted Out", episode: 9, owner: annie.id, acquiredVia: "draft" },
    { k: "stephenie", name: "Stephenie LaGrossa Kendrick", tribe: T.vatu, placement: 15, method: "Voted Out", episode: 10 },
    { k: "emily", name: "Emily Flippen", tribe: T.cila, placement: 16, method: "Voted Out", episode: 11, owner: joey.id, acquiredVia: "draft" },
    { k: "ozzy", name: "Ozzy Lusth", tribe: T.cila, placement: 17, method: "Voted Out", episode: 12 },
    { k: "rick", name: "Rick Devens", tribe: T.cila, placement: 18, method: "Voted Out", episode: 12, owner: connie.id, acquiredVia: "replenish" },
    { k: "cirie", name: "Cirie Fields", tribe: T.cila, placement: 19, method: "Voted Out", episode: 13, owner: joey.id, acquiredVia: "replenish" },
    { k: "tiffany", name: "Tiffany Ervin", tribe: T.kalo, placement: 20, method: "Voted Out", episode: 14 },
    { k: "rizo", name: "Rizo Velovic", tribe: T.vatu, placement: 21, method: "Lost Fire-Making", episode: 15 },
    { k: "joe", name: "Joe Hunter", tribe: T.cila, placement: 22, method: "Lost Final Tribal (Jury Vote)", episode: 15, owner: joey.id, acquiredVia: "replenish" },
    { k: "jonathan", name: "Jonathan Young", tribe: T.kalo, placement: 23, method: "Lost Final Tribal (Jury Vote)", episode: 15, owner: connie.id, acquiredVia: "trade" },
    { k: "aubry", name: "Aubry Bracco", tribe: T.vatu, placement: 24, method: "Sole Survivor", episode: 15, owner: connie.id, acquiredVia: "draft" },
  ] as const;

  const castaways = raw.map((r) => {
    // Every `raw` row here is exclusive-ownership, so an owner is a one-element ownerIds array.
    const owner = ("owner" in r ? r.owner : null) ?? null;
    return {
      id: "demo_c_" + r.k,
      name: r.name,
      tribeId: r.tribe,
      ownerIds: owner ? [owner] : [],
      photoUrl: "photos/" + r.k + ".jpg",
      status: "eliminated" as const,
      placementOrder: r.placement,
      exitMethod: r.method,
      exitEpisodeId: "demo_ep" + r.episode,
      replenishClaimed: "replenishClaimed" in r ? r.replenishClaimed : false,
      acquiredVia: "acquiredVia" in r ? r.acquiredVia : null,
      formerOwnerId: ("formerOwner" in r ? r.formerOwner : null) ?? null,
      departedVia: "departedVia" in r ? r.departedVia : null,
    };
  });
  const byName = (key: string) => castaways.find((c) => c.id === "demo_c_" + key)!.id;

  function ep(num: number, eventKeys: string[], bets?: LeagueState["episodes"][number]["bets"]) {
    return {
      id: "demo_ep" + num,
      number: num,
      postMerge: num >= 7,
      events: eventKeys.map((k) => ({
        castawayId: byName(k),
        method: raw.find((r) => r.k === k)!.method,
      })),
      bets: bets || [],
      picks: [], // this demo league is classic-draft; pickem's weekly picks never apply here.
    };
  }

  const episodes = [
    ep(1, ["jenna", "kyle"]),
    ep(2, ["savannah"]),
    ep(3, ["q"]),
    ep(4, ["mike"]),
    ep(5, ["angelina"]),
    ep(6, ["charlie", "kamilla", "genevieve", "colby"], [
      {
        id: "demo_bet_bloodmoon",
        label: "How many go home at tonight's Blood Moon twist tribal?",
        points: 2,
        predictions: [
          { id: "demo_pr1", playerId: joey.id, guess: "4", correct: true },
          { id: "demo_pr2", playerId: connie.id, guess: "2", correct: false },
        ],
      },
    ]),
    ep(7, ["dee"]),
    ep(8, ["chrissy", "coach"], [
      {
        id: "demo_bet_exile",
        label: "Does Cirie's return from Exile lead to a paired vote-out?",
        points: 2,
        predictions: [
          { id: "demo_pr3", playerId: annie.id, guess: "Yes", correct: true },
          { id: "demo_pr4", playerId: joey.id, guess: "No", correct: false },
        ],
      },
    ]),
    ep(9, ["christian"]),
    ep(10, ["stephenie"]),
    ep(11, ["emily"]),
    ep(12, ["ozzy", "rick"]),
    ep(13, ["cirie"]),
    ep(14, ["tiffany"]),
    ep(15, ["rizo", "joe", "jonathan", "aubry"], [
      {
        id: "demo_bet_fire",
        label: "Who wins the final fire-making duel?",
        points: 3,
        predictions: [
          { id: "demo_pr5", playerId: connie.id, guess: "Jonathan Young", correct: true },
          { id: "demo_pr6", playerId: joey.id, guess: "Rizo Velovic", correct: false },
        ],
      },
      {
        id: "demo_bet_jeff",
        label: "Does Jeff Probst have an on-air mishap at the live reveal?",
        points: 2,
        predictions: [
          { id: "demo_pr7", playerId: joey.id, guess: "Yes", correct: true },
          { id: "demo_pr8", playerId: annie.id, guess: "No", correct: false },
        ],
      },
    ]),
  ];

  return {
    players,
    tribes,
    castaways,
    episodes,
    finalePredictions: [
      { playerId: annie.id, top3: [byName("aubry"), byName("jonathan"), byName("joe")], winner: byName("aubry") },
      { playerId: connie.id, top3: [byName("aubry"), byName("jonathan"), byName("rick")], winner: byName("aubry") },
      { playerId: joey.id, top3: [byName("rizo"), byName("aubry"), byName("jonathan")], winner: byName("aubry") },
    ],
    finaleActual: { top3: [byName("aubry"), byName("jonathan"), byName("joe")], winner: byName("aubry") },
    midSeason: { replenish: null, trade: null },
    draftOrder: [connie.id, annie.id, joey.id],
    draftPicksMade: 9,
    draftForceStarted: true,
    // This demo league is exclusive-ownership (a finished snake draft), so blind draft is inert.
    blindDraft: { lockedPlayerIds: [], revealedAt: null },
    settings: {
      teamSize: 3,
      bonusEnabled: true,
      replenishOrderBy: "mostPoints",
      // The demo season shows off a completed replenish/swap history, so both are on here.
      replenishEnabled: true,
      tradeEnabled: true,
      defaultBetPoints: 1,
      finaleTop3Points: 1,
      finaleWinnerPoints: 3,
      finalePredictionScope: "open",
      leagueTypeId: "classic-draft",
      showId: "survivor",
      ownershipMode: "exclusive" as const,
      pickemCorrectPoints: 1,
    },
  };
}
