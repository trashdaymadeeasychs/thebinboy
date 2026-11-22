"""Fill each sitemap <lastmod> from the page's last git commit date.

Usage: python3 scripts/sitemap_lastmod.py <sitemap.xml to rewrite>

Run from the repository root (the deploy workflow does this on the copy it
uploads). Needs full git history, so the workflow checks out with
fetch-depth: 0. Pages with no git history get no <lastmod> rather than a
made-up date.
"""

from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET

NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
ORIGIN = "https://thebinboy.com/"


def page_file(loc):
    path = loc[len(ORIGIN):] if loc.startswith(ORIGIN) else ""
    return path or "index.html"


def last_commit_date(path):
    result = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", path],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def main(sitemap):
    ET.register_namespace("", NS)
    tree = ET.parse(sitemap)
    for url in tree.getroot().findall(f"{{{NS}}}url"):
        for tag in ("lastmod", "changefreq", "priority"):
            for old in url.findall(f"{{{NS}}}{tag}"):
                url.remove(old)
        loc = url.find(f"{{{NS}}}loc").text.strip()
        date = last_commit_date(page_file(loc))
        if date:
            ET.SubElement(url, f"{{{NS}}}lastmod").text = date
        print(f"{loc} -> {date or 'no history, lastmod omitted'}")
    ET.indent(tree, space="  ")
    tree.write(sitemap, encoding="UTF-8", xml_declaration=True)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
