"""Mock exclusive leagues (docs/RESEARCH-traitors-scoring-values.md section 3.7). Run after dataset.py: python ownership.py"""
import io, contextlib, random, statistics as st
with contextlib.redirect_stdout(io.StringIO()):
    import simulate as S
from analyze import FINALE
rows, people, SEASONS = S.rows, S.people, S.SEASONS
win = {k for k, rs in people.items() if any(x["exit"] == "winner" for x in rs)}
EXC = {**S.PROPOSED, "finalist": 3, "seasonWinner": 5, "wonAsTraitor": 2}
def owner_edge(vals):
    random.seed(1)
    tot = {k: sum(S.score(x, vals) for x in rs) for k, rs in people.items()}
    ow = has = 0
    for s in SEASONS:
        ks = [k for k in people if k[0] == s]
        for _ in range(2000):
            pool = random.sample(ks, 16); teams = [pool[i::4] for i in range(4)]
            sc = [sum(tot[k] for k in t) for t in teams]
            wt = {i for i, t in enumerate(teams) if any(k in win for k in t)}
            if len(wt) != 1: continue
            has += 1; ow += max(range(4), key=lambda i: sc[i]) in wt
    return ow / has
def per_ep(vals, traitor):
    return st.mean(S.score(r, vals) for r in rows if r["traitor"] == traitor and r["epIndex"] != FINALE.get(r["season"]))
def link(vals):
    ppe = [sum(S.score(x, vals) for x in rs if x["epIndex"] != FINALE.get(rs[0]["season"])) / len(rs) for rs in people.values() if len(rs) >= 3]
    plc = [1 - (rs[0]["place"] - 1) / max(1, rs[0]["cast"] - 1) for rs in people.values() if len(rs) >= 3]
    return S.spearman(ppe, plc)
for label, vals in [
    ("shared values in an exclusive league", S.PROPOSED),
    ("exclusive as built", EXC),
    ("no win points at all", {**EXC, "seasonWinner": 0, "finalist": 0, "wonAsTraitor": 0, "fooledToTheEnd": 0}),
    ("A: win 3 / finalist 2 / Traitor bonus 1", {**EXC, "seasonWinner": 3, "finalist": 2, "wonAsTraitor": 1}),
    ("B: A + all four vote outcomes x0.75", {**EXC, "seasonWinner": 3, "finalist": 2, "wonAsTraitor": 1, "votedOutTraitor": 1.5, "turnedOnTraitor": 1.5, "traitorVotedOutFaithful": 0.5}),
    ("C: A + Traitor votes only lowered", {**EXC, "seasonWinner": 3, "finalist": 2, "wonAsTraitor": 1, "turnedOnTraitor": 1.5, "traitorVotedOutFaithful": 0.25}),
    ("D: A + zero votes 0.25", {**EXC, "seasonWinner": 3, "finalist": 2, "wonAsTraitor": 1, "zeroVotes": 0.25}),
]:
    print(f"{label:42} owner wins {owner_edge(vals):.0%} | F/ep {per_ep(vals, False):+.2f} T/ep {per_ep(vals, True):+.2f} | link {link(vals):+.2f}")
