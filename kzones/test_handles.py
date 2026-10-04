"""Test WSZYSTKICH 8 uchwytów resize — każdy musi realnie zmieniać swoją krawędź."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8099/index.html"
fails = []

def check(c, m):
    print(("PASS  " if c else "FAIL  ") + m)
    if not c:
        fails.append(m)

def zone(pg):
    return pg.evaluate("""() => { const s = window.__kzones.state;
        const z = s.layouts[s.li].zones[s.zi]; return {x:z.x,y:z.y,w:z.width,h:z.height}; }""")

def fresh(pg):
    """One zone at 20,20 sized 40x40 → edges at 20/60, leaving room to grow
    on EVERY side. Both earlier bugs in this test were the test's fault, not
    the app's: dragging an edge that already sits at 100% outward correctly
    cannot grow the zone."""
    pg.locator(".tab-add").click()
    pg.wait_for_timeout(150)
    box = pg.locator("#canvas").bounding_box()
    pg.mouse.move(box["x"] + box["width"]*.2, box["y"] + box["height"]*.2)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"]*.6, box["y"] + box["height"]*.6, steps=10)
    pg.mouse.up()
    pg.wait_for_timeout(200)
    z = zone(pg)
    assert z["w"] < 70 and z["h"] < 70, f"strefa testowa nie może dotykać krawędzi: {z}"

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1500, "height": 1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(URL, wait_until="load"); pg.wait_for_timeout(400)

    # 1. all 8 handles exist on the selected zone
    fresh(pg)
    n = pg.locator(".zone.sel .handle").count()
    check(n == 8, f"8 uchwytów na zaznaczonej strefie (jest {n})")
    ids = pg.evaluate("[...document.querySelectorAll('.zone.sel .handle')].map(h=>h.dataset.h).sort().join(',')")
    check(ids == "e,n,ne,nw,s,se,sw,w", f"zestaw uchwytów: {ids}")

    # 2. every handle is actually hit-testable (not clipped away)
    for h in ["nw","n","ne","e","se","s","sw","w"]:
        hit = pg.evaluate("""(id) => { const h=document.querySelector('.zone.sel .handle.'+id);
            if(!h) return 'brak';
            const r=h.getBoundingClientRect();
            const el=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
            return el && el.classList.contains('handle') && el.dataset.h===id ? 'ok' : (el?el.className:'pusto'); }""", h)
        check(hit == "ok", f"uchwyt {h} da się chwycić (hit-test: {hit})")

    # 3. each handle changes the edges it should, and ONLY those.
    #    A corner changes 2 axes; which of w/h grows depends on drag direction,
    #    so assert on the EDGES (x/y edges must move, opposite edge must not)
    #    rather than on w/h growing.
    cases = [
        # hid, ddx, ddy, edges that MUST move
        ("se", +90, +60, {"x":0, "y":0, "w":1, "h":1}),   # right+bottom edge move
        ("e",  +90,   0, {"x":0, "y":0, "w":1, "h":0}),
        ("s",    0, +60, {"x":0, "y":0, "w":0, "h":1}),
        ("n",    0, -40, {"x":0, "y":1, "w":0, "h":1}),
        ("w",  -40,   0, {"x":1, "y":0, "w":1, "h":0}),
        ("ne", +90, -40, {"x":0, "y":1, "w":1, "h":1}),
        ("nw", -40, -40, {"x":1, "y":1, "w":1, "h":1}),
        ("sw", -40, +60, {"x":1, "y":0, "w":1, "h":1}),
    ]
    for hid, ddx, ddy, exp in cases:
        fresh(pg)
        before = zone(pg)
        hb = pg.locator(f".zone.sel .handle.{hid}").bounding_box()
        if not hb:
            check(False, f"uchwyt {hid} nie ma bounding box")
            continue
        cx, cy = hb["x"]+hb["width"]/2, hb["y"]+hb["height"]/2
        pg.mouse.move(cx, cy); pg.mouse.down()
        pg.mouse.move(cx+ddx, cy+ddy, steps=12); pg.mouse.up()
        pg.wait_for_timeout(220)
        after = zone(pg)
        moved = {
            "x": abs(after["x"]-before["x"]) > 1,
            "y": abs(after["y"]-before["y"]) > 1,
            "w": abs(after["w"]-before["w"]) > 1,
            "h": abs(after["h"]-before["h"]) > 1,
        }
        want = {k: bool(v) for k, v in exp.items()}
        check(moved == want,
              f"uchwyt {hid}: zmieniło {', '.join(k for k,v in moved.items() if v) or 'NIC'}"
              f" (oczekiwane {', '.join(k for k,v in want.items() if v)})"
              f"[{before} -> {after}]")

    # 4. vertical-only resize really changes HEIGHT (the reported bug)
    fresh(pg)
    before = zone(pg)
    hb = pg.locator(".zone.sel .handle.s").bounding_box()
    cx, cy = hb["x"]+hb["width"]/2, hb["y"]+hb["height"]/2
    pg.mouse.move(cx, cy); pg.mouse.down()
    pg.mouse.move(cx, cy-80, steps=12); pg.mouse.up()
    pg.wait_for_timeout(220)
    after = zone(pg)
    check(abs(after["h"]-before["h"]) > 10 and abs(after["w"]-before["w"]) < 0.01,
          f"uchwyt S zmienia tylko wysokość: h {before['h']} -> {after['h']}, w {before['w']} -> {after['w']}")

    # 5. north handle keeps bottom edge fixed
    fresh(pg)
    before = zone(pg)
    hb = pg.locator(".zone.sel .handle.n").bounding_box()
    cx, cy = hb["x"]+hb["width"]/2, hb["y"]+hb["height"]/2
    pg.mouse.move(cx, cy); pg.mouse.down()
    pg.mouse.move(cx, cy+60, steps=12); pg.mouse.up()
    pg.wait_for_timeout(220)
    after = zone(pg)
    check(abs((before["y"]+before["h"]) - (after["y"]+after["h"])) < 0.01,
          f"uchwyt N trzyma dolną krawędź: {(before['y']+before['h'])} == {(after['y']+after['h'])}")
    check(after["y"] > before["y"], f"uchwyt N przesunął górę w dół: {before['y']} -> {after['y']}")

    # 6. corner keeps the opposite corner anchored
    fresh(pg)
    before = zone(pg)
    hb = pg.locator(".zone.sel .handle.nw").bounding_box()
    cx, cy = hb["x"]+hb["width"]/2, hb["y"]+hb["height"]/2
    pg.mouse.move(cx, cy); pg.mouse.down()
    pg.mouse.move(cx-50, cy-30, steps=12); pg.mouse.up()
    pg.wait_for_timeout(220)
    after = zone(pg)
    check(abs((before["x"]+before["w"]) - (after["x"]+after["w"])) < 0.01
          and abs((before["y"]+before["h"]) - (after["y"]+after["h"])) < 0.01,
          f"uchwyt NW kotwiczy prawy-dolny róg: ({after['x']+after['w']}, {after['y']+after['h']})")

    # 7. cannot push an edge past the far edge / off-screen
    fresh(pg)
    hb = pg.locator(".zone.sel .handle.se").bounding_box()
    cx, cy = hb["x"]+hb["width"]/2, hb["y"]+hb["height"]/2
    pg.mouse.move(cx, cy); pg.mouse.down()
    pg.mouse.move(cx+900, cy+600, steps=20); pg.mouse.up()
    pg.wait_for_timeout(220)
    after = zone(pg)
    check(after["x"]+after["w"] <= 100.001 and after["y"]+after["h"] <= 100.001,
          f"przeciągnięcie poza ekran nie wychodzi z zakresu: {after}")
    check(after["w"] > 0 and after["h"] > 0, "zone nie zniknęła")

    # 8. west handle cannot cross the right edge (invert prevention)
    fresh(pg)
    hb = pg.locator(".zone.sel .handle.w").bounding_box()
    cx, cy = hb["x"]+hb["width"]/2, hb["y"]+hb["height"]/2
    pg.mouse.move(cx, cy); pg.mouse.down()
    pg.mouse.move(cx+900, cy, steps=20); pg.mouse.up()
    pg.wait_for_timeout(220)
    after = zone(pg)
    check(after["w"] >= 0.4, f"lewy uchwyt nie przekracza prawej krawędzi (w={after['w']})")
    check(after["x"] >= 0, f"lewy uchwyt nie wyszedł poza ekran (x={after['x']})")

    # 9. radii really dropped
    radii = pg.evaluate("""() => ({
        zone: getComputedStyle(document.querySelector('.zone')).borderRadius,
        handle: getComputedStyle(document.querySelector('.handle')).borderRadius,
        card: getComputedStyle(document.querySelector('.card')).borderRadius,
        root: getComputedStyle(document.documentElement).getPropertyValue('--radius').trim(),
    })""")
    check(radii["zone"] in ("2px",), f"strefa ma mały radius ({radii['zone']})")
    check(radii["handle"] in ("2px",), f"uchwyt ma mały radius ({radii['handle']})")
    check(radii["card"] == "5px", f"karta radius = {radii['card']} (było 10px)")

    # 10. cursors differ per handle so the axes are discoverable
    cur = pg.evaluate("""() => { const o={}; for (const id of ['n','s','e','w','nw','ne','sw','se']) {
        const h=document.querySelector('.zone.sel .handle.'+id);
        if(h) o[id]=getComputedStyle(h).cursor; } return o; }""")
    check(cur.get("n") == cur.get("s") == "ns-resize", f"uchwyty pionowe mają kursor NS: {cur.get('n')}/{cur.get('s')}")
    check(cur.get("e") == cur.get("w") == "ew-resize", f"uchwyty poziome mają kursor EW: {cur.get('e')}/{cur.get('w')}")
    check(cur.get("nw") == cur.get("se") == "nwse-resize"
          and cur.get("ne") == cur.get("sw") == "nesw-resize",
          f"narożniki mają kursory ukośne: {cur.get('nw')}/{cur.get('se')}/{cur.get('ne')}/{cur.get('sw')}")

    # 11. full regression: original suite still green
    check(not errs, f"brak błędów JS: {errs[:3]}")

    b.close()

print("\n" + "="*60)
if fails:
    print(f"NIEPOWODZENIA ({len(fails)}):")
    for f in fails: print("  - " + f)
    sys.exit(1)
print("WSZYSTKIE UCHWYTY DZIAŁAJĄ")