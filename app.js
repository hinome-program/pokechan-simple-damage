/**
 * ポケチャンシンプルダメ計 | Battle Arena Edition
 * app.js — pokemon_data.json を fetch で非同期取得して動作
 */

(function () {
'use strict';

// POKEMON_DATA は fetch 後に設定される
var POKEMON_DATA = [];

// ============================================================
// ② NFKC 正規化ヘルパー
// ============================================================
function norm(str) {
    return String(str || '').normalize('NFKC').trim();
}

// ============================================================
// ③ データ検索ヘルパー
// ============================================================
function findPokemon(nameInput) {
    var key = norm(nameInput);
    if (!key) return null;
    for (var i = 0; i < POKEMON_DATA.length; i++) {
        if (norm(POKEMON_DATA[i].name) === key) return POKEMON_DATA[i];
    }
    return null;
}

function getBaseStats(nameInput) {
    var p = findPokemon(nameInput);
    return p ? p.baseStats : null;
}

function getPokemonTypes(nameInput) {
    var p = findPokemon(nameInput);
    return p ? p.types : [];
}

// ============================================================
// ④ 実数値計算式（Lv50・個体値31・性格補正1.0固定）
// ============================================================
var calcHp   = function(b) { return b + 75; };
var calcStat = function(b) { return b + 20; };

// ============================================================
// ⑤ ランク倍率（-6〜+6）
// ============================================================
function getRankMultiplier(rank) {
    var r = Math.max(-6, Math.min(6, rank));
    return r >= 0 ? (2 + r) / 2 : 2 / (2 - r);
}

// ============================================================
// ⑥ デフォルト値
// ============================================================
var DEFAULTS   = { attacker: 'リザードン', defender: 'ガブリアス' };
var DEFAULT_EV = { attacker: 32, defender: 0 };

// ============================================================
// ⑦ State
// ============================================================
var attackMode = 'physical';
var attackRank = 0;

// ============================================================
// ⑧ DOM 参照
// ============================================================
var el = {
    attackerName:      document.getElementById('attacker-name'),
    attackerStat:      document.getElementById('attacker-stat'),
    attackerStatEv:    document.getElementById('attacker-stat-ev'),
    attackerEvLabel:   document.getElementById('attacker-ev-label'),
    attackerStatLabel: document.getElementById('attacker-stat-label'),
    attackerMegaBtn:   document.getElementById('attacker-mega-btn'),
    attackerArtwork:   document.getElementById('attacker-artwork'),
    attackerFallback:  document.getElementById('attacker-fallback'),

    defenderName:      document.getElementById('defender-name'),
    defenderHp:        document.getElementById('defender-hp'),
    defenderHpEv:      document.getElementById('defender-hp-ev'),
    defenderStat:      document.getElementById('defender-stat'),
    defenderStatEv:    document.getElementById('defender-stat-ev'),
    defenderEvLabel:   document.getElementById('defender-ev-label'),
    defenderStatLabel: document.getElementById('defender-stat-label'),
    defenderMegaBtn:   document.getElementById('defender-mega-btn'),
    defenderArtwork:   document.getElementById('defender-artwork'),
    defenderFallback:  document.getElementById('defender-fallback'),

    modeToggle:        document.getElementById('mode-toggle'),
    rankSelect:        document.getElementById('rank-select'),
    rankValueDisplay:  document.getElementById('rank-value-display'),
    movePower:         document.getElementById('move-power'),
    moveType:          document.getElementById('move-type'),
    stabBtn:           document.getElementById('stab-btn'),
    swapBtn:           document.getElementById('swap-btn'),
    resultStatus:      document.getElementById('result-status'),
    resultDetail:      document.getElementById('result-detail'),
    typeMessage:       document.getElementById('type-message'),
    datalist:          document.getElementById('pokemon-list'),
    attackerSuggest:   document.getElementById('attacker-suggest'),
    defenderSuggest:   document.getElementById('defender-suggest'),
};

// ============================================================
// ⑨ ベース実数値ユーティリティ
// ============================================================
function setBase(inputElem, baseValue, ev) {
    ev = ev || 0;
    inputElem.dataset.baseStat = String(baseValue);
    inputElem.value = baseValue + ev;
}

function getBase(inputElem) {
    var b = inputElem.dataset.baseStat;
    if (b !== undefined && b !== '') return parseInt(b) || 0;
    return parseInt(inputElem.value) || 0;
}

function getEv(inputElem) {
    return Math.max(0, Math.min(32, parseInt(inputElem.value) || 0));
}

function applyEv(statInput, evInput) {
    statInput.value = getBase(statInput) + getEv(evInput);
}

// ============================================================
// ⑩ ランク表示更新
// ============================================================
function updateRankDisplay() {
    var sign = attackRank > 0 ? '+' : '';
    el.rankValueDisplay.textContent = sign + attackRank;
    el.rankSelect.value = String(attackRank);
}

// ============================================================
// ⑪ モードラベル更新
// ============================================================
function updateModeLabels() {
    if (attackMode === 'physical') {
        el.modeToggle.className   = 'giant-mode-toggle mode-physical';
        el.modeToggle.textContent = 'こうげき';
        el.attackerEvLabel.textContent   = 'こうげき努力値';
        el.attackerStatLabel.textContent = 'こうげき実数値';
        el.defenderEvLabel.textContent   = 'ぼうぎょ努力値';
        el.defenderStatLabel.textContent = 'ぼうぎょ実数値';
    } else {
        el.modeToggle.className   = 'giant-mode-toggle mode-special';
        el.modeToggle.textContent = 'とくこう';
        el.attackerEvLabel.textContent   = 'とくこう努力値';
        el.attackerStatLabel.textContent = 'とくこう実数値';
        el.defenderEvLabel.textContent   = 'とくぼう努力値';
        el.defenderStatLabel.textContent = 'とくぼう実数値';
    }
    updateRankDisplay();
}

// ============================================================
// ⑫ モード切替時に実数値を再適用
// ============================================================
function reapplyModeStats() {
    var atkBs = getBaseStats(el.attackerName.value);
    if (atkBs) {
        var base = attackMode === 'physical' ? calcStat(atkBs.atk) : calcStat(atkBs.spa);
        var ev   = getEv(el.attackerStatEv);
        setBase(el.attackerStat, base, ev);
    }

    var defBs = getBaseStats(el.defenderName.value);
    if (defBs) {
        var base2 = attackMode === 'physical' ? calcStat(defBs.def) : calcStat(defBs.spd);
        var ev2   = getEv(el.defenderStatEv);
        setBase(el.defenderStat, base2, ev2);
    }

    updateModeLabels();
    calculate();
}

// ============================================================
// ⑬ datalist / 威力リスト 構築
// ============================================================
function buildDatalist() {
    // カスタムサジェストを使うため datalist は不要
}

function buildPowerList() {
    var frag = document.createDocumentFragment();
    for (var v = 5; v <= 300; v += 5) {
        var opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        if (v === 90) opt.selected = true;
        frag.appendChild(opt);
    }
    el.movePower.appendChild(frag);
}

// ============================================================
// ⑬-B カスタムサジェスト
// ============================================================
var suggestState = { attacker: -1, defender: -1 };

function highlightMatch(text, query) {
    var n = norm(query);
    var t = norm(text);
    var idx = t.indexOf(n);
    if (!n || idx === -1) return document.createTextNode(text);
    var span = document.createElement('span');
    span.appendChild(document.createTextNode(text.slice(0, idx)));
    var mark = document.createElement('span');
    mark.className = 'suggest-match';
    mark.textContent = text.slice(idx, idx + query.length);
    span.appendChild(mark);
    span.appendChild(document.createTextNode(text.slice(idx + query.length)));
    return span;
}

function showSuggest(side, query) {
    var box = el[side + 'Suggest'];
    var q   = norm(query);
    if (!q) { hideSuggest(side); return; }

    // 前方一致 → 部分一致の順で最大15件
    var prefix = [], partial = [];
    for (var i = 0; i < POKEMON_DATA.length; i++) {
        var n = norm(POKEMON_DATA[i].name);
        if (n === q) continue; // 完全一致は不要
        if (n.startsWith(q))     { prefix.push(POKEMON_DATA[i]); }
        else if (n.includes(q))  { partial.push(POKEMON_DATA[i]); }
        if (prefix.length + partial.length >= 15) break;
    }
    var candidates = prefix.concat(partial).slice(0, 12);

    if (candidates.length === 0) { hideSuggest(side); return; }

    box.innerHTML = '';
    suggestState[side] = -1;

    candidates.forEach(function(p, idx) {
        var item = document.createElement('div');
        item.className = 'suggest-item';
        item.appendChild(highlightMatch(p.name, query));

        item.addEventListener('mousedown', function(e) {
            e.preventDefault(); // blur を防ぐ
        });
        item.addEventListener('click', function() {
            el[side + 'Name'].value = p.name;
            hideSuggest(side);
            updatePokemon(side);
        });
        // タッチ対応
        item.addEventListener('touchend', function(e) {
            e.preventDefault();
            el[side + 'Name'].value = p.name;
            hideSuggest(side);
            updatePokemon(side);
        });
        box.appendChild(item);
    });

    box.hidden = false;
}

function hideSuggest(side) {
    el[side + 'Suggest'].hidden = true;
    el[side + 'Suggest'].innerHTML = '';
    suggestState[side] = -1;
}

function navigateSuggest(side, dir) {
    var box   = el[side + 'Suggest'];
    var items = box.querySelectorAll('.suggest-item');
    if (!items.length) return;
    var cur = suggestState[side];
    items[cur] && items[cur].classList.remove('active');
    cur = (cur + dir + items.length) % items.length;
    suggestState[side] = cur;
    items[cur].classList.add('active');
    items[cur].scrollIntoView({ block: 'nearest' });
}

function selectActiveSuggest(side) {
    var box  = el[side + 'Suggest'];
    var cur  = suggestState[side];
    var item = box.querySelectorAll('.suggest-item')[cur];
    if (!item) return false;
    item.click();
    return true;
}

// ============================================================
// ⑭ 画像セット（失敗してもクラッシュしない）
// ============================================================
function setArtwork(side, pokemonId) {
    var img = el[side + 'Artwork'];
    var fb  = el[side + 'Fallback'];
    try {
        fb.style.display = 'none';
        img.classList.remove('loaded');
        img.onerror = function() {
            img.classList.remove('loaded');
            fb.style.display = 'flex';
        };
        img.onload = function() {
            img.classList.add('loaded');
            fb.style.display = 'none';
        };
        
        var nameInput = el[side + 'Name'].value;
        if (nameInput === 'フラエッテ(えいえんのはな)') {
            img.src = 'images/eternal_floette.png';
        } else {
            img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + pokemonId + '.png';
        }
    } catch(e) {
        console.warn('[ポケチャン] 画像セットエラー:', e);
        fb.style.display = 'flex';
    }
}

function clearArtwork(side) {
    el[side + 'Artwork'].classList.remove('loaded');
    el[side + 'Fallback'].style.display = 'flex';
}

// ============================================================
// ⑮ ポケモン更新（名前入力 → 実数値即反映）
// ============================================================
function updatePokemon(side) {
    var nameInput = el[side + 'Name'].value;
    var pokemon   = findPokemon(nameInput);

    if (!pokemon) {
        clearArtwork(side);
        calculate();
        return;
    }

    var bs = pokemon.baseStats;
    if (side === 'attacker') {
        var base = attackMode === 'physical' ? calcStat(bs.atk) : calcStat(bs.spa);
        var ev   = DEFAULT_EV.attacker;
        el.attackerStatEv.value = ev;
        setBase(el.attackerStat, base, ev);
    } else {
        var baseHp  = calcHp(bs.hp);
        var baseDef = attackMode === 'physical' ? calcStat(bs.def) : calcStat(bs.spd);
        var ev2     = DEFAULT_EV.defender;
        el.defenderHpEv.value   = ev2;
        el.defenderStatEv.value = ev2;
        setBase(el.defenderHp,   baseHp,  ev2);
        setBase(el.defenderStat, baseDef, ev2);
    }

    el[side + 'MegaBtn'].disabled = true;
    calculate();
    setArtwork(side, pokemon.id);
}

// ============================================================
// ⑯ 攻守交代
// ============================================================
function swapSides() {
    var tmp = el.attackerName.value;
    el.attackerName.value = el.defenderName.value;
    el.defenderName.value = tmp;
    updatePokemon('attacker');
    updatePokemon('defender');
}

// ============================================================
// ⑰ ダメージ計算
// ============================================================
function calculate() {
    var aPoke = findPokemon(el.attackerName.value);
    var dPoke = findPokemon(el.defenderName.value);

    if (!aPoke || !dPoke) {
        el.resultStatus.textContent      = 'スキャン中...';
        el.resultStatus.style.background = '';
        el.resultDetail.textContent      = '0.0% 〜 0.0%';
        el.typeMessage.textContent       = '';
        el.typeMessage.className         = 'type-msg';
        return;
    }

    var aBase = Math.max(0, parseInt(el.attackerStat.value) || 0);
    var d     = Math.max(1, parseInt(el.defenderStat.value) || 1);
    var hp    = Math.max(1, parseInt(el.defenderHp.value)   || 1);
    var power = parseInt(el.movePower.value) || 0;

    var moveType = el.moveType.value;
    var atkTypes = getPokemonTypes(aPoke.name);
    var defTypes = getPokemonTypes(dPoke.name);

    var typeRatio = (typeof window.calcTypeMultiplier === 'function' && defTypes.length > 0)
        ? window.calcTypeMultiplier(moveType, defTypes)
        : 1.0;

    var stab = (atkTypes.indexOf(moveType) !== -1) ? 1.5 : 1.0;

    var rankMult = getRankMultiplier(attackRank);
    var a = Math.floor(aBase * rankMult);

    var base2  = Math.floor(Math.floor(Math.floor(22 * power * a / d) / 50) + 2);
    var final2 = Math.floor(base2 * stab * typeRatio);
    var min    = Math.floor(final2 * 0.85);
    var max    = final2;

    showResult(min, max, hp, typeRatio, stab);
}

// ============================================================
// ⑱ 結果表示
// ============================================================
function showResult(min, max, hp, typeRatio, stab) {
    var minPct = (min / hp * 100).toFixed(1);
    var maxPct = (max / hp * 100).toFixed(1);
    el.resultDetail.textContent = minPct + '% 〜 ' + maxPct + '%';

    var text;
    if (max === 0) {
        text = '威力 0';
    } else if (min >= hp) {
        text = '確定 1 発！！！';
    } else if (max >= hp) {
        var range = max - min + 1;
        var prob  = Math.max(0, Math.min(100, Math.floor((range - (hp - min)) / range * 100)));
        text = '乱数 1 発！！！ (' + prob + '%)';
    } else {
        var avgHits = Math.ceil(hp / ((min + max) / 2));
        text = '確定 ' + avgHits + ' 発！！！';
    }
    el.resultStatus.textContent      = text;
    el.resultStatus.style.background = '';
    el.resultStatus.style.color      = '';

    var msgEl     = el.typeMessage;
    msgEl.className = 'type-msg';
    var stabLabel = stab > 1 ? 'タイプ一致！ ' : '';

    if (typeRatio === 0) {
        msgEl.textContent = '効果はないようだ';
        msgEl.classList.add('msg-immune');
    } else if (typeRatio <= 0.25) {
        msgEl.textContent = stabLabel + '効果はかなりいまひとつのようだ';
        msgEl.classList.add('msg-bad2');
    } else if (typeRatio < 1) {
        msgEl.textContent = stabLabel + '効果はいまひとつのようだ';
        msgEl.classList.add('msg-bad');
    } else if (typeRatio >= 4) {
        msgEl.textContent = stabLabel + '効果はちょうばつぐんだ！';
        msgEl.classList.add('msg-great');
    } else if (typeRatio >= 2) {
        msgEl.textContent = stabLabel + '効果はばつぐんだ！';
        msgEl.classList.add('msg-good');
    } else {
        msgEl.textContent = stabLabel ? stabLabel.trim() : '';
    }
}

// ============================================================
// ⑲ イベントリスナー
// ============================================================
function setupEventListeners() {

    el.modeToggle.addEventListener('click', function() {
        attackMode = (attackMode === 'physical') ? 'special' : 'physical';
        reapplyModeStats();
    });

    el.rankSelect.addEventListener('change', function() {
        attackRank = parseInt(el.rankSelect.value) || 0;
        updateRankDisplay();
        calculate();
    });

    el.attackerStatEv.addEventListener('input', function() {
        el.attackerStatEv.value = Math.max(0, Math.min(32, parseInt(el.attackerStatEv.value) || 0));
        applyEv(el.attackerStat, el.attackerStatEv);
        calculate();
    });
    el.defenderHpEv.addEventListener('input', function() {
        el.defenderHpEv.value = Math.max(0, Math.min(32, parseInt(el.defenderHpEv.value) || 0));
        applyEv(el.defenderHp, el.defenderHpEv);
        calculate();
    });
    el.defenderStatEv.addEventListener('input', function() {
        el.defenderStatEv.value = Math.max(0, Math.min(32, parseInt(el.defenderStatEv.value) || 0));
        applyEv(el.defenderStat, el.defenderStatEv);
        calculate();
    });

    [el.attackerStatEv, el.defenderHpEv, el.defenderStatEv].forEach(function(ev) {
        ev.addEventListener('blur', function() {
            ev.value = Math.max(0, Math.min(32, parseInt(ev.value) || 0));
        });
    });

    el.attackerStat.addEventListener('input', function() {
        el.attackerStat.dataset.baseStat = String((parseInt(el.attackerStat.value) || 0) - getEv(el.attackerStatEv));
        calculate();
    });
    el.defenderHp.addEventListener('input', function() {
        el.defenderHp.dataset.baseStat = String((parseInt(el.defenderHp.value) || 0) - getEv(el.defenderHpEv));
        calculate();
    });
    el.defenderStat.addEventListener('input', function() {
        el.defenderStat.dataset.baseStat = String((parseInt(el.defenderStat.value) || 0) - getEv(el.defenderStatEv));
        calculate();
    });

    el.movePower.addEventListener('input',  calculate);
    el.movePower.addEventListener('change', calculate);
    el.moveType.addEventListener('input',   calculate);
    el.moveType.addEventListener('change',  calculate);

    // changeイベント：datalistから選択した瞬間に発火
    el.attackerName.addEventListener('change', function() {
        hideSuggest('attacker');
        updatePokemon('attacker');
    });
    el.defenderName.addEventListener('change', function() {
        hideSuggest('defender');
        updatePokemon('defender');
    });

    // inputイベント：1文字入力ごとにサジェスト表示
    el.attackerName.addEventListener('input', function() {
        showSuggest('attacker', el.attackerName.value);
        if (findPokemon(el.attackerName.value)) {
            hideSuggest('attacker');
            updatePokemon('attacker');
        }
    });
    el.defenderName.addEventListener('input', function() {
        showSuggest('defender', el.defenderName.value);
        if (findPokemon(el.defenderName.value)) {
            hideSuggest('defender');
            updatePokemon('defender');
        }
    });

    // キーボード操作（↑↓Enter / Escape）
    ['attacker', 'defender'].forEach(function(side) {
        el[side + 'Name'].addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown')  { e.preventDefault(); navigateSuggest(side, 1); }
            else if (e.key === 'ArrowUp')   { e.preventDefault(); navigateSuggest(side, -1); }
            else if (e.key === 'Enter')     { if (selectActiveSuggest(side)) e.preventDefault(); }
            else if (e.key === 'Escape')    { hideSuggest(side); }
        });
        // フォーカスを外したらドロップダウンを閉じる
        el[side + 'Name'].addEventListener('blur', function() {
            setTimeout(function() { hideSuggest(side); }, 150);
        });
    });

    el.stabBtn.addEventListener('click', function() {
        el.stabBtn.classList.toggle('active');
        calculate();
    });
    el.swapBtn.addEventListener('click', swapSides);
    el.attackerMegaBtn.addEventListener('click', function() {});
    el.defenderMegaBtn.addEventListener('click', function() {});
}

// ============================================================
// ⑳ 初期化（JSON fetch → データロード → UI 起動）
// ============================================================
function init(data) {
    POKEMON_DATA = data;
    console.info('[ポケチャン] JSONデータ起動 — ' + POKEMON_DATA.length + '匹');

    buildDatalist();
    buildPowerList();
    setupEventListeners();
    updateModeLabels();

    el.attackerName.value = DEFAULTS.attacker;
    el.defenderName.value = DEFAULTS.defender;
    updatePokemon('attacker');
    updatePokemon('defender');
}

// ============================================================
// fetch エントリポイント
// ============================================================
function loadAndStart() {
    fetch('pokemon_data.json')
        .then(function(res) {
            if (!res.ok) throw new Error('fetch失敗: ' + res.status);
            return res.json();
        })
        .then(function(data) {
            init(data);
        })
        .catch(function(err) {
            console.error('[ポケチャン] pokemon_data.json の読み込みに失敗しました:', err);
            el.resultStatus.textContent = 'データ読み込みエラー';
        });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndStart);
} else {
    loadAndStart();
}

}()); // IIFE 終わり