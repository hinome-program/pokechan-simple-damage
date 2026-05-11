#!/usr/bin/env python3
"""
health_check.py  — ポケチャンデータ整合性ヘルスチェック
---------------------------------------------------------
pokemon_data.json の全エントリについて：
  1. PokeAPI にポケモンが存在するか（スラッグ解決）
  2. 公式アートワーク画像 URL が 200 を返すか
  3. 名前・ID に明らかな不整合がないか
をチェックし、問題リストをコンソールに出力します。

実行: python3 health_check.py
依存: Python 3.8+ 標準ライブラリのみ（aiohttp 不要）
"""

import asyncio
import json
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

# ──────────────────────────────────────────
# 設定
# ──────────────────────────────────────────
JSON_PATH     = "pokemon_data.json"
POKEAPI_BASE  = "https://pokeapi.co/api/v2"
MAX_WORKERS   = 8          # 並列リクエスト数
REQUEST_DELAY = 0.05       # 各スレッドの待機時間 (秒)
TIMEOUT       = 8          # HTTP タイムアウト (秒)

# ──────────────────────────────────────────
# 名前 → PokeAPI スラッグ変換（app.js と同一ロジック）
# ──────────────────────────────────────────
_species_cache: dict[int, str] = {}   # dexId → English base name

def fetch_species_name(dex_id: int) -> Optional[str]:
    """pokemon-species エンドポイントから英語名を取得（キャッシュ利用）"""
    if dex_id in _species_cache:
        return _species_cache[dex_id]
    if dex_id <= 0:
        return None
    url = f"{POKEAPI_BASE}/pokemon-species/{dex_id}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "poketyan-healthcheck/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = json.loads(r.read())
        name = data["name"]
        _species_cache[dex_id] = name
        return name
    except Exception:
        return None


# ポケモン名 → 確定スラッグ マッピング（app.js の SLUG_OVERRIDES と完全同期）
SLUG_OVERRIDES = {
    'ギルガルド':             'aegislash-shield',
    'ギルガルド(シールド)':    'aegislash-shield',
    'ギルガルド(ブレード)':    'aegislash-blade',
    'パンプジン(小さい)':     'gourgeist-small',
    'パンプジン(普通)':       'gourgeist-average',
    'パンプジン(大きい)':     'gourgeist-large',
    'パンプジン(特大)':       'gourgeist-super',
    'ミミッキュ':             'mimikyu-disguised',
    'モルペコ':              'morpeko-full-belly',
    'ケンタロス(パルデア単)': 'tauros-paldea-combat-breed',
    'ケンタロス(パルデア炎)': 'tauros-paldea-blaze-breed',
    'ケンタロス(パルデア水)': 'tauros-paldea-aqua-breed',
    'イルカマン(ナイーブ)':    'palafin-zero',
    'イルカマン(マイティ)':    'palafin-hero',
    'カエンジシ':             'pyroar-male',
    'フラエッテ(えいえんのはな)': 'floette-eternal',
}

def build_slug(pokemon: dict, base_name: str) -> str:
    """app.js と同一のスラッグ構築ロジック（SLUG_OVERRIDES 優先）"""
    j = pokemon["name"]
    # 確定スラッグのある個体は即決
    if j in SLUG_OVERRIDES:
        return SLUG_OVERRIDES[j]
    slug = base_name
    if pokemon.get("isMega"):
        slug += "-mega"
        if "X" in j:
            slug += "-x"
        elif "Y" in j:
            slug += "-y"
    elif "アローラ" in j:
        slug += "-alola"
    elif "ガラル" in j:
        slug += "-galar"
    elif "パルデア" in j:
        slug += "-paldea"
    elif "ヒスイ" in j:
        slug += "-hisui"
    elif "まひる" in j:
        slug += "-midday"
    elif "まよなか" in j:
        slug += "-midnight"
    elif "たそがれ" in j:
        slug += "-dusk"
    elif "オス" in j:
        slug += "-male"
    elif "メス" in j:
        slug += "-female"
    return slug


def check_pokemon_url(url: str) -> bool:
    """URL が 200 を返すか HEAD リクエストで確認"""
    try:
        req = urllib.request.Request(url, method="HEAD",
                                     headers={"User-Agent": "poketyan-healthcheck/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status == 200
    except Exception:
        return False


def fetch_pokemon_data(slug: str) -> Optional[dict]:
    """pokemon エンドポイントから sprites を取得"""
    url = f"{POKEAPI_BASE}/pokemon/{slug}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "poketyan-healthcheck/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    except Exception:
        return None


# ──────────────────────────────────────────
# 1件検証（スレッドプールから呼ばれる）
# ──────────────────────────────────────────
def validate_one(pokemon: dict, idx: int, total: int) -> dict:
    time.sleep(REQUEST_DELAY)
    name   = pokemon["name"]
    dex_id = pokemon.get("dexId", 0)
    poke_id = pokemon.get("id", 0)
    result = {
        "name"        : name,
        "dexId"       : dex_id,
        "id"          : poke_id,
        "issues"      : [],
        "image_url"   : None,
        "image_ok"    : None,
        "slug_used"   : None,
        "base_name"   : None,
    }

    # ① dexId が 0 以下 → 検証不能
    if dex_id <= 0:
        result["issues"].append("dexId が 0 (検証スキップ)")
        return result

    # ② species 英語名取得
    base_name = fetch_species_name(dex_id)
    if not base_name:
        result["issues"].append(f"species/{dex_id} 取得失敗（404 or タイムアウト）")
        return result
    result["base_name"] = base_name

    # ③ スラッグ構築 + pokemon エンドポイント確認
    slug = build_slug(pokemon, base_name)
    result["slug_used"] = slug

    pdata = fetch_pokemon_data(slug)

    # スラッグで 404 → 基本形で再試行
    fallback_used = False
    if pdata is None and slug != base_name:
        pdata = fetch_pokemon_data(base_name)
        if pdata:
            fallback_used = True
            result["issues"].append(f"スラッグ '{slug}' で 404 → 基本形 '{base_name}' にフォールバック")

    if pdata is None:
        result["issues"].append(f"pokemon/{slug} も pokemon/{base_name} も 404")
        return result

    # ④ 画像 URL チェック
    try:
        art_url = pdata["sprites"]["other"]["official-artwork"]["front_default"]
        nrm_url = pdata["sprites"]["front_default"]
    except (KeyError, TypeError):
        art_url = None
        nrm_url = None

    if art_url:
        ok = check_pokemon_url(art_url)
        result["image_url"] = art_url
        result["image_ok"]  = ok
        if not ok:
            result["issues"].append(f"公式 artwork URL が 404: {art_url}")
    else:
        result["image_ok"] = False
        result["issues"].append("公式 artwork URL が null (sprites データなし)")
        # 通常スプライトで確認
        if nrm_url:
            ok2 = check_pokemon_url(nrm_url)
            result["image_url"] = nrm_url
            if ok2:
                result["issues"].append("  → 通常スプライトは取得可能")

    # ⑤ PokeAPI の id と json の id が乖離していないか
    # リージョンフォームは json.id が PokeAPI フォームID と一致すれば問題なし
    api_id = pdata.get("id")
    if api_id and poke_id not in (0, api_id):
        # メガ・リージョン以外の基本種のみ警告
        if not pokemon.get("isMega") and dex_id == poke_id and api_id != poke_id:
            result["issues"].append(f"ID ズレ: json.id={poke_id}, PokeAPI.id={api_id}")

    progress = f"[{idx+1:3d}/{total}]"
    status   = "✅" if not result["issues"] else "⚠️ "
    print(f"  {progress} {status} {name} ({slug})", flush=True)

    return result


# ──────────────────────────────────────────
# メイン
# ──────────────────────────────────────────
def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    total = len(data)
    print(f"\n🔍 ポケチャン ヘルスチェック開始 — {total} 件")
    print(f"   並列ワーカー: {MAX_WORKERS} | タイムアウト: {TIMEOUT}s\n")

    results = []
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(validate_one, p, i, total): i
            for i, p in enumerate(data)
        }
        for fut in as_completed(futures):
            try:
                results.append(fut.result())
            except Exception as e:
                results.append({"name": "?", "issues": [f"例外: {e}"], "image_ok": False})

    elapsed = time.time() - t0

    # 元の順番に戻す
    name_to_result = {r["name"]: r for r in results}
    ordered = [name_to_result.get(p["name"], {"name": p["name"], "issues": ["結果なし"]})
               for p in data]

    # ──────────────────────────────
    # レポート出力
    # ──────────────────────────────
    ok_count        = sum(1 for r in ordered if not r.get("issues"))
    warn_count      = sum(1 for r in ordered if r.get("issues"))
    img_ok_count    = sum(1 for r in ordered if r.get("image_ok") is True)
    img_fail_count  = sum(1 for r in ordered if r.get("image_ok") is False)

    print("\n" + "="*60)
    print(" 📋 ヘルスチェック レポート")
    print("="*60)
    print(f"  総数         : {total}")
    print(f"  ✅ 問題なし  : {ok_count}")
    print(f"  ⚠️  要確認   : {warn_count}")
    print(f"  🖼  画像OK   : {img_ok_count}")
    print(f"  🚫 画像NG   : {img_fail_count}")
    print(f"  ⏱  経過時間 : {elapsed:.1f}秒")
    print("="*60)

    if warn_count > 0:
        print("\n🚨 修正が必要なリスト:\n")
        for r in ordered:
            if not r.get("issues"):
                continue
            print(f"  【{r['name']}】  dexId={r.get('dexId')}  id={r.get('id')}  slug={r.get('slug_used')}")
            for issue in r["issues"]:
                print(f"      → {issue}")
    else:
        print("\n🎉 全データ問題なし！")

    # JSON でも出力
    report_path = "health_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)
    print(f"\n📄 詳細レポートを {report_path} に保存しました。\n")


if __name__ == "__main__":
    main()
