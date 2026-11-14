/* 懸賞応募ダッシュボード — data.json を読んで描画 */
(function () {
  'use strict';

  var state = { cat: 'all', q: '' };
  var items = [];
  var catClass = {
    'テーマパーク・鑑賞': 'cat-park',
    '家電・生活': 'cat-home',
    '食品・お酒': 'cat-food',
    'その他': 'cat-other'
  };

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

  function fmtDateShort(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(d || '');
    if (!m) return d || '–';
    var t = m[4] ? ' ' + m[4] + ':' + m[5] : '';
    return Number(m[2]) + '/' + Number(m[3]) + t;
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

  function daysLeft(dstr) {
    var d = parseLocal(dstr);
    if (!d) return null;
    var t = startOfToday();
    var dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((dDay - t) / 86400000);
  }

  function statusClass(s) {
    if (!s) return '';
    if (s.indexOf('当選') === 0 || s.indexOf('当選') > -1) return 'st-win';
    if (s.indexOf('落選') > -1 || s.indexOf('はずれ') > -1) return 'st-lose';
    if (s.indexOf('発送') > -1) return 'st-ship';
    return '';
  }

  function isWaiting(s) {
    return !s || s.indexOf('当落待ち') > -1 || s.indexOf('発送待ち') > -1 || s.indexOf('応募済') > -1;
  }

  function sortItems(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return String(a.id) < String(b.id) ? -1 : 1;
    });
  }

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
  }

  function renderChips() {
    var counts = {};
    items.forEach(function (i) {
      counts[i.category] = (counts[i.category] || 0) + 1;
    });
    counts.all = items.length;
    Array.prototype.forEach.call(document.querySelectorAll('.chip-num'), function (el) {
      var k = el.getAttribute('data-num');
      var n = counts[k] || 0;
      el.textContent = n ? n : '';
      var chip = el.parentNode;
      if (!n) chip.style.display = 'none';
    });
  }

  function renderSoon() {
    var soon = items.filter(function (i) {
      var d = daysLeft(i.deadline);
      return d !== null && d >= 0 && d <= 10;
    }).sort(function (a, b) {
      return daysLeft(a.deadline) - daysLeft(b.deadline);
    }).slice(0, 4);

    var box = document.getElementById('soon');
    var list = document.getElementById('soon-list');
    if (!soon.length) { box.hidden = true; list.innerHTML = ''; return; }
    box.hidden = false;
    list.innerHTML = soon.map(function (i) {
      var d = daysLeft(i.deadline);
      var when = d === 0 ? '今日まで' : 'あと' + d + '日';
      return '<li><span class="soon-name">' + esc(i.prize) + '</span>' +
        '<span class="soon-when">' + esc(when) + '</span></li>';
    }).join('');
  }

  function cardHTML(i) {
    var cat = i.category || 'その他';
    var catCls = catClass[cat] || 'cat-other';
    var status = i.status || '当落待ち';
    var parts = [];

    parts.push('<article class="card">');
    parts.push('<div class="card-top">');
    parts.push('<span class="tag ' + catCls + '">' + esc(cat) + '</span>');
    parts.push('<span class="pill ' + statusClass(status) + '">' + esc(status) + '</span>');
    parts.push('</div>');
    parts.push('<h2 class="prize">' + esc(i.prize || '') + '</h2>');
    if (i.organizer) parts.push('<p class="organizer">主催 ' + esc(i.organizer) + '</p>');

    var meta = [];
    if (i.slots) meta.push('<div><dt>枠</dt><dd>' + esc(i.slots) + '</dd></div>');

    if (i.deadline) {
      var d = daysLeft(i.deadline);
      var cls = '';
      var label = fmtDateShort(i.deadline);
      if (d !== null) {
        if (d < 0) { cls = 'is-past'; label += '（締切済）'; }
        else if (d <= 7) { cls = 'is-soon'; label += '（あと' + d + '日）'; }
      }
      meta.push('<div><dt>締切</dt><dd class="' + cls + '">' + esc(label) + '</dd></div>');
    }
    if (i.result_date) {
      meta.push('<div><dt>当落</dt><dd>' + esc(fmtDateShort(i.result_date)) + ' 予定</dd></div>');
    }
    if (meta.length) parts.push('<dl class="meta">' + meta.join('') + '</dl>');

    if (i.result_note) {
      parts.push('<p class="organizer" style="margin-top:8px">' + esc(i.result_note) + '</p>');
    }
    if (i.url) {
      parts.push('<a class="card-link" href="' + esc(i.url) + '" target="_blank" rel="noopener noreferrer">キャンペーン記事を見る <span aria-hidden="true">→</span></a>');
    }
    parts.push('</article>');
    return parts.join('');
  }

  function render() {
    var q = state.q.trim().toLowerCase();
    var list = items.filter(function (i) {
      if (state.cat !== 'all' && i.category !== state.cat) return false;
      if (!q) return true;
      var hay = [i.prize, i.organizer, i.category, i.status, i.slots].join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    });
    list = sortItems(list);

    var host = document.getElementById('list');
    var empty = document.getElementById('empty');

    if (!list.length) {
      host.innerHTML = '';
      empty.hidden = false;
    } else {
      empty.hidden = true;
      var html = [];
      var curDate = null;
      var i, j, groupCount;
      var groups = {};
      list.forEach(function (it) { groups[it.date] = (groups[it.date] || 0) + 1; });
      for (i = 0; i < list.length; i++) {
        var it = list[i];
        if (it.date !== curDate) {
          curDate = it.date;
          html.push('<div class="datehead"><span>' + esc(fmtDate(it.date)) + '</span>' +
            '<span class="dh-count">' + groups[it.date] + '件</span></div>');
        }
        html.push(cardHTML(it));
      }
      host.innerHTML = html.join('');
    }

    document.getElementById('count').textContent =
      (state.cat === 'all' && !q)
        ? '全 ' + list.length + ' 件（新しい順）'
        : list.length + ' 件を表示中';
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

  fetch('data.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      items = (data.items || []).filter(function (i) { return i && i.date && i.prize; });
      renderSummary();
      renderChips();
      renderSoon();
      render();
      bind();

      var upd = data.updated_at ? fmtDate(data.updated_at) : '–';
      document.getElementById('t-updated').textContent = upd;
      document.getElementById('f-updated').textContent = upd;
      document.getElementById('t-next').textContent = data.next_run || '毎日 20:00';
    })
    .catch(fail);
})();
