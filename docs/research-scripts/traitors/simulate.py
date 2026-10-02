"""Score every person-episode under candidate values and compare. python simulate.py"""
import json, statistics as st
from collections import defaultdict
from analyze import spearman, auc  # noqa: reuses helpers (re-runs analyze output too)

rows = json.load(open("rows_ev.json", encoding="utf-8"))
SEASONS = sorted({r["season"] for r in rows})

CURRENT = {"shieldWon": 2, "survivedRoundTable": 1, "votedOutTraitor": 2, "recruited": 3, "finalist": 5, "seasonWinner": 10,
           "murdered": 0, "banishedAsFaithful": -3, "banishedAsTraitor": -3, "leftGame": -5}
# NB: in the app a winner gets seasonWinner only; finalist is the runner-up event. Mirror that.
PROPOSED = {"shieldWon": 1, "survivedRoundTable": 0.5, "votedOutTraitor": 2, "turnedOnTraitor": 2, "votedOutFaithful": 0,
            "zeroVotes": 0.5, "onMurderShortlist": 0.5, "recruited": 2, "declinedRecruitment": 1, "wonPower": 2,
            "finalist": 5, "seasonWinner": 10, "wonAsTraitor": 3,
            "murdered": 0, "banishedAsFaithful": -3, "banishedAsTraitor": -3, "leftGame": -5}
SETS = {"current": CURRENT, "proposed": PROPOSED}


def score(r, vals):
    evs = list(r["ev"])
    if "seasonWinner" in evs and "finalist" in evs: evs.remove("finalist")
    return sum(vals.get(e, 0) for e in evs)


people = defaultdict(list)
for r in rows: people[(r["season"], r["name"])].append(r)

for name, vals in SETS.items():
    print(f"\n######## {name}")
    # where the + points come from
    pos = defaultdict(float)
    for r in rows:
        evs = list(r["ev"])
        if "seasonWinner" in evs and "finalist" in evs: evs.remove("finalist")
        for e in evs:
            v = vals.get(e, 0)
            if v > 0: pos[e] += v
    tot = sum(pos.values())
    print("share of + points: " + ", ".join(f"{e} {p / tot:.0%}" for e, p in sorted(pos.items(), key=lambda x: -x[1])))
    print(f"+ points per season: {tot / len(SEASONS):.0f}")
    # per-episode value by role, pre-finale
    for label, sel in (("Faithful", lambda r: not r["traitor"]), ("Traitor", lambda r: r["traitor"])):
        pre = [score(r, vals) for r in rows if sel(r) and r["exit"] not in ("finalist", "winner")]
        print(f"  {label:8} mean per episode (excl. finale) {st.mean(pre):+.2f}")
    # per-person season totals by role
    for label, sel in (("Faithful", lambda rs: not any(x["traitor"] for x in rs)), ("orig Traitor", lambda rs: rs[0]["originalTraitor"]),
                       ("recruited", lambda rs: any(x["recruited"] for x in rs))):
        tots = [sum(score(x, vals) for x in rs) for rs in people.values() if sel(rs)]
        print(f"  {label:12} season total: mean {st.mean(tots):+.1f}, median {st.median(tots):+.1f} (n={len(tots)})")
    # points per episode vs how far they go
    ppe = [sum(score(x, vals) for x in rs if x["exit"] not in ("finalist", "winner")) / len(rs) for rs in people.values() if len(rs) >= 3]
    plc = [1 - (rs[0]["place"] - 1) / max(1, rs[0]["cast"] - 1) for rs in people.values() if len(rs) >= 3]
    print(f"  points/episode (pre-finale) vs placement: {spearman(ppe, plc):+.2f}")
    # winners' rank in pre-finale totals within their season
    ranks = []
    for s in SEASONS:
        tots = {k[1]: sum(score(x, vals) for x in rs if x["exit"] not in ("finalist", "winner")) for k, rs in people.items() if k[0] == s}
        order = sorted(tots, key=lambda n: -tots[n])
        for k, rs in people.items():
            if k[0] == s and any(x["exit"] == "winner" for x in rs): ranks.append((s, order.index(k[1]) + 1, "T" if rs[-1]["traitor"] else "F"))
    print("  winners' rank in pre-finale points: " + " ".join(f"{s}:{r}{t}" for s, r, t in ranks))
    # weekly: starter scores above median, predicted by points so far
    sc, lab = [], []
    for rs in people.values():
        rs = sorted(rs, key=lambda x: x["epIndex"])
        for i in range(1, len(rs)):
            sc.append(sum(score(x, vals) for x in rs[:i]) / i); lab.append(score(rs[i], vals))
    med = st.median(lab)
    print(f"  week-to-week predictability (AUC, points so far -> above-median week): {auc(sc, [l > med for l in lab]):.2f}")
