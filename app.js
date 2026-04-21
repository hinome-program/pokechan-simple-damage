/**
 * ポケチャンシンプルダメ計 | Battle Arena Edition
 * app.js — 完全オフライン版 + 努力値(EV)対応
 *
 * ⚠ type="module" なし: file:// でもCORSブロックされずに動作します
 * データソース: window.POKEMON_DATA（pokemon_data.js で定義）
 *
 * 計算仕様:
 *   使用するHP   = HP実数値   + HP努力値
 *   使用する防御 = 防御実数値 + 防御努力値
 *   使用する攻撃 = 攻撃実数値 + 攻撃努力値
 *   努力値は 0〜32 に制限
 */

(function () {
'use strict';

// ============================================================
// 実数値計算式（個体値31・努力値0・性格補正1.0 / Lv50固定）
// ============================================================
const calcHp   = function(b) { return b + 75; };
const calcStat = function(b) { return b + 20; };

// ============================================================
// EV値取得ヘルパー（0〜32にクランプ）
// ============================================================
function getEv(inputElem) {
    const v = parseInt(inputElem.value) || 0;
    return Math.max(0, Math.min(32, v));
}

// ============================================================
// ローカルデータ（pokemon_data.js が window.POKEMON_DATA を設定）
// ============================================================
const POKEMON_DATA = window.POKEMON_DATA || [];

if (POKEMON_DATA.length === 0) {
    console.error('[ポケチャン] pokemon_data.js が読み込まれていません。');
}

// ============================================================
// championsRoster: name → id のマッピング（サジェスト・画像用）
// ============================================================
const championsRoster = POKEMON_DATA.map(p => ({ name: p.name, id: p.id }));

// ============================================================
// 種族値ルックアップ（オフライン・同期）
// ============================================================
function getBaseStats(name) {
    const entry = POKEMON_DATA.find(p => p.name === name);
    return entry?.baseStats ?? null;
}

// ============================================================
// デフォルト表示
// ============================================================
const DEFAULTS = { attacker: 'リザードン', defender: 'ガブリアス' };

// ============================================================
// State
// ============================================================
let stabActive = false;

// ============================================================
// DOM Elements
// ============================================================
const el = {
    // 攻撃側
    attackerName:      document.getElementById('attacker-name'),
    attackerStat:      document.getElementById('attacker-stat'),
    attackerStatEv:    document.getElementById('attacker-stat-ev'),
    attackerStatTotal: document.getElementById('attacker-stat-total'),
    attackerMegaBtn:   document.getElementById('attacker-mega-btn'),
    attackerArtwork:   document.getElementById('attacker-artwork'),
    attackerFallback:  document.getElementById('attacker-fallback'),
    attackerPanel:     document.getElementById('attacker-panel'),

    // 防御側
    defenderName:      document.getElementById('defender-name'),
    defenderHp:        document.getElementById('defender-hp'),
    defenderHpEv:      document.getElementById('defender-hp-ev'),
    defenderHpTotal:   document.getElementById('defender-hp-total'),
    defenderStat:      document.getElementById('defender-stat'),
    defenderStatEv:    document.getElementById('defender-stat-ev'),
    defenderStatTotal: document.getElementById('defender-stat-total'),
    defenderMegaBtn:   document.getElementById('defender-mega-btn'),
    defenderArtwork:   document.getElementById('defender-artwork'),
    defenderFallback:  document.getElementById('defender-fallback'),
    defenderPanel:     document.getElementById('defender-panel'),

    // 共通
    movePower:    document.getElementById('move-power'),
    movePanel:    document.getElementById('move-panel'),
    typeRatio:    document.getElementById('type-ratio'),
    stabBtn:      document.getElementById('stab-btn'),
    swapBtn:      document.getElementById('swap-btn'),
    resultStatus: document.getElementById('result-status'),
    resultDetail: document.getElementById('result-detail'),
    datalist:     document.getElementById('pokemon-list'),
};

// ============================================================
// 初期化
// ============================================================
function init() {
    buildDatalist();
    buildPowerList();
    setupImageFallbacks();
    setupEventListeners();

    el.attackerName.value = DEFAULTS.attacker;
    el.defenderName.value = DEFAULTS.defender;
    updatePokemon('attacker');
    updatePokemon('defender');
}

// ============================================================
// 技の威力リスト（5〜300）生成
// ============================================================
function buildPowerList() {
    const frag = document.createDocumentFragment();
    for (let v = 5; v <= 300; v += 5) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        if (v === 90) opt.selected = true;
        frag.appendChild(opt);
    }
    el.movePower.appendChild(frag);
}

// ============================================================
// datalist（ロスター限定サジェスト）
// ============================================================
function buildDatalist() {
    const frag = document.createDocumentFragment();
    championsRoster.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        frag.appendChild(opt);
    });
    el.datalist.appendChild(frag);
}

// ============================================================
// 画像フォールバック設定
// ============================================================
function setupImageFallbacks() {
    ['attacker', 'defender'].forEach(side => {
        const img = el[`${side}Artwork`];
        const fb  = el[`${side}Fallback`];
        img.onload  = () => { img.classList.add('loaded'); fb.style.display = 'none'; };
        img.onerror = () => { img.classList.remove('loaded'); fb.style.display = 'flex'; };
    });
}

// ============================================================
// イベントリスナー
// ============================================================
function setupEventListeners() {
    // 実数値の変更 → 再計算
    [el.attackerStat, el.defenderHp, el.defenderStat, el.movePower, el.typeRatio]
        .forEach(input => input.addEventListener('input', () => {
            updateEvDisplay();
            calculate();
        }));

    // 努力値（EV）の変更 → クランプ → 再計算
    [el.attackerStatEv, el.defenderHpEv, el.defenderStatEv]
        .forEach(input => {
            input.addEventListener('input', () => {
                // 0〜32 に強制クランプ
                const v = parseInt(input.value) || 0;
                input.value = Math.max(0, Math.min(32, v));
                // 有効合計値の表示更新 → ダメージ再計算
                updateEvDisplay();
                calculate();
            });
            // フォーカスアウト時も再クランプ（直接打ち込まれた値への対応）
            input.addEventListener('blur', () => {
                const v = parseInt(input.value) || 0;
                input.value = Math.max(0, Math.min(32, v));
                updateEvDisplay();
                calculate();
            });
        });

    el.attackerName.addEventListener('change', () => updatePokemon('attacker'));
    el.defenderName.addEventListener('change', () => updatePokemon('defender'));

    el.stabBtn.addEventListener('click', () => {
        stabActive = !stabActive;
        el.stabBtn.classList.toggle('active', stabActive);
        calculate();
    });

    el.swapBtn.addEventListener('click', swapSides);
    el.attackerMegaBtn.addEventListener('click', () => {});
    el.defenderMegaBtn.addEventListener('click', () => {});
}

// ============================================================
// EV合計値の視覚フィードバック表示
// ============================================================
function updateEvDisplay() {
    const aEv  = getEv(el.attackerStatEv);
    const dEv  = getEv(el.defenderStatEv);
    const hpEv = getEv(el.defenderHpEv);

    // 攻撃合計
    if (aEv > 0) {
        const total = (parseInt(el.attackerStat.value) || 0) + aEv;
        el.attackerStatTotal.textContent = `(= ${total})`;
    } else {
        el.attackerStatTotal.textContent = '';
    }

    // HP合計
    if (hpEv > 0) {
        const total = (parseInt(el.defenderHp.value) || 0) + hpEv;
        el.defenderHpTotal.textContent = `(= ${total})`;
    } else {
        el.defenderHpTotal.textContent = '';
    }

    // 防御合計
    if (dEv > 0) {
        const total = (parseInt(el.defenderStat.value) || 0) + dEv;
        el.defenderStatTotal.textContent = `(= ${total})`;
    } else {
        el.defenderStatTotal.textContent = '';
    }
}

// ============================================================
// ポケモン更新（完全同期・オフライン動作）
// ============================================================
function updatePokemon(side) {
    const name    = el[`${side}Name`].value.trim();
    const pokemon = championsRoster.find(p => p.name === name);

    if (!pokemon) {
        el[`${side}Artwork`].classList.remove('loaded');
        el[`${side}Fallback`].style.display = 'flex';
        calculate();
        return;
    }

    const { id } = pokemon;

    // 画像: PokeAPI URL（オフライン時は onerror で ? シルエット）
    el[`${side}Fallback`].style.display = 'none';
    el[`${side}Artwork`].classList.remove('loaded');
    el[`${side}Artwork`].src =
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

    // 種族値: ローカルデータから同期取得
    const bs = getBaseStats(name);
    if (bs) {
        if (side === 'attacker') {
            el.attackerStat.value = Math.max(calcStat(bs.atk), calcStat(bs.spa));
        } else {
            el.defenderHp.value   = calcHp(bs.hp);
            el.defenderStat.value = Math.max(calcStat(bs.def), calcStat(bs.spd));
        }
    } else {
        console.warn(`[ポケチャン] ${name} の種族値データがありません`);
    }

    el[`${side}MegaBtn`].disabled = true;
    updateEvDisplay();
    calculate();
}

// ============================================================
// 攻守交代
// ============================================================
function swapSides() {
    // 名前を交換
    const tmpName = el.attackerName.value;
    el.attackerName.value = el.defenderName.value;
    el.defenderName.value = tmpName;
    // EVもリセット（交代後は0から）
    el.attackerStatEv.value = 0;
    el.defenderHpEv.value   = 0;
    el.defenderStatEv.value = 0;
    updateEvDisplay();
    updatePokemon('attacker');
    updatePokemon('defender');
}

// ============================================================
// ダメージ計算（Lv50固定）— EV補正込み
// ============================================================
function calculate() {
    const aPoke = championsRoster.find(p => p.name === el.attackerName.value.trim());
    const dPoke = championsRoster.find(p => p.name === el.defenderName.value.trim());

    if (!aPoke || !dPoke) {
        el.resultStatus.textContent      = 'スキャン中...';
        el.resultStatus.style.background = '#bdbdbd';
        el.resultDetail.textContent      = '0.0% 〜 0.0%';
        return;
    }

    // ── EV補正（努力値1 = 実数値+1、0〜32で制限）──
    const aEv  = getEv(el.attackerStatEv);
    const dEv  = getEv(el.defenderStatEv);
    const hpEv = getEv(el.defenderHpEv);

    const a     = Math.max(0, (parseInt(el.attackerStat.value) || 0) + aEv);
    const d     = Math.max(1, (parseInt(el.defenderStat.value) || 1) + dEv);
    const hp    = Math.max(1, (parseInt(el.defenderHp.value)   || 1) + hpEv);
    const power = parseInt(el.movePower.value) || 0;
    const stab  = stabActive ? 1.5 : 1.0;
    const ratio = parseFloat(el.typeRatio.value) || 1.0;

    // ── ダメージ計算式（Lv50）──
    const base  = Math.floor(Math.floor(Math.floor(22 * power * a / d) / 50) + 2);
    const final = Math.floor(base * stab * ratio);
    const min   = Math.floor(final * 0.85);
    const max   = final;

    showResult(min, max, hp);
}

// ============================================================
// 結果表示（[FATAL]/[RISK]/[STABLE]）
// ============================================================
function showResult(min, max, hp) {
    const minPct = (min / hp * 100).toFixed(1);
    const maxPct = (max / hp * 100).toFixed(1);
    el.resultDetail.textContent = `${minPct}% 〜 ${maxPct}%`;

    let text, color;

    if (max === 0) {
        text = '威力 0'; color = '#bdbdbd';
    } else if (min >= hp) {
        text = '[FATAL] 確定1発'; color = '#e53935';
    } else if (max >= hp) {
        const range = max - min + 1;
        const prob  = Math.max(0, Math.min(100,
            Math.floor((range - (hp - min)) / range * 100)));
        text = `[RISK] 乱数1発 (${prob}%)`; color = '#f57c00';
    } else {
        const avgHits = Math.ceil(hp / ((min + max) / 2));
        text = `[STABLE] 確定${avgHits}発`; color = '#43a047';
    }

    el.resultStatus.textContent      = text;
    el.resultStatus.style.background = color;
}

// ============================================================
// エントリーポイント — DOMContentLoaded で安全に初期化
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

}()); // IIFE 終わり
