#!/usr/bin/env bash
# Prove each CI gate actually fails on bad input, then passes again.
# A gate that has never failed proves nothing about what it checks.
#
# Two traps this harness exists to avoid:
#   1. asserting exit==0 where non-zero is expected (the control rows)
#   2. a mutation that silently did not apply — then the gate looks broken
#      when it was never actually given bad input. Every mutate step verifies
#      its own edit landed before blaming the gate.
set -uo pipefail
cd "$(dirname "$0")/.."

FAILURES=0
quiet() { "$@" >/dev/null 2>&1; }

check_ok() {
  local code=$1 name=$2
  if [ "$code" -eq 0 ]; then echo "  ok    $name"
  else echo "  WRONG $name — expected pass, got exit=$code"; FAILURES=$((FAILURES+1)); fi
}

check_bites() {
  local code=$1 name=$2
  if [ "$code" -ne 0 ]; then echo "  ok    $name"
  else echo "  DEAD  $name — gate passed on bad input, it does not bite"; FAILURES=$((FAILURES+1)); fi
}

BK=.ci-break
rm -rf "$BK"; mkdir -p "$BK"
cp kzones/app.js "$BK/app.js"
cp kzones/index.html "$BK/index.html"
cp kzones/style.css "$BK/style.css"
cp index.html "$BK/landing.html"
cleanup() {
  cp "$BK/app.js" kzones/app.js
  cp "$BK/index.html" kzones/index.html
  cp "$BK/style.css" kzones/style.css
  cp "$BK/landing.html" index.html
  rm -rf "$BK"
}
trap cleanup EXIT

# mutate <file> <sed-expr> <must-appear-after> — verifies the edit landed
mutate() {
  local file=$1 expr=$2 expect=$3
  sed -i "$expr" "$file"
  if grep -q -- "$expect" "$file"; then return 0; fi
  echo "  ERR   mutation did not apply to $file (looked for '$expect') — harness bug"
  FAILURES=$((FAILURES+1))
  return 1
}

echo "== control: all five gates green on the untouched tree =="
quiet npx eslint kzones/app.js;             check_ok $? "eslint passes"
quiet npx stylelint kzones/style.css;      check_ok $? "stylelint passes"
quiet npx html-validate kzones/index.html; check_ok $? "html-validate passes"
quiet node scripts/check-ids.mjs;          check_ok $? "check-ids passes"
quiet node scripts/check-links.mjs;        check_ok $? "check-links passes"

echo
echo "== break each thing on purpose, gate must go red =="

echo "-- undefined variable --"
printf '\nconst ci_probe = notDefinedAnywhere + 1;\n' >> kzones/app.js
quiet npx eslint kzones/app.js; check_bites $? "eslint catches an undefined variable"
cp "$BK/app.js" kzones/app.js

echo "-- unused variable --"
printf '\nconst ci_probe_unused = 42;\n' >> kzones/app.js
quiet npx eslint kzones/app.js; check_bites $? "eslint catches an unused variable"
cp "$BK/app.js" kzones/app.js

echo "-- unclosed element --"
printf '<div>\n' >> kzones/index.html
quiet npx html-validate kzones/index.html; check_bites $? "html-validate catches an unclosed element"
cp "$BK/index.html" kzones/index.html

echo "-- unknown CSS property --"
printf '\n.ci-probe { colr: red; }\n' >> kzones/style.css
quiet npx stylelint kzones/style.css; check_bites $? "stylelint catches an unknown property"
cp "$BK/style.css" kzones/style.css

echo "-- renamed id, script still looks it up --"
if mutate kzones/index.html 's/id="canvas"/id="canvas-renamed-by-ci-probe"/' 'canvas-renamed-by-ci-probe'; then
  quiet node scripts/check-ids.mjs; check_bites $? "check-ids catches a renamed id"
fi
cp "$BK/index.html" kzones/index.html

echo "-- id deleted from the HTML --"
if mutate kzones/index.html 's/ id="lay-padding"//' 'id="lay-name"'; then
  quiet node scripts/check-ids.mjs; check_bites $? "check-ids catches a deleted id"
fi
cp "$BK/index.html" kzones/index.html

echo "-- landing page links a missing stylesheet --"
# index.html uses single quotes on this attribute; match that quoting style
if mutate index.html "s|href='main.css'|href='does-not-exist.css'|" "does-not-exist.css"; then
  quiet node scripts/check-links.mjs; check_bites $? "check-links catches a missing asset"
fi
cp "$BK/landing.html" index.html

echo "-- page links an empty file --"
if mutate kzones/index.html 's|href="style.css"|href="../empty-probe.css"|' 'empty-probe.css'; then
  : > empty-probe.css
  quiet node scripts/check-links.mjs; check_bites $? "check-links catches an empty target"
  rm -f empty-probe.css
fi
cp "$BK/index.html" kzones/index.html

echo
echo "== tree restored, all gates green again =="
quiet npx eslint kzones/app.js && quiet npx stylelint kzones/style.css \
  && quiet npx html-validate kzones/index.html && quiet node scripts/check-ids.mjs \
  && quiet node scripts/check-links.mjs
check_ok $? "all five gates pass after restore"

echo
if [ "$FAILURES" -gt 0 ]; then
  echo "$FAILURES problem(s) above — fix the gate or the harness, not the input."
  exit 1
fi
echo "every gate bites on bad input and passes on good input"