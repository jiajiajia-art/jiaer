# -*- coding: utf-8 -*-
import json
import os
import re

import json5

HERE = os.path.dirname(os.path.abspath(__file__))
mjs = os.path.join(HERE, "_gen-lib-locales.mjs")
text = open(mjs, encoding="utf-8").read()


def parse_block(var: str) -> dict:
    m = re.search(rf"const {var} = ", text)
    if not m:
        raise SystemExit(f"var {var} not found")
    start = text.index("{", m.end())
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return json5.loads(text[start : i + 1])
    raise SystemExit(f"unclosed {var}")


zh = parse_block("zh")
en = parse_block("enFull")
ja = parse_block("jaFull")

for fname, data in [("lib.zh.json", zh), ("lib.en.json", en), ("lib.ja.json", ja)]:
    with open(os.path.join(HERE, fname), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

print("wrote lib.zh.json, lib.en.json, lib.ja.json")
