"""Build a design round's screenshot story page from captured frames (docs/DESIGN-PROCESS.md, "The screenshot story").

Reads a story spec (JSON) naming sections and frames, copies each frame into <out>/img shrunk to a phone-column width (JPEG), and
writes <out>/<name>.html plus <out>/files.json (the published paths, for the Artifact tool's `files`). Frames come from
story-situations.js runs (before/ and after/ folders under the story's root) or any other image path under the repo.

Spec shape:
  { "title": "...", "description": "...", "name": "game-page-story", "root": ".ui-atlas/stories/<design>",
    "intro": "<html>", "sections": [ { "id": "...", "title": "...", "lede": "<html>",
      "pairs": [ { "caption": "<html>", "lens": "...", "before": "before/show-due.jpg", "after": "after/show-due.jpg" } ],
      "frames": [ { "caption": "<html>", "lens": "...", "src": "after/show-due.matchup.jpg" } ],
      "html": "<html>" } ] }

Run: python scripts/dev-test/story-build.py <spec.json> [--out=<dir>] [--width=360]
Reusable for any round: the spec carries the words; nothing here is about one page.
"""
import io
import json
import os
import sys

from PIL import Image

args = sys.argv[1:]
spec_path = args[0]
opt = {a.split('=', 1)[0][2:]: a.split('=', 1)[1] for a in args[1:] if a.startswith('--') and '=' in a}
spec = json.load(io.open(spec_path, encoding='utf-8'))
root = spec['root']
out = opt.get('out', os.path.join(root, 'story'))
width = int(opt.get('width', 360))
os.makedirs(os.path.join(out, 'img'), exist_ok=True)
files = []


def img(rel):
    """Copy a frame into img/, shrunk; return its published path."""
    src = rel if os.path.isabs(rel) or rel.startswith('.ui-atlas') or rel.startswith('docs') else os.path.join(root, rel)
    name = rel.replace('/', '__').replace('\\', '__')
    if not name.endswith('.jpg'):
        name = os.path.splitext(name)[0] + '.jpg'
    dst = os.path.join(out, 'img', name)
    im = Image.open(src).convert('RGB')
    w, h = im.size
    if w > width * 2:
        im = im.resize((width * 2, round(h * width * 2 / w)), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=80, optimize=True, progressive=True)
    pub = 'img/' + name
    if pub not in files:
        files.append(pub)
    return pub


def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def figure(src, caption, lens, tag=None, alt=''):
    p = img(src)
    tagh = f'<span class="tag tag-{tag}">{tag}</span>' if tag else ''
    lensh = f'<p class="lens">{esc(lens)}</p>' if lens else ''
    return (f'<figure class="frame"><button class="shot" type="button" data-full="{p}" aria-label="Open full size: {esc(alt or lens or "frame")}">'
            f'{tagh}<img src="{p}" alt="{esc(alt or lens)}" loading="lazy"></button>'
            f'<figcaption>{lensh}{caption or ""}</figcaption></figure>')


sections_html = []
toc = []
for sec in spec['sections']:
    parts = [f'<section id="{sec["id"]}"><h2>{esc(sec["title"])}</h2>']
    toc.append(f'<a href="#{sec["id"]}">{esc(sec.get("short", sec["title"]))}</a>')
    if sec.get('lede'):
        parts.append(f'<div class="read lede2">{sec["lede"]}</div>')
    for pr in sec.get('pairs', []):
        parts.append('<div class="pair">')
        if pr.get('before'):
            parts.append(figure(pr['before'], pr.get('before_caption', ''), '', 'before', alt='Before: ' + pr.get('lens', '')))
        parts.append(figure(pr['after'], pr.get('caption', ''), pr.get('lens', ''), 'after' if pr.get('before') else None, alt='After: ' + pr.get('lens', '')))
        parts.append('</div>')
    if sec.get('frames'):
        parts.append('<div class="frames">')
        for fr in sec['frames']:
            parts.append(figure(fr['src'], fr.get('caption', ''), fr.get('lens', ''), fr.get('tag')))
        parts.append('</div>')
    if sec.get('html'):
        parts.append(sec['html'])
    parts.append('</section>')
    sections_html.append(''.join(parts))

css = io.open(os.path.join(os.path.dirname(__file__), 'story-build.css'), encoding='utf-8').read()
page = f'''<title>{esc(spec["title"])}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..100,400..800&family=Inter:wght@400;500;600&display=swap">
<style>{css}</style>
<main>
<header class="top">{spec["intro"]}</header>
<nav class="toc" aria-label="Sections">{"".join(toc)}</nav>
{"".join(sections_html)}
</main>
<dialog id="zoom" aria-label="Full-size frame"><button type="button" class="close" aria-label="Close">Close</button><img alt=""></dialog>
<script>
(() => {{
  const d = document.getElementById('zoom'), im = d.querySelector('img');
  document.addEventListener('click', (e) => {{
    const b = e.target.closest('[data-full]');
    if (b) {{ im.src = b.dataset.full; im.alt = b.querySelector('img')?.alt || ''; d.showModal(); return; }}
    if (e.target === d || e.target.closest('.close')) d.close();
  }});
}})();
</script>
'''
name = spec.get('name', 'story')
io.open(os.path.join(out, name + '.html'), 'w', encoding='utf-8', newline='\n').write(page)
json.dump(files, io.open(os.path.join(out, 'files.json'), 'w', encoding='utf-8'))
print(os.path.join(out, name + '.html'), len(files), 'images')
