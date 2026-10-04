import json, sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8099/index.html"
errs, fails = [], []

def check(cond, msg):
    print(("PASS  " if cond else "FAIL  ") + msg)
    if not cond:
        fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1500, "height": 1000})
    pg.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))

    pg.goto(URL, wait_until="load")
    pg.wait_for_timeout(400)

    # 1. boot: 3 default layouts rendered
    check(pg.locator(".tab").count() == 3, f"3 zakładki layoutu (jest {pg.locator('.tab').count()})")
    check(pg.locator(".zone").count() == 3, f"3 strefy w podglądzie (jest {pg.locator('.zone').count()})")

    # 2. no JS errors on boot
    check(not errs, f"brak błędów JS przy starcie: {errs}")

    # 3. default JSON matches KZones schema
    data = json.loads(pg.locator("#json").input_value())
    check(isinstance(data, list) and len(data) == 3, "JSON to lista 3 layoutów")
    z0 = data[0]["zones"][0]
    check(set(z0) == {"x", "y", "width", "height"}, f"klucze strefy dokładnie x/y/width/height -> {sorted(z0)}")
    check("padding" in data[0], "layout ma 'padding'")
    check(data[0]["padding"] == 0, "padding = 0")
    # sum of thirds should cover 100
    focus = data[0]["zones"]
    total = sum(z["width"] * z["height"] for z in focus) / 10000
    check(abs(total - 1.0) < 0.001, f"layout 25/50/25 pokrywa 100% (jest {total*100:.2f}%)")

    # 4. drag on a genuinely EMPTY area creates a zone.
    #    Layout 1 (Fokus) fills 100% of the canvas, so dragging there would move
    #    an existing zone — start a fresh layout to test zone creation.
    pg.locator(".tab-add").click()
    pg.wait_for_timeout(200)
    check(pg.locator(".zone").count() == 0, "nowy layout startuje bez stref")

    box = pg.locator("#canvas").bounding_box()
    pg.mouse.move(box["x"] + box["width"] * 0.2, box["y"] + box["height"] * 0.3)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] * 0.6, box["y"] + box["height"] * 0.8, steps=12)
    pg.mouse.up()
    pg.wait_for_timeout(200)
    n = pg.locator(".zone").count()
    check(n == 1, f"przeciągnięcie po pustym polu dodało strefę (jest {n})")

    # 5. the new zone landed where dropped, snapped to %, within bounds
    st = pg.evaluate("window.__kzones.state")
    L, zi = st["layouts"][st["li"]], st["zi"]
    nz = L["zones"][zi]
    check(nz["x"] == 20 and nz["y"] == 30, f"strefa zaczyna tam, gdzie zaczęto drag ({nz['x']},{nz['y']})")
    check(0 <= nz["x"] <= 100 and 0 <= nz["y"] <= 100, f"nowa strefa w zakresie 0-100 ({nz['x']},{nz['y']})")
    check(nz["width"] > 10 and nz["height"] > 10, f"nowa strefa ma sensowny rozmiar ({nz['width']}x{nz['height']})")
    check(nz["x"] + nz["width"] <= 100.001 and nz["y"] + nz["height"] <= 100.001,
          "nowa strefa nie wychodzi poza ekran")

    # 6. drag INSIDE an existing zone moves it instead of creating a new one
    pg.mouse.move(box["x"] + box["width"] * 0.4, box["y"] + box["height"] * 0.5)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.6, steps=10)
    pg.mouse.up()
    pg.wait_for_timeout(200)
    check(pg.locator(".zone").count() == 1, "przeciąganie po strefie nie tworzy nowej")
    print(f"      walidacja: {pg.locator('.v-item').all_inner_texts()}")

    # 7. resize handle changes width
    before = pg.evaluate("window.__kzones.state.layouts[window.__kzones.state.li].zones[window.__kzones.state.zi].width")
    hd = pg.locator(".zone.sel .handle.se").bounding_box()
    pg.mouse.move(hd["x"] + 6, hd["y"] + 6)
    pg.mouse.down()
    pg.mouse.move(hd["x"] - 120, hd["y"] + 6, steps=10)
    pg.mouse.up()
    pg.wait_for_timeout(150)
    after = pg.evaluate("window.__kzones.state.layouts[window.__kzones.state.li].zones[window.__kzones.state.zi].width")
    check(abs(after - before) > 5, f"uchwyt zmienił szerokość {before} -> {after}")

    # 8. keyboard: arrow moves, Delete removes
    st2 = pg.evaluate("window.__kzones.state")
    x_before = st2["layouts"][st2["li"]]["zones"][st2["zi"]]["x"]
    pg.keyboard.press("ArrowRight")
    pg.wait_for_timeout(120)
    x_after = pg.evaluate("window.__kzones.state.layouts[window.__kzones.state.li].zones[window.__kzones.state.zi].x")
    check(x_after > x_before, f"strzałka przesunęła strefę {x_before} -> {x_after}")
    cnt = pg.locator(".zone").count()
    pg.keyboard.press("Delete")
    pg.wait_for_timeout(150)
    check(pg.locator(".zone").count() == cnt - 1, "Delete usunął strefę")

    # 9. side inputs -> JSON (applications + indicator)
    #    the layout under test lost its only zone to Delete above; go back to
    #    layout 1 (Fokus, 3 zones) so there is something to select
    pg.locator(".tab").first.click()
    pg.wait_for_timeout(150)
    check(pg.locator(".zone").count() == 3, "wróciliśmy do layoutu 1 z 3 strefami")
    pg.locator(".zone").first.click()
    pg.wait_for_timeout(100)
    pg.locator("#z-apps").fill("firefox\nkonsole")
    pg.locator("#z-ind-pos").select_option("top-left")
    pg.locator("#z-ind-t").fill("12")
    pg.wait_for_timeout(250)
    data = json.loads(pg.locator("#json").input_value())
    zz = data[0]["zones"][0]
    check(zz.get("applications") == ["firefox", "konsole"], f"applications trafiają do JSON: {zz.get('applications')}")
    check(zz.get("indicator", {}).get("position") == "top-left", f"indicator.position: {zz.get('indicator')}")
    check(zz.get("indicator", {}).get("margin", {}).get("top") == 12, f"indicator.margin.top: {zz.get('indicator')}")

    # 10. indicator with no margin must NOT emit empty margin object
    pg.locator("#z-ind-t").fill("0")
    pg.wait_for_timeout(200)
    zz = json.loads(pg.locator("#json").input_value())[0]["zones"][0]
    check("margin" not in zz.get("indicator", {}), f"pusty margin pominięty: {zz.get('indicator')}")

    # 11. preset replaces current layout
    n0 = pg.locator(".zone").count()
    pg.locator("#preset").select_option("grid")
    pg.locator("#preset-n").fill("4")
    pg.wait_for_timeout(250)
    n1 = pg.locator(".zone").count()
    check(n1 == 16, f"preset siatka 4x4 dał 16 stref (było {n0}, jest {n1})")
    d = json.loads(pg.locator("#json").input_value())
    g = d[0]["zones"]
    check(abs(g[0]["width"] - 25) < 0.01 and abs(g[1]["x"] - 25) < 0.01, f"podział 4x4 poprawny: {g[0]} {g[1]}")

    # 12. import round-trip
    sample = json.dumps([{"name": "Import test", "padding": 8,
                          "zones": [{"x": 0, "y": 0, "width": 60, "height": 50, "applications": ["kate"]},
                                    {"x": 60, "y": 0, "width": 40, "height": 50}]}])
    pg.locator("#btn-import").click()
    pg.wait_for_timeout(200)
    pg.locator("#import-text").fill(sample)
    pg.locator("#btn-import-ok").click()
    pg.wait_for_timeout(300)
    check(pg.locator(".tab").count() == 1, f"import zastąpił layouty (jest {pg.locator('.tab').count()})")
    d = json.loads(pg.locator("#json").input_value())
    check(d[0]["name"] == "Import test" and d[0]["padding"] == 8, f"import zachował pola: {d[0]['name']}/{d[0]['padding']}")
    check(d[0]["zones"][0]["applications"] == ["kate"], "import zachował applications")

    # 13. bad import must not corrupt state; dialog stays open so the text can
    #     be fixed in place — close it before continuing
    pg.locator("#btn-import").click()
    pg.wait_for_timeout(150)
    pg.locator("#import-text").fill("{ to nie jest json")
    pg.locator("#btn-import-ok").click()
    pg.wait_for_timeout(250)
    check(pg.locator("#dlg-import").is_visible(), "zły import zostawia dialog otwarty do poprawki")
    d2 = json.loads(pg.locator("#json").input_value())
    check(d2[0]["name"] == "Import test", "zły import nie zepsuł stanu")
    pg.locator("#btn-import-cancel").click()
    pg.wait_for_timeout(200)
    check(not pg.locator("#dlg-import").is_visible(), "dialog zamknięty po anulowaniu")

    # 14. overlap detection actually fires
    pg.locator("#btn-add-zone").click()
    pg.wait_for_timeout(150)
    pg.evaluate("""window.__kzones.state.layouts[window.__kzones.state.li].zones[1] =
        {x: 10, y: 10, width: 50, height: 50}""")
    pg.locator("#lay-name").dispatch_event("input")
    pg.wait_for_timeout(200)
    check(pg.locator(".v-err").count() > 0, "wykryto nakładanie się stref")

    # 15. reload -> localStorage restore
    pg.reload(wait_until="load")
    pg.wait_for_timeout(400)
    d3 = json.loads(pg.locator("#json").input_value())
    check(d3[0]["name"] == "Import test", f"stan przeżył reload: {d3[0]['name']}")

    # 16. visual
    pg.locator("#preset").select_option("main-side")
    pg.wait_for_timeout(250)
    pg.locator(".zone").first.click()
    pg.wait_for_timeout(150)
    pg.locator("#z-color-picker").evaluate("e => { e.value = '#ff5555'; e.dispatchEvent(new Event('input')) }")
    pg.wait_for_timeout(200)
    d4 = json.loads(pg.locator("#json").input_value())
    check(d4[0]["zones"][0].get("color") == "#ff5555", f"picker koloru -> JSON: {d4[0]['zones'][0].get('color')}")

    check(not errs, f"brak błędów JS w całym teście: {errs[:4]}")

    pg.screenshot(path="/tmp/kzones-full.png", full_page=True)
    pg.locator(".col-main").screenshot(path="/tmp/kzones-main.png")
    b.close()

print()
print("=" * 60)
if fails:
    print(f"NIEPOWODZENIA ({len(fails)}):")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("WSZYSTKIE TESTY PRZESZŁY")