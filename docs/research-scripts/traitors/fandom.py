import sys, json, urllib.request, urllib.parse
def raw(title):
    u = "https://thetraitors.fandom.com/api.php?" + urllib.parse.urlencode({"action":"query","prop":"revisions","rvprop":"content","rvslots":"main","format":"json","formatversion":"2","titles":title})
    d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":"rfl-research/1.0"}), timeout=30))
    p = d["query"]["pages"][0]
    return p["revisions"][0]["slots"]["main"]["content"] if "revisions" in p else None
if __name__ == "__main__":
    for t in sys.argv[1:]:
        r = raw(t); print("=====", t, None if r is None else len(r)); 
        if r and len(sys.argv) == 2: print(r)
