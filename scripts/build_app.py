"""ui/prototype.html から公開用の app/ を組み立てる（PWA: manifest・アイコン・オフラインキャッシュ）"""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "ui/prototype.html").read_text(encoding="utf-8")
cut = src.index("</style>") + len("</style>")
head, body = src[:cut], src[cut:]
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "")
page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#101010">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="myfinance">
<meta name="robots" content="noindex">
<link rel="manifest" href="/manifest.webmanifest?v=2">
<link rel="icon" type="image/png" sizes="48x48" href="/icons/owl-48.png?v=2">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/owl-192.png?v=2">
<link rel="apple-touch-icon" sizes="180x180" href="/icons/owl-touch-180.png?v=2">
<link rel="apple-touch-startup-image" href="/icons/splash.png">
<meta property="og:title" content="myfinance">
<meta property="og:image" content="https://myfinance.toneclown17.workers.dev/icons/og.png">
<meta name="twitter:card" content="summary_large_image">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}</style>
{head}
</head>
<body>
{body}
<script>if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(()=>{{}}));</script>
</body>
</html>
"""
(root / "app/index.html").write_text(page, encoding="utf-8")
print("app/index.html", len(page))

# Worker に同梱する静的ファイル（app/ の中身）を worker/static.js に書き出す
import base64, json
TYPES = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
         ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".json": "application/json"}
files = {}
for f in sorted((root / "app").rglob("*")):
    if f.is_file() and f.suffix in TYPES:
        files["/" + f.relative_to(root / "app").as_posix()] = {"type": TYPES[f.suffix], "b64": base64.b64encode(f.read_bytes()).decode()}
(root / "worker/static.js").write_text("// 生成ファイル: scripts/build_app.py が app/ から作る。手で編集しない\nexport const FILES = " + json.dumps(files) + ";\n", encoding="utf-8")
print("worker/static.js", len(files), "files")
