# CI

Linting i testy dla `kzones/` — wizualnego generatora layoutów KZones.

## Joby

| Job | Co robi |
|---|---|
| `lint` | ESLint (`kzones/app.js`), Stylelint (`kzones/style.css`), html-validate (`kzones/index.html`) |
| `check-doc` | `check-ids.mjs` — każde `$('#id')` w skrypcie istnieje w HTML; `check-links.mjs` — względne linki i assety się rozwiązują |
| `test` | Playwright: `test_app.py` + `test_handles.py` w prawdziwym Chromium |

## Dlaczego `check-ids` jest własny

To jedyna bramka, która łapie realny błąd: zmiana nazwy `id` w HTML przy braku zmiany w skrypcie. ESLint tego nie widzi (oba pliki są osobno poprawne), a w runtime objawia się jako `null` bez żadnej pomocniczej informacji.

## Uruchomienie lokalnie

```sh
npm ci                # instaluje eslint/stylelint/html-validate + globals
npm run lint
npm run lint:css
npm run lint:html
npm run check:ids
npm run check:links

cd kzones && python3 -m http.server 8099 --bind 127.0.0.1 &
python3 kzones/test_app.py
python3 kzones/test_handles.py
```

Testy Playwright wymagają `pip install playwright && python3 -m playwright install chromium`.

## Dowód, że bramki wgryzają

```sh
bash scripts/prove-gates-bite.sh
```

Skrypt psuje każdą bramkę po kolei (niezdefiniowana zmienna, niedomknięty tag, nieznana
właściwość CSS, zmienione `id`, usunięte `id`, zepsuty link, pusty plik) i wymaga
non-zero exit przy każdym psuciu oraz zielonego stanu po przywróceniu. Bramka, która
nigdy nie zawiodła, nie dowodzi niczego o tym, co sprawdza.

## Zakres

Linting obejmuje **tylko `kzones/`**. Pozostałe katalogi repo (`cs/`, `quiz/`, `vr/`,
`sharp-aquasodium/`, …) to starsze ręcznie pisane strony — nie są nasze do
przeformatowywania, a `check-links` celowo nie sprawdza ich linków bezwzględnych
do `michaumiau.github.io`, bo wymagałoby sieci.

## Wyłączone reguły — dlaczego

Każda wyłączona reguła ma komentarz w `eslint.config.js` / `.stylelintrc.json` /
`.htmlvalidate.json` podający powód. Najczęstsze:

- `no-implicit-globals` — `app.js` jest ładowany jako klasyczny `<script src>`
  (bez `type="module"`), więc deklaracje na najwyższym poziomie są globalne z założenia.
- `declaration-block-single-line-max-declarations` — arkusz jest pisany z regułami
  w jednej linii (`* { box-sizing: border-box; margin: 0; }`) dla zwięzłości.
- `value-keyword-case` przy `--mono` — `SFMono-Regular`/`Menlo`/`Consolas` to nazwy
  własne fontów; zniżenie ich psuje dopasowanie fontu.