"""Run with: python3 -m unittest discover -s tests -v"""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://thebinboy.com/"
TOPICS = {
    "How It Works": "how-it-works.html",
    "Photos": "photos.html",
    "Pricing": "pricing.html",
    "Commercial": "commercial.html",
    "Service Area": "service-area.html",
    "About": "about.html",
    "Reviews": "reviews.html",
}


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.elements = []
        self.nav_links = []
        self.in_nav = False
        self.json_data = []
        self.in_json = False
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if tag == "nav" and attrs.get("id") == "navLinks":
            self.in_nav = True
        if tag == "a" and self.in_nav:
            self.nav_links.append(attrs)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json = True

    def handle_endtag(self, tag):
        if tag == "nav":
            self.in_nav = False
        if tag == "script":
            self.in_json = False

    def handle_data(self, data):
        if self.in_json:
            self.json_data.append(json.loads(data))

    def find(self, tag, **attrs):
        return [a for t, a in self.elements if t == tag
                and all(a.get(k) == v for k, v in attrs.items())]

    def find_id(self, value):
        return any(a.get("id") == value for _, a in self.elements)


class SiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = {p.name: Page(p) for p in ROOT.glob("*.html")}

    def test_all_topics_are_standalone_documents(self):
        self.assertEqual(set(self.pages), {"index.html", *TOPICS.values()})
        for name, page in self.pages.items():
            with self.subTest(page=name):
                self.assertEqual(len(page.find("h1")), 1)
                self.assertEqual(len(page.find("main", id="main-content")), 1)
                ids = [a["id"] for _, a in page.elements if "id" in a]
                self.assertEqual(len(ids), len(set(ids)))

    def test_navigation_links_to_every_topic_on_every_page(self):
        for name, page in self.pages.items():
            with self.subTest(page=name):
                self.assertEqual([a["href"] for a in page.nav_links[:7]],
                                 list(TOPICS.values()))
                current = [a["href"] for a in page.nav_links
                           if a.get("aria-current") == "page"]
                self.assertEqual(current, [] if name == "index.html" else [name])

    def test_unique_metadata_and_self_referencing_canonicals(self):
        descriptions = []
        titles = []
        for name, page in self.pages.items():
            with self.subTest(page=name):
                url = ORIGIN + ("" if name == "index.html" else name)
                self.assertEqual(page.find("link", rel="canonical"),
                                 [{"rel": "canonical", "href": url}])
                self.assertEqual(page.find("meta", property="og:url")[0]["content"], url)
                description = page.find("meta", name="description")
                self.assertEqual(len(description), 1)
                descriptions.append(description[0]["content"])
                titles.append((ROOT / name).read_text().split("<title>")[1].split("</title>")[0])
                self.assertFalse(page.find("meta", name="robots", content="noindex"))
        self.assertEqual(len(set(descriptions)), len(self.pages))
        self.assertEqual(len(set(titles)), len(self.pages))

    def test_internal_links_and_assets_resolve(self):
        for name, page in self.pages.items():
            for _, attrs in page.elements:
                for key in ("href", "src"):
                    if key not in attrs:
                        continue
                    url = urlsplit(attrs[key])
                    if url.scheme or url.netloc:
                        continue
                    target = unquote(url.path).lstrip("/") or ("index.html" if url.path else name)
                    with self.subTest(page=name, link=attrs[key]):
                        self.assertTrue((ROOT / target).is_file())
                        if url.fragment and target in self.pages:
                            self.assertTrue(self.pages[target].find_id(unquote(url.fragment)))

    def test_sitemap_lists_every_page_once(self):
        tree = ET.parse(ROOT / "sitemap.xml")
        locations = [e.text for e in tree.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
        expected = {ORIGIN + ("" if name == "index.html" else name) for name in self.pages}
        self.assertEqual(set(locations), expected)
        self.assertEqual(len(locations), len(expected))

    def test_new_pages_have_matching_structured_breadcrumbs(self):
        for label, name in TOPICS.items():
            if name == "commercial.html":
                continue
            with self.subTest(page=name):
                nodes = self.pages[name].json_data[0]["@graph"]
                crumbs = next(n for n in nodes if n["@type"] == "BreadcrumbList")
                last = crumbs["itemListElement"][-1]
                self.assertEqual(last["name"], label)
                self.assertEqual(last["item"], ORIGIN + name)
                self.assertEqual(nodes[0]["url"], ORIGIN + name)


if __name__ == "__main__":
    unittest.main()
