import io, contextlib, random, statistics as st
with contextlib.redirect_stdout(io.StringIO()):
    import simulate as S
from analyze import FINALE
people, SEASONS = S.people, S.SEASONS
win = {k for k, rs in people.items() if any(x["exit"] == "winner" for x in rs)}
def run(vals, shared):
    random.seed(2); flip = own = has = 0; share = []
    pre = {k: sum(S.score(x, vals) for x in rs if x["epIndex"] != FINALE.get(k[0])) for k, rs in people.items()}
    tot = {k: sum(S.score(x, vals) for x in rs) for k, rs in people.items()}
    for s in SEASONS:
        ks = [k for k in people if k[0] == s]
        for _ in range(1500):
            teams = [random.sample(ks, 5) for _ in range(4)] if shared else (lambda p: [p[i::4] for i in range(4)])(random.sample(ks, 16))
            a = [sum(pre[k] for k in t) for t in teams]; b = [sum(tot[k] for k in t) for t in teams]
            flip += max(range(4), key=a.__getitem__) != max(range(4), key=b.__getitem__)
            wt = {i for i, t in enumerate(teams) if any(k in win for k in t)}
            if 0 < len(wt) < 4:
                has += 1; own += max(range(4), key=b.__getitem__) in wt
            share.append((max(b) - max(a)))
    return f"finale changes the league winner {flip/(len(SEASONS)*1500):.0%} | a team owning a winner wins {own/has:.0%}"
P = S.PROPOSED
for label, w, f, t in [("now: win 10 / finalist 5 / Traitor bonus 3", 10, 5, 3), ("win 6 / finalist 3 / bonus 2", 6, 3, 2),
                       ("win 4 / finalist 2 / bonus 1.5", 4, 2, 1.5), ("win 3 / finalist 2 / bonus 1", 3, 2, 1), ("win 0 (control)", 0, 0, 0)]:
    v = {**P, "seasonWinner": w, "finalist": f, "wonAsTraitor": t, "fooledToTheEnd": -min(3, f * 0.6)}
    print(f"SHARED {label:40} {run(v, True)}")
