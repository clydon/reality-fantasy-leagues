"""Parse a thetraitors.fandom.com '<Season> Voting History' template into per-person, per-column cells.

Cells are {{c|class|text|colspan|rowspan}} (Template:C) or plain wikitext with optional
colspan="n" / rowspan="n" attributes. Returns a Season with:
  columns   -- list of column labels (episode header for each data column)
  persons   -- list of {name, faction, cells: [ (cls, text) per data column ]}
  rows      -- the label rows (Traitors' Decision, Banishment, Vote, ...) as {label: [(cls,text)...]}
"""
import re

REF = re.compile(r"<ref[^>/]*/>|<ref[^>]*>.*?</ref>", re.S)


def split_top(s, sep="|"):
    out, depth, cur, i = [], 0, "", 0
    while i < len(s):
        if s.startswith("{{", i) or s.startswith("[[", i):
            depth += 1; cur += s[i:i + 2]; i += 2; continue
        if s.startswith("}}", i) or s.startswith("]]", i):
            depth -= 1; cur += s[i:i + 2]; i += 2; continue
        if s[i] == sep and depth == 0:
            out.append(cur); cur = ""; i += 1; continue
        cur += s[i]; i += 1
    out.append(cur)
    return out


def clean(t):
    t = re.sub(r"\{\{nowrap\|([^}]*)\}\}", r"\1", t)
    t = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"<br\s*/?>", " ", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = t.replace("'''", "").replace("''", "").replace("&nbsp;", " ")
    return " ".join(t.split()).strip()


def parse_cell(body):
    """body: the text after the leading | or !. Returns (cls, text, colspan, rowspan)."""
    body = body.strip()
    m = re.match(r"^\{\{\s*c\s*\|(.*)\}\}\s*$", body, re.S)
    if m:
        parts = split_top(m.group(1))
        cls = parts[0].strip()
        text = clean(parts[1]) if len(parts) > 1 else ""
        def num(p):
            try:
                return max(1, int(re.sub(r"[^0-9]", "", p) or 1)) if p.strip() and "%" not in p else 1
            except ValueError:
                return 1
        cs = num(parts[2]) if len(parts) > 2 else 1
        rs = num(parts[3]) if len(parts) > 3 else 1
        return cls, text, cs, rs
    cs = rs = 1
    # attribute prefix:  colspan="2" style=".." | text
    parts = split_top(body)
    if len(parts) > 1 and re.search(r"(colspan|rowspan|style|width)\s*=", parts[0]):
        attrs, body = parts[0], "|".join(parts[1:])
        mc = re.search(r'colspan\s*=\s*"?(\d+)', attrs); mr = re.search(r'rowspan\s*=\s*"?(\d+)', attrs)
        cs = int(mc.group(1)) if mc else 1; rs = int(mr.group(1)) if mr else 1
    # a plain cell can still wrap a {{c|...}} after attributes
    inner = re.match(r"^\{\{\s*c\s*\|(.*)\}\}\s*$", body.strip(), re.S)
    if inner:
        c, t, cs2, rs2 = parse_cell(body)
        return c, t, max(cs, cs2), max(rs, rs2)
    return "", clean(body), cs, rs


def parse(wikitext):
    w = REF.sub("", wikitext)
    w = w[w.index("{|"):]
    w = w[: w.index("\n|}") if "\n|}" in w else len(w)]
    raw_rows, cur = [], []
    for line in w.split("\n")[1:]:
        if line.startswith("|-"):
            raw_rows.append(cur); cur = []; continue
        if line.startswith("|") or line.startswith("!"):
            marker = line[0]
            for piece in split_top_cells(line[1:], marker):
                cur.append((marker, piece))
        elif cur:
            m, p = cur[-1]; cur[-1] = (m, p + "\n" + line)
    raw_rows.append(cur)
    raw_rows = [r for r in raw_rows if r]

    # grid with rowspan carry
    grid, carry = [], {}  # carry: col -> (remaining, cell)
    for r in raw_rows:
        row, col = [], 0
        cells = [parse_cell(b) + (m,) for m, b in r]
        ci = 0
        while ci < len(cells) or col in carry:
            if col in carry:
                rem, cell = carry[col]
                row.append(cell)
                if rem - 1 > 0: carry[col] = (rem - 1, cell)
                else: del carry[col]
                col += 1; continue
            if ci >= len(cells): break
            cls, text, cs, rs, m = cells[ci]; ci += 1
            for k in range(cs):
                cell = (cls, text, m)
                row.append(cell)
                if rs > 1: carry[col] = (rs - 1, cell)
                col += 1
        grid.append(row)
    return grid


def split_top_cells(s, marker):
    sep = "!!" if marker == "!" else "||"
    out, depth, cur, i = [], 0, "", 0
    while i < len(s):
        if s.startswith("{{", i) or s.startswith("[[", i): depth += 1; cur += s[i:i+2]; i += 2; continue
        if s.startswith("}}", i) or s.startswith("]]", i): depth -= 1; cur += s[i:i+2]; i += 2; continue
        if s.startswith(sep, i) and depth == 0: out.append(cur); cur = ""; i += 2; continue
        cur += s[i]; i += 1
    out.append(cur)
    return out


def season(wikitext):
    grid = parse(wikitext)
    header = grid[0]
    columns = [clean(c[1]) for c in header[1:]]  # header[0] is the 'Episode' label spanning 3 label cols
    # Header's first cell spans 3 label columns; data columns start at index 3 in other rows.
    ncols = len(header) - 3 if len(header) > 3 else len(header) - 1
    columns = [c[1] for c in header[3:]]
    labels, persons = {}, []
    for row in grid[1:]:
        # A person row has a faction cell in its first three columns; the name is the cell after it.
        fi = next((i for i, c in enumerate(row[:3]) if c[0] in FACTIONS), None)
        if fi is not None and fi + 1 < len(row):
            persons.append({"name": row[fi + 1][1], "faction": row[fi][0], "cells": row[fi + 2:]})
        elif row and row[0][0] == "nil":
            labels.setdefault(row[0][1], row[3:])
    return {"columns": columns, "persons": persons, "labels": labels}


FACTIONS = ("traitor", "faithful", "recruit", "reverse", "clusterf", "recruith", "reverseh", "clusterfh")
