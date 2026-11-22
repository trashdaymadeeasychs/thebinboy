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
# Pages that are not real content: no canonical, not in the sitemap, noindex.
ERROR_PAGES = {"404.html"}
# Real pages that are linked from the footer, not the main navigation.
GUIDE_PAGES = {"why-does-my-trash-can-smell.html"}
FOOTER_PAGES = {"privacy.html", *GUIDE_PAGES}


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.elements = []
        self.nav_links = []
        self.in_nav = False
        self.json_data = []
        self.in_json = False
        self.plans = {}
        self.current_plan = None
        self.plan_depth = 0
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if tag == "div" and "data-plan" in attrs:
            self.current_plan = attrs["data-plan"]
            self.plans[self.current_plan] = []
        if tag == "div" and self.current_plan is not None:
            self.plan_depth += 1
        if tag == "nav" and attrs.get("id") == "navLinks":
            self.in_nav = True
        if tag == "a" and self.in_nav:
            self.nav_links.append(attrs)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json = True

    def handle_endtag(self, tag):
        if tag == "div" and self.current_plan is not None:
            self.plan_depth -= 1
            if self.plan_depth == 0:
                self.current_plan = None
        if tag == "nav":
            self.in_nav = False
        if tag == "script":
            self.in_json = False

    def handle_data(self, data):
        if self.current_plan is not None:
            self.plans[self.current_plan].append(data)
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
        self.assertEqual(set(self.pages), {"index.html", *TOPICS.values(), *ERROR_PAGES, *FOOTER_PAGES})
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
                self.assertEqual(current, [] if name in {"index.html", *ERROR_PAGES, *FOOTER_PAGES} else [name])

    def test_navigation_is_identical_on_every_page(self):
        expected = [{k: v for k, v in a.items() if k != "aria-current"}
                    for a in self.pages["index.html"].nav_links]
        for name, page in self.pages.items():
            with self.subTest(page=name):
                links = [{k: v for k, v in a.items() if k != "aria-current"}
                         for a in page.nav_links]
                self.assertEqual(links, expected)

    def test_reviews_page_uses_five_star_review_cards(self):
        page = self.pages["reviews.html"]
        cards = page.find("figure", **{"class": "gr-card"})
        stars = page.find("div", **{"class": "gr-card__stars", "role": "img",
                                   "aria-label": "Rated 5 out of 5 stars"})
        self.assertEqual(len(cards), 7)
        self.assertEqual(len(stars), len(cards))
        text = (ROOT / "reviews.html").read_text()
        for author in ("Geraldine Shepherd", "Sheryl T.", "Christy Chappell", "Andrew Haws",
                       "Alexis Waldrop", "Katherine Morgan", "Sarah Miller"):
            self.assertIn(f"<strong>{author}</strong>", text)

    def test_unique_metadata_and_self_referencing_canonicals(self):
        descriptions = []
        titles = []
        content_pages = {n: p for n, p in self.pages.items() if n not in ERROR_PAGES}
        for name, page in content_pages.items():
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
        self.assertEqual(len(set(descriptions)), len(content_pages))
        self.assertEqual(len(set(titles)), len(content_pages))

    def test_error_pages_are_noindex_and_work_from_any_url(self):
        for name in ERROR_PAGES:
            with self.subTest(page=name):
                page = self.pages[name]
                self.assertEqual(len(page.find("meta", name="robots", content="noindex")), 1)
                self.assertEqual(page.find("base"), [{"href": "/"}])
                self.assertFalse(page.find("link", rel="canonical"))
                # With <base href="/">, a "#..." link would jump to the home page.
                self.assertFalse([a for t, a in page.elements
                                  if t == "a" and a.get("href", "").startswith("#")])

    def test_every_page_links_to_the_privacy_policy(self):
        for name, page in self.pages.items():
            with self.subTest(page=name):
                self.assertTrue(page.find("a", href="privacy.html"))

    def test_guide_pages_are_articles_linked_from_home(self):
        home_links = [a.get("href") for _, a in self.pages["index.html"].elements]
        for name in GUIDE_PAGES:
            with self.subTest(page=name):
                nodes = self.pages[name].json_data[0]["@graph"]
                article = next(n for n in nodes if n["@type"] == "Article")
                self.assertTrue(article["headline"])
                self.assertTrue(article["datePublished"])
                crumbs = next(n for n in nodes if n["@type"] == "BreadcrumbList")
                self.assertEqual(crumbs["itemListElement"][-1]["item"], ORIGIN + name)
                self.assertIn(name, home_links)

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
        expected = {ORIGIN + ("" if name == "index.html" else name)
                    for name in self.pages if name not in ERROR_PAGES}
        self.assertEqual(set(locations), expected)
        self.assertEqual(len(locations), len(expected))

    def test_new_pages_have_matching_structured_breadcrumbs(self):
        for label, name in TOPICS.items():
            with self.subTest(page=name):
                nodes = self.pages[name].json_data[0]["@graph"]
                crumbs = next(n for n in nodes if n["@type"] == "BreadcrumbList")
                last = crumbs["itemListElement"][-1]
                self.assertEqual(last["name"], label)
                self.assertEqual(last["item"], ORIGIN + name)
                self.assertEqual(nodes[0]["url"], ORIGIN + name)

    def test_residential_rates_match_booking_service_options(self):
        expected = {
            "biweekly": ("25 first cleaning", "2 cleanings per month"),
            "monthly": ("25 / month", "1 cleaning per month"),
            "bimonthly": ("35 every other month", "1 cleaning every 2 months"),
            "quarterly": ("45 / quarter", "1 cleaning every 3 months"),
            "onetime": ("80 / visit", "One-time cleaning"),
        }
        for name in ("index.html", "pricing.html"):
            page = self.pages[name]
            self.assertEqual(list(page.plans), list(expected))
            for plan, (rate, frequency) in expected.items():
                with self.subTest(page=name, plan=plan):
                    text = " ".join(" ".join(page.plans[plan]).split())
                    self.assertIn(rate, text)
                    self.assertIn(frequency, text)
                    self.assertIn("1 bin included", text)
                    self.assertNotIn("2 bins included", text)
                    self.assertTrue(text.rstrip().endswith("Additional bins are $15 per bin"))
                    if plan == "biweekly":
                        self.assertIn("$15 for the second cleaning each month", text)
                    if plan == "monthly":
                        self.assertNotIn("Single visit", text)

    def test_structured_offers_match_visible_rates(self):
        nodes = self.pages["index.html"].json_data[0]["@graph"]
        offers = {n["offers"]["@id"].split("#offer-")[1]: n["offers"]
                  for n in nodes if n.get("@type") == "Service"}
        self.assertEqual({name: offer["price"] for name, offer in offers.items()},
                         {"biweekly": "25", "monthly": "25", "bimonthly": "35",
                          "quarterly": "45", "onetime": "80"})
        for offer in offers.values():
            self.assertEqual(offer["priceCurrency"], "USD")
            self.assertIn("one bin", offer["description"])
            self.assertIn("$15 per bin", offer["description"])
        self.assertIn("$15 for the second cleaning each month", offers["biweekly"]["description"])


if __name__ == "__main__":
    unittest.main()
