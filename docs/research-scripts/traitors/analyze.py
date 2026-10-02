"""Traitors scoring analysis over rows.json. python analyze.py"""
import json, math, statistics as st
from collections import defaultdict

rows = json.load(open("rows.json", encoding="utf-8"))
SEASONS = sorted({r["season"] for r in rows})
# AU2 marks its winners as Finalist (no win cell).
for r in rows:
    if r["season"] == "AU2" and r["exit"] == "finalist": r["exit"] = "winner"


def events(r):
    ev = []
    t = r["traitor"]
    stayed = r["exit"] is None
    if r["shield"]: ev.append("shieldWon")
    for b in r["banishedVotes"]:
        if b["targetTraitor"]: ev.append("turnedOnTraitor" if t else "votedOutTraitor")
        else: ev.append("votedOutFaithful")
    if r["received"] > 0 and stayed: ev.append("survivedRoundTable")
    if r["votes"] and r["received"] == 0 and stayed: ev.append("zeroVotes")
    if r["shortlist"] and not t and stayed: ev.append("onMurderShortlist")
    if r["recruited"]: ev.append("recruited")
    if r["declined"]: ev.append("declinedRecruitment")
    if r["dagger"] or r["seer"]: ev.append("wonPower")
    x = r["exit"]
    if x == "murdered": ev.append("murdered")
    if x == "banished": ev.append("banishedAsTraitor" if t else "banishedAsFaithful")
    if x == "left": ev.append("leftGame")
    if x in ("finalist", "winner"): ev.append("finalist")
    if x == "winner":
        ev.append("seasonWinner")
        if t: ev.append("wonAsTraitor")
    return ev


for r in rows: r["ev"] = events(r)

ALL = ["shieldWon", "votedOutTraitor", "turnedOnTraitor", "votedOutFaithful", "survivedRoundTable", "zeroVotes",
       "onMurderShortlist", "recruited", "declinedRecruitment", "wonPower", "murdered", "banishedAsFaithful",
       "banishedAsTraitor", "leftGame", "finalist", "seasonWinner", "wonAsTraitor"]


def rank(xs):
    order = sorted(range(len(xs)), key=lambda i: xs[i]); rk = [0] * len(xs); i = 0
    while i < len(xs):
        j = i
        while j + 1 < len(xs) and xs[order[j + 1]] == xs[order[i]]: j += 1
        for k in range(i, j + 1): rk[order[k]] = (i + j) / 2
        i = j + 1
    return rk


def spearman(a, b):
    if len(a) < 5: return float("nan")
    ra, rb = rank(a), rank(b)
    ma, mb = st.mean(ra), st.mean(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = math.sqrt(sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb))
    return num / den if den else float("nan")


def auc(scores, labels):
    pos = [s for s, l in zip(scores, labels) if l]; neg = [s for s, l in zip(scores, labels) if not l]
    if not pos or not neg: return float("nan")
    win = sum((p > q) + 0.5 * (p == q) for p in pos for q in neg)
    return win / (len(pos) * len(neg))


def section(t): print("\n## " + t)

# ---------- A. frequency ----------
section("A. events per season (mean over %d seasons), by role at the time" % len(SEASONS))
by = defaultdict(lambda: defaultdict(int))
for r in rows:
    for e in r["ev"]: by[e]["T" if r["traitor"] else "F"] += 1
ns = len(SEASONS)
print(f"{'event':22} {'per season':>10} {'Faithful':>9} {'Traitor':>8}")
for e in ALL:
    f, t = by[e]["F"], by[e]["T"]
    print(f"{e:22} {(f + t) / ns:10.1f} {f / ns:9.1f} {t / ns:8.1f}")
per_role_eps = defaultdict(int)
for r in rows: per_role_eps["T" if r["traitor"] else "F"] += 1
print("person-episodes per season: Faithful %.0f, Traitor %.0f" % (per_role_eps["F"] / ns, per_role_eps["T"] / ns))

# ---------- B. link to going far ----------
section("B. link to going far: Spearman(rate, placement percentile), per person")
people = defaultdict(list)
for r in rows: people[(r["season"], r["name"])].append(r)
def pct(rs): r = rs[0]; return 1 - (r["place"] - 1) / max(1, r["cast"] - 1)
for role in ("faithful", "original traitor"):
    sel = [rs for rs in people.values() if (rs[0]["originalTraitor"] if role != "faithful" else not any(x["traitor"] for x in rs)) and len(rs) >= 3]
    print(f"-- {role}s with 3+ episodes: n={len(sel)}")
    for e in ["shieldWon", "votedOutTraitor", "turnedOnTraitor", "votedOutFaithful", "survivedRoundTable", "zeroVotes", "onMurderShortlist"]:
        attended = lambda rs: sum(1 for x in rs if x["votes"]) or 1
        denom = attended if e in ("votedOutTraitor", "turnedOnTraitor", "votedOutFaithful", "zeroVotes", "survivedRoundTable") else (lambda rs: len(rs))
        rate = [sum(e in x["ev"] for x in rs) / denom(rs) for rs in sel]
        if sum(rate) == 0: continue
        print(f"   {e:22} {spearman(rate, [pct(rs) for rs in sel]):+.2f}")

# ---------- C. predictability ----------
section("C. what a manager can see coming (AUC; 0.5 = coin flip)")
def history(rs, upto, key):
    return sum(key(x) for x in rs if x["epIndex"] < upto)
pred = defaultdict(lambda: ([], []))
for rs in people.values():
    rs = sorted(rs, key=lambda x: x["epIndex"])
    for i, r in enumerate(rs):
        if i == 0: continue
        prev = rs[i - 1]
        rts = sum(1 for x in rs[:i] if x["votes"]) or 1
        # banishment risk from votes received so far / last time
        if r["votes"] or r["exit"] == "banished":
            s, l = pred["banished <- votes received last RT"]; s.append(prev["received"]); l.append(r["exit"] == "banished")
            s, l = pred["banished <- votes received per RT so far"]; s.append(history(rs, r["epIndex"], lambda x: x["received"]) / rts); l.append(r["exit"] == "banished")
            s, l = pred["survivedRoundTable <- votes received last RT"]; s.append(prev["received"]); l.append("survivedRoundTable" in r["ev"])
            s, l = pred["zeroVotes <- zero votes rate so far"]; s.append(history(rs, r["epIndex"], lambda x: "zeroVotes" in x["ev"]) / rts); l.append("zeroVotes" in r["ev"])
        if not r["traitor"]:
            s, l = pred["murdered (Faithful) <- times voted out a Traitor so far"]; s.append(history(rs, r["epIndex"], lambda x: "votedOutTraitor" in x["ev"])); l.append(r["exit"] == "murdered")
            s, l = pred["murdered (Faithful) <- times survived votes so far"]; s.append(history(rs, r["epIndex"], lambda x: "survivedRoundTable" in x["ev"])); l.append(r["exit"] == "murdered")
            s, l = pred["murdered (Faithful) <- shortlisted before"]; s.append(history(rs, r["epIndex"], lambda x: x["shortlist"])); l.append(r["exit"] == "murdered")
        s, l = pred["shieldWon <- shields so far"]; s.append(history(rs, r["epIndex"], lambda x: x["shield"])); l.append(r["shield"])
        if any(b["targetTraitor"] for x in [r] for b in x["banishedVotes"]) or r["votes"]:
            if not r["traitor"]:
                s, l = pred["votedOutTraitor (Faithful) <- catches so far"]; s.append(history(rs, r["epIndex"], lambda x: "votedOutTraitor" in x["ev"])); l.append("votedOutTraitor" in r["ev"])
for k, (s, l) in pred.items():
    print(f"   {k:58} AUC {auc(s, l):.2f}   base rate {sum(l) / len(l):.1%} (n={len(l)})")

section("C2. role, which the audience knows from episode 1: exit rates per episode in the game")
for role in (False, True):
    rs = [r for r in rows if r["traitor"] == role and r["exit"] not in ("finalist", "winner")]
    n = len(rs)
    print(f"   {'Traitor' if role else 'Faithful':9} n={n}: banished {sum(r['exit']=='banished' for r in rs)/n:.1%}, murdered {sum(r['exit']=='murdered' for r in rs)/n:.1%}")
win_t = sum(1 for rs in people.values() if any(x["exit"] == "winner" and x["traitor"] for x in rs))
win_all = sum(1 for rs in people.values() if any(x["exit"] == "winner" for x in rs))
fin = [rs for rs in people.values() if any(x["exit"] in ("winner", "finalist") for x in rs)]
print(f"   winners who were Traitors: {win_t} of {win_all}; seasons won by Traitors: {len({k[0] for k, rs in people.items() if any(x['exit']=='winner' and x['traitor'] for x in rs)})} of {ns}")
print(f"   winners per season: {[sum(1 for k,rs in people.items() if k[0]==s and any(x['exit']=='winner' for x in rs)) for s in SEASONS]}")
eps = lambda pred_: st.mean([len(rs) for rs in people.values() if pred_(rs)])
print(f"   mean episodes played: original Traitor {eps(lambda rs: rs[0]['originalTraitor']):.1f}, recruited {eps(lambda rs: any(x['recruited'] for x in rs)):.1f}, Faithful {eps(lambda rs: not any(x['traitor'] for x in rs)):.1f}")

json.dump(rows, open("rows_ev.json", "w", encoding="utf-8"))
