# KZones Layout Builder — Playwright smoke test

Testuje generator layoutów KZones (`index.html`) w prawdziwej przeglądarce:
interakcję myszką, edycję pól, generowany JSON, walidację i import.

## Uruchomienie

```sh
cd dd/kzones && python3 -m http.server 8099 --bind 127.0.0.1 &
python3 test_app.py
```

Wymaga `pip install playwright && playwright install chromium`.

## Co jest sprawdzane

- start: layouty domyślne, brak błędów JS
- schema JSON zgodna z KZones (`x`/`y`/`width`/`height`, `padding`)
- rysowanie strefy przeciągnięciem po pustym polu (z wyrównaniem do siatki)
- przeciąganie po istniejącej strefie przesuwa ją zamiast tworzyć nową
- uchwyty resize zmieniają szerokość
- strzałki przesuwają strefę, `Del` ją usuwa
- pola boczne (`applications`, `indicator`, kolor) trafiają do JSON-a
- pusty `indicator.margin` nie jest serializowany
- presety (siatka N×N dzielona poprawnie)
- import round-trip oraz odporność na zły JSON
- wykrywanie nakładania się stref
- stan przeżywa reload (localStorage)