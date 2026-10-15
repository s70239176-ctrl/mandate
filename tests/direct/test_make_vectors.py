"""Regenerates tests/vectors/fingerprint.json from the contract's own cleaner. Run with GEN_VECTORS=1."""
import json
import os

import pytest

from conftest import contract_module

OUT = os.path.join(os.path.dirname(__file__), "..", "vectors", "fingerprint.json")

CASES = [
    ("plain", "Heap overflow in parse_header.\nRepro: 70000 bytes.", None),
    ("markdown angle brackets", "Use `Vec<u8>` and if a < b && c > d then <T> overflows.", None),
    ("html basic", "<!doctype html><html><body><p>Heap <b>overflow</b></p></body></html>", "text/html; charset=utf-8"),
    ("html script and style", "<html><head><style>p{color:red}</style></head><body><SCRIPT type='x'>evil()</SCRIPT>ok</body></html>", "text/html"),
    ("html scripted lookalike", "<html><body><scripture>kept as a tag-stripped word</scripture> tail</body></html>", "text/html"),
    ("html sniffed without header", "<!DOCTYPE HTML><html><body>sniffed <i>page</i></body></html>", None),
    ("html comment-like", "<html><body>a<!-- c -->b</body></html>", "text/html"),
    ("markdown served as html is stripped", "<p>hi</p> text", "text/html"),
    ("whitespace runs", "a \t\t b\r\n\r\n\r\n   \n\nc   d", None),
    ("blank line collapse", "line one\n\n\n\n\nline two\n \n \nline three", None),
    ("delimiters defused", "x <<<RUBRIC y RUBRIC>>> z >>>", None),
    ("leading and trailing space", "\n\n   padded text   \n\n", None),
    ("unicode", "Überlauf im Parser: 溢出 ☃ \U0001F4A5 emoji", None),
    ("vertical tab and form feed", "a\x0bb\x0cc", None),
    ("nbsp is not ASCII space", "a b c", None),
    ("empty after strip", "   \n\n  ", None),
    ("invalid utf8", None, None),
    ("long page truncated at 8000 code points", "x" * 7990 + "\U0001F4A5" * 20, None),
    ("html uppercase tags", "<HTML><BODY><P>Upper</P></BODY></HTML>", "text/HTML"),
    ("non-html with html header absent", "<div>not sniffed as html</div> plain", "text/plain"),
]


@pytest.mark.skipif(not os.environ.get("GEN_VECTORS"), reason="set GEN_VECTORS=1 to regenerate")
def test_generate(world):
    m = contract_module()
    out = []
    for name, body, ctype in CASES:
        raw = b"ok \xff\xfe broken \xc3 bytes" if body is None else body.encode("utf-8")
        text = m.clean_page(raw, headers={"content-type": ctype} if ctype else None)
        entry = {"name": name, "body_hex": raw.hex(), "body": "" if body is None else body, "text": text, "hash": m.content_hash(text)}
        if ctype:
            entry["content_type"] = ctype
        out.append(entry)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
