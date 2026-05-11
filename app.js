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
    // まず完全一致を探す
    for (var i = 0; i < POKEMON_DATA.length; i++) {
        if (norm(POKEMON_DATA[i].name) === key) return POKEMON_DATA[i];
    }
    return null;
}

function getBaseStats(nameInput) {
    var p = findPokemon(nameInput);
    return p ? p.baseStats : null;
}

// 文字列 "['ほのお', 'ひこう']" を配列 ['ほのお','ひこう'] に正規化
function normalizeTypes(types) {
    if (Array.isArray(types)) return types;
    // 文字列の場合：[ ] ' " をすべて除去して split
    return String(types)
        .replace(/[\[\]'\"]/g, '')
        .split(',')
        .map(function(t) { return t.trim(); })
        .filter(function(t) { return t.length > 0; });
}

function getPokemonTypes(nameInput) {
    var p = findPokemon(nameInput);
    return p ? normalizeTypes(p.types) : [];
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

// メガシンカ状態: { attacker: [通常名, メガ名, メガY名...], index: 0 }
var megaState = {
    attacker: { baseName: '', forms: [], index: 0 },
    defender: { baseName: '', forms: [], index: 0 },
};

// ポケモン名からメガシンカフォームを収集
function getMegaForms(baseName) {
    var key = norm(baseName);
    var forms = [baseName]; 
    
    // 「メガ + 名前」「メガ + 名前 + X/Y」の順で検索
    var variants = [
        'メガ' + baseName,
        'メガ' + baseName + 'X',
        'メガ' + baseName + 'Y',
        baseName + '(メガ)',
    ];
    variants.forEach(function(v) {
        var p = findPokemon(v);
        if (p && forms.indexOf(p.name) === -1) forms.push(p.name);
    });

    // 特殊：リザードンのように複数ある場合や、CSVの「メガ○○」形式も補完
    POKEMON_DATA.forEach(function(p) {
        var n = norm(p.name);
        if (p.isMega && n.indexOf(key) !== -1 && forms.indexOf(p.name) === -1) {
            forms.push(p.name);
        }
    });

    return forms;
}

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
    swapBtn:           document.getElementById('swap-btn'),
    partySelect:       document.getElementById('party-select'),
    partyAtkBtn:       document.getElementById('party-atk-btn'),
    partyDefBtn:       document.getElementById('party-def-btn'),
    resultStatus:      document.getElementById('result-status'),
    resultDetail:      document.getElementById('result-detail'),
    typeMessage:       document.getElementById('type-message'),
    datalist:          document.getElementById('pokemon-list'),
    attackerSuggest:   document.getElementById('attacker-suggest'),
    defenderSuggest:   document.getElementById('defender-suggest'),
    attackerArtbox:    document.getElementById('attacker-artbox'),
    defenderArtbox:    document.getElementById('defender-artbox'),
    attackerMegaInd:   document.getElementById('attacker-mega-indicator'),
    defenderMegaInd:   document.getElementById('defender-mega-indicator'),
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
// ⑭ 画像セット（PokeAPI 動的同期）
// ============================================================
var speciesCache = {};
var artworkRequests = { attacker: 0, defender: 0 };

async function setArtwork(side, pokemon) {
    var img = el[side + 'Artwork'];
    var fb  = el[side + 'Fallback'];
    var rid = ++artworkRequests[side];
    
    if (!pokemon) {
        img.classList.remove('loaded');
        fb.style.display = 'flex';
        return;
    }

    fb.style.display = 'none';
    img.classList.remove('loaded');

    // 画像セット用プロミス（最新リクエストのみ有効）
    const trySet = (url) => {
        return new Promise((resolve) => {
            if (rid !== artworkRequests[side]) return resolve(false);
            img.onload = () => {
                if (rid === artworkRequests[side]) {
                    img.classList.add('loaded');
                    fb.style.display = 'none';
                    resolve(true);
                } else resolve(false);
            };
            img.onerror = () => resolve(false);
            img.src = url;
        });
    };

    try {
        // 1. Local Check: images/[名前].png
        try {
            const localUrl = 'images/' + pokemon.name + '.png';
            const localRes = await fetch(localUrl, { method: 'HEAD' });
            if (localRes.ok && await trySet(localUrl)) return;
        } catch(e) {}

        // 2. 英語名の取得（キャッシュ利用）
        var dexId = pokemon.dexId;
        var baseName = speciesCache[dexId];
        if (!baseName) {
            const sRes = await fetch('https://pokeapi.co/api/v2/pokemon-species/' + dexId);
            if (sRes.ok) {
                const sData = await sRes.json();
                baseName = sData.name;
                speciesCache[dexId] = baseName;
            }
        }

        if (rid !== artworkRequests[side]) return;

        // 3. スラッグの構築
        var jName = pokemon.name;

        // ── 名前 → 確定スラッグ マッピング（PokeAPI命名ルール差異を吸収）──
        var SLUG_OVERRIDES = {
            // ギルガルド
            'ギルガルド':          'aegislash-shield',
            'ギルガルド(シールド)': 'aegislash-shield',
            'ギルガルド(ブレード)': 'aegislash-blade',
            // パンプジン
            'パンプジン(小さい)':  'gourgeist-small',
            'パンプジン(普通)':    'gourgeist-average',
            'パンプジン(大きい)':  'gourgeist-large',
            'パンプジン(特大)':    'gourgeist-super',
            // ミミッキュ
            'ミミッキュ':          'mimikyu-disguised',
            // モルペコ
            'モルペコ':            'morpeko-full-belly',
            // ケンタロス(パルデア)
            'ケンタロス(パルデア単)': 'tauros-paldea-combat-breed',
            'ケンタロス(パルデア炎)': 'tauros-paldea-blaze-breed',
            'ケンタロス(パルデア水)': 'tauros-paldea-aqua-breed',
            // イルカマン
            'イルカマン(ナイーブ)': 'palafin-zero',
            'イルカマン(マイティ)': 'palafin-hero',
            // カエンジシ
            'カエンジシ':          'pyroar-male',
            // フラエッテ
            'フラエッテ(えいえんのはな)': 'floette-eternal',
        };

        var slug = (SLUG_OVERRIDES[jName] !== undefined)
            ? SLUG_OVERRIDES[jName]
            : (function() {
                var s = baseName || '';
                if (pokemon.isMega) {
                    s += '-mega';
                    if (jName.indexOf('X') !== -1) s += '-x';
                    else if (jName.indexOf('Y') !== -1) s += '-y';
                } else if (jName.indexOf('アローラ') !== -1) s += '-alola';
                else if (jName.indexOf('ガラル') !== -1) s += '-galar';
                else if (jName.indexOf('パルデア') !== -1) s += '-paldea';
                else if (jName.indexOf('ヒスイ') !== -1) s += '-hisui';
                else if (jName.indexOf('まひる') !== -1) s += '-midday';
                else if (jName.indexOf('まよなか') !== -1) s += '-midnight';
                else if (jName.indexOf('たそがれ') !== -1) s += '-dusk';
                else if (jName.indexOf('オス') !== -1) s += '-male';
                else if (jName.indexOf('メス') !== -1 && !jName.indexOf('メスのすがた')) s += '-female';
                return s;
              })();

        // 4. Try API Slug: Official -> Normal
        if (slug) {
            const pRes = await fetch('https://pokeapi.co/api/v2/pokemon/' + slug);
            if (pRes.ok) {
                const pData = await pRes.json();
                const art = pData.sprites.other['official-artwork'].front_default;
                const nrm = pData.sprites.front_default;
                if (art && await trySet(art)) return;
                if (nrm && await trySet(nrm)) return;
            }
        }

        // 5. Try API Base: Official -> Normal
        if (baseName && baseName !== slug) {
            const bRes = await fetch('https://pokeapi.co/api/v2/pokemon/' + baseName);
            if (bRes.ok) {
                const bData = await bRes.json();
                const bart = bData.sprites.other['official-artwork'].front_default;
                const bnrm = bData.sprites.front_default;
                if (bart && await trySet(bart)) return;
                if (bnrm && await trySet(bnrm)) return;
            }
        }

        // 全て失敗
        if (rid === artworkRequests[side]) fb.style.display = 'flex';

    } catch (e) {
        console.warn('[ポケチャン] 画像取得エラー:', e);
        if (rid === artworkRequests[side]) fb.style.display = 'flex';
    }
}

function clearArtwork(side) {
    el[side + 'Artwork'].classList.remove('loaded');
    el[side + 'Fallback'].style.display = 'flex';
}

// ============================================================
// ⑮ ポケモン更新（名前入力 → 実数値即反映）
// ============================================================
function updatePokemon(side, nameOverride) {
    var nameInput = nameOverride !== undefined ? nameOverride : el[side + 'Name'].value;
    var pokemon   = findPokemon(nameInput);

    if (!pokemon) {
        clearArtwork(side);
        calculate();
        return;
    }

    // 名前欄を更新（nameOverride経由の場合）
    if (nameOverride !== undefined) {
        el[side + 'Name'].value = nameOverride;
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

    // メガ状態リセット（手入力・パーティ選択時）
    if (nameOverride !== undefined || arguments.length === 1) {
        var forms = getMegaForms(pokemon.name);
        megaState[side].baseName = pokemon.name;
        megaState[side].forms    = forms;
        megaState[side].index    = 0;
        updateMegaIndicator(side);
    }

    calculate();
    setArtwork(side, pokemon);
}

// ============================================================
// ⑯ メガシンカインジケーター
// ============================================================
function updateMegaIndicator(side) {
    var st  = megaState[side];
    var ind = el[side + 'MegaInd'];
    var box = el[side + 'Artbox'];
    if (st.forms.length <= 1) {
        ind.textContent = '';
        ind.className   = 'mega-indicator';
        box.classList.remove('has-mega');
    } else {
        var isMega = st.index > 0;
        ind.textContent = isMega ? ('▲ ' + st.forms[st.index]) : '▲ MEGA 可';
        ind.className   = 'mega-indicator' + (isMega ? ' active' : '');
        box.classList.toggle('has-mega', true);
    }
}

// ============================================================
// ⑰ 画像クリック → メガシンカトグル
// ============================================================
function cycleForm(side) {
    var st = megaState[side];
    if (st.forms.length <= 1) return; // メガなし
    st.index = (st.index + 1) % st.forms.length;
    var newName = st.forms[st.index];
    var pokemon = findPokemon(newName);
    if (!pokemon) return;

    el[side + 'Name'].value = newName;
    var bs = pokemon.baseStats;
    if (side === 'attacker') {
        var base = attackMode === 'physical' ? calcStat(bs.atk) : calcStat(bs.spa);
        var ev   = getEv(el.attackerStatEv);
        setBase(el.attackerStat, base, ev);
    } else {
        var baseHp  = calcHp(bs.hp);
        var baseDef = attackMode === 'physical' ? calcStat(bs.def) : calcStat(bs.spd);
        var ev2     = getEv(el.defenderStatEv);
        setBase(el.defenderHp,   baseHp,  ev2);
        setBase(el.defenderStat, baseDef, ev2);
    }
    updateMegaIndicator(side);
    calculate();
    setArtwork(side, pokemon);
}

// ============================================================
// ⑱ 攻守交代
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

    el.stabBtn && el.stabBtn.addEventListener && el.stabBtn.addEventListener('click', function() {
        el.stabBtn.classList.toggle('active');
        calculate();
    });
    el.swapBtn.addEventListener('click', swapSides);

    // 画像クリック → メガシンカループ
    el.attackerArtbox.addEventListener('click', function() { cycleForm('attacker'); });
    el.defenderArtbox.addEventListener('click', function() { cycleForm('defender'); });

    // マイパーティ
    el.partyAtkBtn.addEventListener('click', function() {
        var name = el.partySelect.value;
        if (!name) return;
        updatePokemon('attacker', name);
        el.partySelect.value = '';
    });
    el.partyDefBtn.addEventListener('click', function() {
        var name = el.partySelect.value;
        if (!name) return;
        updatePokemon('defender', name);
        el.partySelect.value = '';
    });
}

// ============================================================
// ⑳ 初期化（JSON fetch → データロード → UI 起動）
// ============================================================
function init(data) {
    POKEMON_DATA = data;
    console.info('[ポケチャン] JSONデータ起動 — ' + POKEMON_DATA.length + '匹');

    // ── 起動時データ検証ログ ──
    var checks = { 'クエスパトラ': 956, 'ヒラヒナ': 955, 'キラフロル': 970 };
    Object.keys(checks).forEach(function(name) {
        var p = findPokemon(name);
        var expected = checks[name];
        if (!p) {
            console.warn('[ポケチャン] ⚠ ' + name + ' がデータに見つかりません');
        } else if (p.dexId !== expected) {
            console.error('[ポケチャン] ❌ ' + name + ' dexId=' + p.dexId + ' (期待値=' + expected + ')');
        } else {
            console.info('[ポケチャン] ✅ ' + name + ' dexId=' + p.dexId + ' OK');
        }
    });

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