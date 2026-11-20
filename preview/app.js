/* 懸賞応募ダッシュボード — data.json を読んで描画 */
(function () {
  'use strict';

  var state = { cat: 'all', q: '', sort: 'new' };
  var items = [];
  var catClass = {
    'テーマパーク・鑑賞': 'cat-park',
    '家電・生活': 'cat-home',
    '食品・お酒': 'cat-food',
    '美容・日用品': 'cat-beauty',
    '生活雑貨': 'cat-goods',
    '旅行・宿泊': 'cat-trip',
    'ギフト券・その他': 'cat-gift',
    'その他': 'cat-other'
  };
  var WD = ['日', '月', '火', '水', '木', '金', '土'];

  /* ---------- 小物 ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDate(d) {
    if (!d) return '–';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (!m) return d;
    return m[1] + '.' + m[2] + '.' + m[3];
  }

  function fmtDateTime(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(d || '');
    if (!m) return d || '–';
    var t = m[4] ? ' ' + m[4] + ':' + m[5] : '';
    return m[1] + '.' + m[2] + '.' + m[3] + t;
  }

  function fmtDateShort(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(d || '');
    if (!m) return d || '–';
    var t = m[4] ? ' ' + m[4] + ':' + m[5] : '';
    return Number(m[2]) + '/' + Number(m[3]) + t;
  }

  function fmtShortWithWd(dstr) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dstr || '');
    if (!m) return dstr || '';
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number(m[2]) + '/' + Number(m[3]) + '(' + WD[d.getDay()] + ')';
  }

  function parseLocal(dstr) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(dstr || '');
    if (!m) return null;
    return new Date(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      m[4] ? Number(m[4]) : 23, m[5] ? Number(m[5]) : 59
    );
  }

  function startOfToday() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function daysFromToday(d) {
    if (!d) return null;
    var t = startOfToday();
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((x - t) / 86400000);
  }

  function daysLeft(dstr) {
    return daysFromToday(parseLocal(dstr));
  }

  function statusClass(s) {
    if (!s) return '';
    if (s.indexOf('当選') > -1) return 'st-win';
    if (s.indexOf('落選') > -1 || s.indexOf('はずれ') > -1) return 'st-lose';
    if (s.indexOf('発送') > -1) return 'st-ship';
    return '';
  }

  function isWaiting(s) {
    return !s || s.indexOf('当落待ち') > -1 || s.indexOf('発送待ち') > -1 || s.indexOf('応募済') > -1;
  }

  function isWon(s) { return /当選/.test(s || ''); }
  function isLost(s) { return /落選|はずれ/.test(s || ''); }
  function isShipped(s) { return !isWon(s) && /発送済|発送しました|発送完了/.test(s || ''); }

  /* ---------- 発表・お届けの読み取り ---------- */

  function granDay(g) {
    return g === '上旬' ? 5 : g === '中旬' ? 15 : g === '下旬' ? 25 : 15;
  }

  /* 「2026年12月下旬」「12月下旬」「12月〜2027年1月頃」などをおおよその日付に。
     表示はラベルのまま、並び順のためだけに使う。 */
  function parseShipDate(label) {
    var s = String(label || '');
    var m = /(\d{4})年\s*(\d{1,2})月\s*(上旬|中旬|下旬)?/.exec(s);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, granDay(m[3]));
    var m2 = /(\d{1,2})月\s*(上旬|中旬|下旬)?/.exec(s);
    if (m2) {
      var today = startOfToday();
      var y = today.getFullYear();
      var d = new Date(y, Number(m2[1]) - 1, granDay(m2[2]));
      if (daysFromToday(d) < 0) d = new Date(y + 1, Number(m2[1]) - 1, granDay(m2[2]));
      return d;
    }
    return null;
  }

  /* カードに出す「発表予定」「発送予定」の並び（日付の近い順） */
  function expectations(i) {
    var out = [];

    if (i.result_date) {
      var rd = parseLocal(i.result_date);
      var rdays = daysFromToday(rd);
      var approx = !!i.result_approx;
      out.push({
        kind: 'result',
        date: rd,
        days: rdays,
        exact: !approx,
        dateTxt: fmtShortWithWd(i.result_date) + (approx ? '以降' : ''),
        tail: (i.result_label || '発表') + (rdays >= 0 ? '予定' : ''),
        rawLabel: fmtShortWithWd(i.result_date)
      });
    }

    var shipLabel = String(i.ship_label || '').trim();
    if (shipLabel || i.ship_date) {
      var sd = i.ship_date ? parseLocal(i.ship_date) : parseShipDate(shipLabel);
      var sdays = daysFromToday(sd);
      out.push({
        kind: 'ship',
        date: sd,
        days: sdays,
        exact: !!i.ship_date,
        dateTxt: i.ship_date ? fmtShortWithWd(i.ship_date) : shipLabel,
        tail: '発送' + (sdays !== null && sdays < 0 ? '' : '予定'),
        rawLabel: shipLabel
      });
    }

    out.sort(function (a, b) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date - b.date;
    });
    return out;
  }

  function nearRank(i) {
    var ex = expectations(i);
    var future = ex.filter(function (e) { return e.date && e.days !== null && e.days >= 0; });
    if (future.length) return { rank: 0, t: future[0].date.getTime() };
    var past = ex.filter(function (e) { return e.date; });
    if (past.length) return { rank: 2, t: past[past.length - 1].date.getTime() };
    return { rank: 1, t: 0 };
  }

  function approxDays(days) {
    if (days >= 45) return Math.round(days / 30) + 'か月';
    return days + '日';
  }

  /* 当選連絡のしかたを、やさしい言葉に */
  function noteView(i) {
    var n = String(i.result_note || '').trim();
    if (!n) return '';
    var extra = /都道府県とイニシャル/.test(n) ? '／当選者はHPに都道府県とイニシャルが掲載' : '';
    if (/当選・落選ともにメール/.test(n)) return '✉️ 当選・落選ともにメールで連絡' + extra;
    if (/当選者にのみメール|当選者のみメール/.test(n)) return '✉️ 当選者のみメールで連絡（落選通知なし）' + extra;
    if (/当選者のみXのDM|XのDMで連絡/.test(n)) return '✉️ 当選者のみXのDMで連絡（落選通知なし）' + extra;
    if (/当選通知メール/.test(n)) return '✉️ 当選通知メールが届きます' + extra;
    if (/当選者のみ(郵送|発送)|当選者にのみ(郵送|発送)/.test(n)) {
      return '📮 当選者のみ' + (/郵送/.test(n) ? '郵送' : '発送') + 'で当選発表' + extra;
    }
    if (/発送[^。]{0,25}をもって/.test(n)) return '📮 賞品の発送をもって当選発表' + extra;
    return n;
  }

  /* ---------- 並び順 ---------- */

  function sortByDateDesc(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return String(a.id) < String(b.id) ? -1 : 1;
    });
  }

  function sortByNear(list) {
    return list.map(function (i) { return { i: i, k: nearRank(i) }; }).sort(function (a, b) {
      if (a.k.rank !== b.k.rank) return a.k.rank - b.k.rank;
      if (a.k.rank === 0) return a.k.t - b.k.t;
      if (a.k.rank === 2) return b.k.t - a.k.t;
      return a.i.date < b.i.date ? 1 : -1;
    });
  }

  /* ---------- サマリー ---------- */

  function renderSummary() {
    var total = items.length;
    var latestDate = items.reduce(function (max, i) {
      return !max || i.date > max ? i.date : max;
    }, '');
    var latestCount = items.filter(function (i) { return i.date === latestDate; }).length;
    var waiting = items.filter(function (i) { return isWaiting(i.status); }).length;

    document.getElementById('t-total').textContent = total;
    document.getElementById('t-latest').textContent = latestCount;
    document.getElementById('t-latest-date').textContent = latestDate ? fmtDate(latestDate) : '';
    document.getElementById('t-waiting').textContent = waiting;

    var next = upcomingEntries()[0];
    var nextTxt = '予定はまだ未定';
    if (next) {
      nextTxt = '次は ' + next.entry.dateTxt + ' ' +
        (next.entry.kind === 'result' ? (next.item.result_label || '発表') : 'お届け');
    }
    document.getElementById('t-next-result').textContent = nextTxt;
  }

  var CAT_ORDER = ['テーマパーク・鑑賞', '家電・生活', '食品・お酒', '美容・日用品', '生活雑貨', '旅行・宿泊', 'ギフト券・その他', 'その他'];

  function renderChips() {
    var counts = {};
    items.forEach(function (i) {
      var c = i.category || 'その他';
      counts[c] = (counts[c] || 0) + 1;
    });

    var cats = Object.keys(counts).filter(function (c) { return counts[c]; });
    cats.sort(function (a, b) {
      var ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
      if (ia < 0) ia = 99;
      if (ib < 0) ib = 99;
      if (ia !== ib) return ia - ib;
      return counts[b] - counts[a];
    });

    var host = document.getElementById('filters');
    var html = ['<button class="chip is-active" data-cat="all" type="button">すべて<span class="chip-num">' +
      items.length + '</span></button>'];
    cats.forEach(function (c) {
      html.push('<button class="chip" data-cat="' + esc(c) + '" type="button">' +
        esc(c) + '<span class="chip-num">' + counts[c] + '</span></button>');
    });
    host.innerHTML = html.join('');
  }

  /* ---------- もうすぐ結果・お届け予定 ---------- */

  function upcomingEntries() {
    var out = [];
    items.forEach(function (i) {
      if (isWon(i.status) || isShipped(i.status) || isLost(i.status)) return;
      var ex = expectations(i).filter(function (e) {
        return e.date && e.days !== null && e.days >= 0;
      });
      if (!ex.length) return;
      out.push({ item: i, entry: ex[0] });
    });
    out.sort(function (a, b) { return a.entry.date - b.entry.date; });
    return out;
  }

  function upCountHTML(e) {
    if (e.exact && e.days === 0) {
      return '<span class="up-count is-today"><b>今日</b><i>' +
        (e.kind === 'result' ? '発表' : '発送') + '</i></span>';
    }
    if (e.exact) {
      return '<span class="up-count"><b>' + e.days + '</b><i>日後</i></span>';
    }
    if (e.kind === 'result') {
      var dm = /(\d{1,2})\/(\d{1,2})/.exec(e.dateTxt || '');
      if (dm) {
        var day = Number(dm[2]);
        return '<span class="up-count is-month"><b>' + dm[1] + '月</b><i>' +
          (day <= 10 ? '上旬' : day <= 20 ? '中旬' : '下旬') + '</i></span>';
      }
      return '<span class="up-count is-month"><b>—</b><i>&nbsp;</i></span>';
    }
    var m = /(\d{1,2})月\s*(上旬|中旬|下旬)?/.exec(e.rawLabel || '');
    if (m) {
      return '<span class="up-count is-month"><b>' + m[1] + '月</b><i>' + esc(m[2] || '') + '</i></span>';
    }
    return '<span class="up-count is-month"><b>—</b><i>&nbsp;</i></span>';
  }

  function renderUpcoming() {
    var all = upcomingEntries();
    var box = document.getElementById('upcoming');
    var list = document.getElementById('upcoming-list');
    var more = document.getElementById('up-more');
    var MAX = 5;

    if (!all.length) {
      box.hidden = true;
      list.innerHTML = '';
      more.hidden = true;
      return;
    }

    box.hidden = false;
    var show = all.slice(0, MAX);
    list.innerHTML = show.map(function (row) {
      var i = row.item;
      var e = row.entry;
      var kindWord = e.kind === 'result' ? (i.result_label || '発表') : 'お届け';
      var dateTxt = e.exact ? fmtShortWithWd(e.kind === 'result' ? i.result_date : i.ship_date) : e.dateTxt;
      return '<li class="up-item">' +
        upCountHTML(e) +
        '<span class="up-main">' +
          '<span class="up-head">' +
            '<span class="up-kind' + (e.kind === 'ship' ? ' kind-ship' : '') + '">' +
              (e.kind === 'result' ? '🎯 ' : '📦 ') + esc(kindWord) +
            '</span>' +
            '<span class="up-date">' + esc(dateTxt) + '</span>' +
          '</span>' +
          '<span class="up-name">' + esc(i.prize || '') + '</span>' +
          '<span class="up-org">' + esc(i.organizer || '') + '</span>' +
        '</span>' +
      '</li>';
    }).join('');

    if (all.length > MAX) {
      more.hidden = false;
      more.textContent = 'ほか ' + (all.length - MAX) + ' 件は下のリストで（結果・お届けが近い順）';
    } else {
      more.hidden = true;
    }
  }

  /* ---------- 当選・発送のお祝い ---------- */

  function renderCelebrate() {
    var wins = items.filter(function (i) { return isWon(i.status); });
    var ships = items.filter(function (i) { return isShipped(i.status); });
    var box = document.getElementById('celebrate');
    if (!wins.length && !ships.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    var rows = wins.map(function (i) { return { i: i, badge: '当選' }; })
      .concat(ships.map(function (i) { return { i: i, badge: '発送' }; }));

    box.hidden = false;
    box.innerHTML =
      '<p class="celebrate-title">おめでとう！</p>' +
      '<ul class="celebrate-list">' +
      rows.map(function (r) {
        return '<li>' +
          '<span class="cel-badge">' + (r.badge === '当選' ? '🎉 当選' : '📦 発送') + '</span>' +
          '<span class="cel-prize">' + esc(r.i.prize || '') + '</span>' +
          '<span class="cel-org">' + esc(r.i.organizer || '') + '</span>' +
        '</li>';
      }).join('') +
      '</ul>';
  }

  /* ---------- カード ---------- */

  function cardHTML(i, inNearMode) {
    var cat = i.category || 'その他';
    var catCls = catClass[cat] || 'cat-other';
    var status = i.status || '当落待ち';
    var ex = expectations(i);
    var future = ex.filter(function (e) { return e.days !== null && e.days >= 0; });
    var todayHas = future.some(function (e) { return e.days === 0; });

    var cls = 'card';
    if (isWon(status)) cls += ' card--win';
    if (isShipped(status)) cls += ' card--ship';
    if (todayHas) cls += ' card--today';

    var parts = [];
    parts.push('<article class="' + cls + '">');
    parts.push('<div class="card-top">');
    parts.push('<span class="tag ' + catCls + '">' + esc(cat) + '</span>');
    parts.push('<span class="pill ' + statusClass(status) + '">' +
      (isWon(status) ? '🎉 ' : '') + esc(status) + '</span>');
    parts.push('</div>');
    parts.push('<h2 class="prize">' + esc(i.prize || '') + '</h2>');
    if (i.organizer) parts.push('<p class="organizer">主催 ' + esc(i.organizer) + '</p>');

    if (ex.length) {
      parts.push('<div class="expect">');
      ex.forEach(function (e) {
        var rowCls = 'expect-row er-' + e.kind;
        var when = '';
        if (e.days !== null) {
          if (e.days === 0) {
            rowCls += ' is-today';
            when = e.kind === 'result' ? '今日発表！' : '今日お届け';
          } else if (e.days > 0) {
            rowCls += ' is-soon';
            when = e.exact ? 'あと' + e.days + '日' : 'あと約' + approxDays(e.days);
          } else {
            rowCls += ' is-past';
          }
        }
        parts.push('<p class="' + rowCls + '">');
        parts.push('<span class="er-icon" aria-hidden="true">' + (e.kind === 'result' ? '🎯' : '📦') + '</span>');
        parts.push('<span class="er-text"><b>' + esc(e.dateTxt) + '</b> ' + esc(e.tail) + '</span>');
        if (when) parts.push('<span class="er-when">' + esc(when) + '</span>');
        parts.push('</p>');
      });
      parts.push('</div>');
    }

    var meta = [];
    if (inNearMode) meta.push('<div><dt>応募</dt><dd>' + esc(fmtDateShort(i.date)) + '</dd></div>');
    if (i.slots) meta.push('<div><dt>枠</dt><dd>' + esc(i.slots) + '</dd></div>');
    if (i.deadline) {
      var d = daysLeft(i.deadline);
      meta.push('<div><dt>締切</dt><dd' + (d !== null && d < 0 ? ' class="is-past"' : '') + '>' +
        esc(fmtDateShort(i.deadline)) + '</dd></div>');
    }
    if (meta.length) parts.push('<dl class="meta">' + meta.join('') + '</dl>');

    var note = noteView(i);
    if (note) parts.push('<p class="card-note">' + esc(note) + '</p>');

    if (i.url) {
      parts.push('<a class="card-link" href="' + esc(i.url) + '" target="_blank" rel="noopener noreferrer">キャンペーン記事を見る <span aria-hidden="true">→</span></a>');
    }
    parts.push('</article>');
    return parts.join('');
  }

  /* ---------- 一覧 ---------- */

  var nearHead = {
    0: '🎯 発表・お届けが近い応募',
    1: '⏳ 発表日はまだ未定',
    2: '✅ 発表が終わった応募'
  };

  function render() {
    var q = state.q.trim().toLowerCase();
    var list = items.filter(function (i) {
      if (state.cat !== 'all' && i.category !== state.cat) return false;
      if (!q) return true;
      var hay = [i.prize, i.organizer, i.category, i.status, i.slots, i.result_note, i.ship_label]
        .join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    });

    var host = document.getElementById('list');
    var empty = document.getElementById('empty');
    var html = [];

    if (state.sort === 'near') {
      var rows = sortByNear(list);
      var curRank = null;
      rows.forEach(function (r) {
        if (r.k.rank !== curRank) {
          curRank = r.k.rank;
          var n = rows.filter(function (x) { return x.k.rank === curRank; }).length;
          html.push('<div class="datehead"><span>' + nearHead[curRank] + '</span>' +
            '<span class="dh-count">' + n + '件</span></div>');
        }
        html.push(cardHTML(r.i, true));
      });
    } else {
      list = sortByDateDesc(list);
      var groups = {};
      list.forEach(function (it) { groups[it.date] = (groups[it.date] || 0) + 1; });
      var curDate = null;
      list.forEach(function (it) {
        if (it.date !== curDate) {
          curDate = it.date;
          html.push('<div class="datehead"><span>' + esc(fmtDate(it.date)) + '</span>' +
            '<span class="dh-count">' + groups[it.date] + '件</span></div>');
        }
        html.push(cardHTML(it, false));
      });
    }

    if (!list.length) {
      host.innerHTML = '';
      empty.hidden = false;
    } else {
      empty.hidden = true;
      host.innerHTML = html.join('');
    }

    var orderTxt = state.sort === 'near' ? '結果・お届けが近い順' : '応募が新しい順';
    document.getElementById('count').textContent =
      (state.cat === 'all' && !q)
        ? '全 ' + list.length + ' 件（' + orderTxt + '）'
        : list.length + ' 件を表示中（' + orderTxt + '）';
  }

  /* ---------- 操作 ---------- */

  function setSort(mode) {
    state.sort = mode;
    Array.prototype.forEach.call(document.querySelectorAll('.sortbtn'), function (b) {
      var on = b.getAttribute('data-sort') === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    try { localStorage.setItem('kensho-sort', mode); } catch (e) { /* 保存できなくても動く */ }
    render();
  }

  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (b) {
          b.classList.remove('is-active');
        });
        btn.classList.add('is-active');
        state.cat = btn.getAttribute('data-cat');
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.sortbtn'), function (btn) {
      btn.addEventListener('click', function () {
        setSort(btn.getAttribute('data-sort'));
      });
    });

    var q = document.getElementById('q');
    var timer = null;
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = q.value;
        render();
      }, 140);
    });
  }

  function fail(err) {
    var host = document.getElementById('list');
    host.innerHTML = '<p class="empty">データ（data.json）を読み込めませんでした。<br>' +
      'ページのURLから開き直してみてください。</p>';
    if (window.console) console.error(err);
  }

  try {
    var saved = localStorage.getItem('kensho-sort');
    if (saved === 'near' || saved === 'new') state.sort = saved;
  } catch (e) { /* 何もしない */ }

  fetch('data.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      items = (data.items || []).filter(function (i) { return i && i.date && i.prize; });
      renderSummary();
      renderChips();
      renderCelebrate();
      renderUpcoming();
      bind();
      setSort(state.sort);

      var upd = data.updated_at
        ? (String(data.updated_at).length > 10 ? fmtDateTime(data.updated_at) : fmtDate(data.updated_at))
        : '–';
      document.getElementById('t-updated').textContent = fmtDateShort(data.updated_at);
      document.getElementById('f-updated').textContent = upd;
      document.getElementById('t-next').textContent = data.next_run || '毎日 20:00';
    })
    .catch(fail);
})();
