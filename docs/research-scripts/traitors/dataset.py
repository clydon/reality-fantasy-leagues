"""Build one row per person per episode from the fandom voting grids. python dataset.py -> rows.json"""
import json, os, re
from grid import season
from fandom import raw

SEASONS = ["US1", "US2", "US3", "US4", "UK1", "UK2", "UK3", "UK4", "UKC1", "AU1", "AU2", "AU3",
           "CA1", "CA2", "CA3", "NZ1", "NZ2", "NZ3", "IE1", "IE2"]
EXIT = {"murder": "murdered", "banf": "banished", "bant": "banished", "quit": "left", "med": "left", "dis": "left",
        "elim": "left", "final": "finalist", "win": "winner", "sharedwin": "winner", "dilemma": "left"}
TRAITORISH = ("traitor",)
RECRUITISH = ("recruit", "recruith", "clusterf", "clusterfh")


def names_in(text, people):
    """People named in a free-text cell ('Katie & Xavier', 'Eric, Ian, Mark & Rob R')."""
    parts = [p.strip() for p in re.split(r",|&| and ", text or "") if p.strip()]
    return [p for p in parts if p in people]


def grid_text(code):
    """The season's voting grid, fetched once into grids/ and read from there after."""
    path = f"grids/{code}.wiki"
    if not os.path.exists(path):
        os.makedirs("grids", exist_ok=True)
        open(path, "w", encoding="utf-8").write(raw(f"Template:{code} Voting History") or "")
    return open(path, encoding="utf-8").read()


def build(code):
    s = season(grid_text(code))
    cols, persons, labels = s["columns"], s["persons"], s["labels"]
    people = {p["name"] for p in persons}
    n = len(cols)
    ban = labels.get("Banishment", [])
    dec = labels.get("Traitors' Decision", [])
    get = lambda row, i: row[i] if i < len(row) else ("", "", "")

    # Merge identical neighbouring sub-columns into one unit.
    units = []
    for i in range(n):
        sig = (cols[i], get(ban, i)[:2], tuple(get(p["cells"], i)[:2] for p in persons))
        if units and units[-1]["sig"] == sig:
            units[-1]["cols"].append(i)
        else:
            units.append({"sig": sig, "cols": [i], "episode": cols[i]})
    # Episode order (labels like '3-4' kept as-is, in order of first appearance).
    episodes = []
    for u in units:
        if u["episode"] not in episodes: episodes.append(u["episode"])

    # Recruitment / declines from the decision row.
    recruited_at, declined_at = {}, {}
    for i in range(min(n, len(dec))):
        cls, text = dec[i][0], dec[i][1]
        if cls == "ryes":
            for nm in names_in(text, people): recruited_at.setdefault(nm, cols[i])
        if cls == "rno":
            for nm in names_in(text, people): declined_at.setdefault(nm, cols[i])

    # Banishments live on the Banishment row, not the banished person's own row.
    banished_at = {}
    for i in range(min(n, len(ban))):
        if ban[i][0] in ("banf", "bant") and ban[i][1] in people:
            banished_at.setdefault(ban[i][1], (i, ban[i][0]))
    # Exit episode and kind per person: the first exit cell in their row, or their banishment,
    # whichever comes first; failing both, where their row stops (notingame).
    info = {}
    for p in persons:
        ex = None
        for i, c in enumerate(p["cells"]):
            if c[0] in EXIT:
                ex = (cols[min(i, n - 1)], EXIT[c[0]], c[0], i); break
        b = banished_at.get(p["name"])
        if b and (ex is None or b[0] <= ex[3]):
            ex = (cols[b[0]], "banished", b[1], b[0])
        if ex is None:
            stop = next((i for i, c in enumerate(p["cells"]) if c[0] == "notingame"), None)
            if stop is not None: ex = (cols[max(0, min(stop, n - 1) - 1)], "unknown", "", stop - 1)
        info[p["name"]] = ex
    # Placement: later exit column = better; winners/finalists share the top.
    order = sorted(persons, key=lambda p: -(info[p["name"]][3] if info[p["name"]] else 10 ** 6))
    place = {}
    for p in persons:
        ex = info[p["name"]]
        col = ex[3] if ex else 10 ** 6
        later = sum(1 for q in persons if (info[q["name"]][3] if info[q["name"]] else 10 ** 6) > col)
        place[p["name"]] = 1 + later

    rows = []
    for p in persons:
        nm = p["name"]
        ex = info[nm]
        is_traitor_start = p["faction"] in TRAITORISH
        rec_ep = recruited_at.get(nm) if p["faction"] in RECRUITISH or nm in recruited_at else None
        for ep in episodes:
            ep_units = [u for u in units if u["episode"] == ep]
            ep_idx = episodes.index(ep)
            if ex and episodes.index(ex[0]) < ep_idx: break
            # only rows where the person was in the game this episode
            cells = [get(p["cells"], i) for u in ep_units for i in u["cols"]]
            if all(c[0] == "notingame" or (c[0] == "" and c[1] == "") for c in cells): continue
            traitor = is_traitor_start or (rec_ep is not None and episodes.index(rec_ep) <= ep_idx if rec_ep in episodes else False)
            classes = {c[0] for c in cells}
            r = {"season": code, "name": nm, "episode": ep, "epIndex": ep_idx, "nEpisodes": len(episodes),
                 "traitor": bool(traitor), "originalTraitor": is_traitor_start,
                 "place": place[nm], "cast": len(persons),
                 "shield": any("shield" in c for c in classes),
                 "immune": any("immune" in c for c in classes),
                 "shortlist": any("trial" in c for c in classes),
                 "dagger": any("dagger" in c for c in classes),
                 "seer": any("seer" in c for c in classes),
                 "exit": ex[1] if ex and ex[0] == ep else None,
                 "exitCls": ex[2] if ex and ex[0] == ep else None,
                 "recruited": rec_ep == ep, "declined": declined_at.get(nm) == ep,
                 "votes": [], "received": 0, "banishedVotes": []}
            rows.append(r)

    # Votes per unit.
    byKey = {(r["name"], r["episode"]): r for r in rows}
    for u in units:
        i = u["cols"][0]
        bcls, btext = get(ban, i)[0], get(ban, i)[1]
        banished = btext if bcls in ("banf", "bant") and btext in people else None
        for p in persons:
            cls, text = get(p["cells"], i)[0], get(p["cells"], i)[1]
            if text not in people: continue
            r = byKey.get((p["name"], u["episode"]))
            t = byKey.get((text, u["episode"]))
            if not r: continue
            r["votes"].append(text)
            if t: t["received"] += 2 if "dagger" in cls else 1
            if banished and text == banished:
                r["banishedVotes"].append({"target": text, "targetTraitor": bool(byKey.get((text, u["episode"]), {}).get("traitor"))})
    return rows


if __name__ == "__main__":
    allrows = []
    for code in SEASONS:
        rows = build(code)
        allrows += rows
        ppl = len({r["name"] for r in rows})
        print(f"{code}: {ppl} people, {len(rows)} person-episodes, "
              f"{sum(1 for r in rows if r['exit']=='banished')} banished, {sum(1 for r in rows if r['exit']=='murdered')} murdered, "
              f"{sum(1 for r in rows if r['exit']=='winner')} winners, traitors {len({r['name'] for r in rows if r['traitor']})}, "
              f"shields {sum(r['shield'] for r in rows)}, votes {sum(len(r['votes']) for r in rows)}")
    json.dump(allrows, open("rows.json", "w", encoding="utf-8"))
    print(len(allrows), "rows")
