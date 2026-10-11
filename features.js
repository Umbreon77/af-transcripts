/* Shared by trends.html, people.html, person.html and week.html: the theme picker (copied
   from research.html), site links for both sites, small helpers, the monthly line chart and
   sparklines. Each page sets `var STATIC` (export_static.py flips it to true) before this file. */
(function () {
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var ST = !!window.STATIC;
  var DATA = ST ? 'data/' : '/data/';
  function qs(p) { var s = new URLSearchParams(p || {}).toString(); return s ? '?' + s : ''; }
  // Site links: :8000 serves /research/trends…; the static export has flat files at its root.
  var HREF = {
    research: function (p) { return (ST ? 'research.html' : '/research') + qs(p); },
    trends: function (p) { return (ST ? 'trends.html' : '/research/trends') + qs(p).replace(/%2C/g, ','); },
    people: function () { return ST ? 'people.html' : '/research/people'; },
    person: function (slug) { return ST ? 'person.html?p=' + slug : '/research/people/' + slug; },
    week: function (w) { return (ST ? 'week.html' : '/week') + (w ? '?w=' + w : ''); },
    positions: function (pid) { return (ST ? 'positions.html' : '/positions') + (pid ? '#' + pid : ''); }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function dateMed(s) { return s ? MON[+s.slice(4, 6) - 1] + ' ' + +s.slice(6, 8) + ', ' + s.slice(0, 4) : ''; }
  function monShort(m) { return MON[+m.slice(4, 6) - 1] + ' ' + m.slice(2, 4); }
  function monLong(m) { return MONL[+m.slice(4, 6) - 1] + ' ' + m.slice(0, 4); }
  function hms(s) { var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (x < 10 ? '0' : '') + x; }
  function epHref(u, t) { return (ST ? 'ep/' + u + '/' : '/ep/' + u) + (t != null ? '#t=' + t : ''); }
  function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }); }
  var catP = null;
  function catalogue() {
    if (!catP) catP = getJSON(DATA + 'catalogue.json').then(function (c) {
      c.byId = {}; c.episodes.forEach(function (e) { c.byId[e.id] = e; });
      var f = document.getElementById('foot-upd');
      if (f && c.updated) f.textContent = 'Updated ' + dateMed(c.updated) + ' · ';
      return c;
    });
    return catP;
  }
  function epLabel(e) { return e.ep ? 'Ep. ' + e.ep : (e.kind === 'guest' ? 'Interview' : 'Special'); }

  /* ── Theme picker (copied from research.html) ── */
  (function () {
    var THEMES = [['signal-dark','Classic Dark','dark'],['midnight','Midnight','dark'],['graphite','Graphite','dark'],['forest','Forest','dark'],['oxblood','Oxblood','dark'],['arctic','Arctic Night','dark'],['paper','Paper','light'],['daylight','Daylight','light'],['sepia','Sepia','light'],['sage','Sage','light']];
    var KEY = 'signal-theme', root = document.documentElement;
    var pick = document.getElementById('theme-pick');
    if (!pick) return;
    var btn = pick.querySelector('.theme-btn'), menu = pick.querySelector('.theme-menu');
    var h = '', group = '';
    THEMES.forEach(function (t) {
      if (t[2] !== group) { group = t[2]; h += '<div class="theme-group">' + (group === 'dark' ? 'Dark' : 'Light') + '</div>'; }
      h += '<button type="button" class="theme-opt" role="menuitemradio" data-set="' + t[0] + '"><span class="theme-sw" data-theme="' + t[0] + '"></span>' + t[1] + '</button>';
    });
    menu.innerHTML = h;
    var opts = [].slice.call(menu.querySelectorAll('.theme-opt'));
    function cur() { return root.getAttribute('data-theme') || 'signal-dark'; }
    function sync() { opts.forEach(function (o) { o.setAttribute('aria-checked', o.getAttribute('data-set') === cur() ? 'true' : 'false'); }); }
    function show(v) {
      menu.hidden = !v;
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v) { sync(); (menu.querySelector('[aria-checked="true"]') || opts[0]).focus(); }
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); show(menu.hidden); });
    menu.addEventListener('click', function (e) {
      var o = e.target.closest('.theme-opt');
      if (!o) return;
      root.setAttribute('data-theme', o.getAttribute('data-set'));
      try { localStorage.setItem(KEY, o.getAttribute('data-set')); } catch (err) {}
      show(false); btn.focus();
    });
    menu.addEventListener('keydown', function (e) {
      var i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
    });
    document.addEventListener('click', function (e) { if (!menu.hidden && !pick.contains(e.target)) show(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { show(false); btn.focus(); } });
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY) return;
      if (e.newValue) root.setAttribute('data-theme', e.newValue); else root.removeAttribute('data-theme');
    });
  })();

  /* ── Series colors: the dataviz reference palette's first four slots, stepped per mode
     (validated: adjacent CVD ΔE ≥ 8.4, normal-vision ≥ 19.8). Light mode's aqua and yellow are
     under 3:1 on the background, so lines carry direct labels and a table view. ── */
  var SERIES = { light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'], dark: ['#3987e5', '#d95926', '#199e70', '#c98500'] };
  function mode() { return getComputedStyle(document.documentElement).colorScheme.indexOf('light') !== -1 ? 'light' : 'dark'; }
  function color(i) { return SERIES[mode()][i % 4]; }
  var themeCbs = [];
  new MutationObserver(function () { themeCbs.forEach(function (f) { f(); }); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function nice(max) {
    if (max <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(max))), f = max / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function fmtN(v, dec) { return dec ? (Math.round(v * 10) / 10).toLocaleString() : Math.round(v).toLocaleString(); }

  /* lineChart(el, {months, series: [{name, values, ci}], dec, onPick(i), sel})
     One line per series, a crosshair tooltip on hover, click/tap a month to pick it. */
  function lineChart(el, o) {
    var tip = document.createElement('div'); tip.className = 'ctip'; tip.hidden = true;
    var holder = document.createElement('div');
    el.innerHTML = ''; el.classList.add('chart'); el.appendChild(holder); el.appendChild(tip);
    var W = 0, geo = null;
    function draw() {
      W = el.clientWidth || 600;
      var phone = W < 560, H = phone ? 220 : 270;
      var labels = !phone && o.series.length > 0;
      var m = { l: 42, r: labels ? 96 : 10, t: 12, b: 24 };
      var n = o.months.length, iw = W - m.l - m.r, ih = H - m.t - m.b;
      var max = 0;
      o.series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
      var top = nice(max * 1.05), step = n > 1 ? iw / (n - 1) : 0;
      function x(i) { return m.l + i * step; }
      function y(v) { return m.t + ih - v / top * ih; }
      geo = { x: x, y: y, m: m, step: step, n: n, H: H };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" role="img" aria-label="' + esc(o.label || 'Monthly line chart') + '">';
      if (o.sel != null) s += '<rect class="sel" x="' + (x(o.sel) - Math.max(step / 2, 4)) + '" y="' + m.t + '" width="' + Math.max(step, 8) + '" height="' + ih + '" rx="3"/>';
      for (var g = 0; g <= 4; g++) {
        var gv = top * g / 4, gy = y(gv);
        s += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + gy + '" y2="' + gy + '"/>';
        s += '<text class="axis" x="' + (m.l - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + fmtN(gv, o.dec && top < 10) + '</text>';
      }
      var marks = [];
      o.months.forEach(function (mo, i) { if (i === 0 || i === n - 1 || mo.slice(4) === '01' || (!phone && mo.slice(4) === '07')) marks.push(i); });
      var gap = phone ? 4 : 3, kept = [];
      marks.forEach(function (i) {
        if (i === n - 1) { while (kept.length > 1 && i - kept[kept.length - 1] < gap) kept.pop(); kept.push(i); }
        else if (!kept.length || i - kept[kept.length - 1] >= gap) kept.push(i);
      });
      marks = kept;
      marks.forEach(function (i) {
        var anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        s += '<text class="axis" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + anchor + '">' + monShort(o.months[i]) + '</text>';
      });
      var ends = [];
      o.series.forEach(function (se) {
        var c = color(se.ci);
        s += '<polyline class="ln" stroke="' + c + '" points="' + se.values.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ') + '"/>';
        ends.push({ y: y(se.values[n - 1]), name: se.name, c: c });
      });
      if (labels) {
        ends.sort(function (a, b) { return a.y - b.y; });
        for (var k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 13) ends[k].y = ends[k - 1].y + 13;
        ends.forEach(function (e) {
          var nm = e.name.length > 13 ? e.name.slice(0, 12) + '…' : e.name;
          s += '<line x1="' + (W - m.r + 3) + '" x2="' + (W - m.r + 11) + '" y1="' + e.y + '" y2="' + e.y + '" stroke="' + e.c + '" stroke-width="2"/>' +
            '<text class="lab" x="' + (W - m.r + 14) + '" y="' + (e.y + 4) + '">' + esc(nm) + '</text>';
        });
      }
      s += '<g id="hov"></g><rect class="hit" x="' + (m.l - Math.max(step / 2, 4)) + '" y="0" width="' + (iw + Math.max(step, 8)) + '" height="' + H + '"/></svg>';
      holder.innerHTML = s;
    }
    function at(ev) {
      var r = holder.firstChild.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
      return Math.max(0, Math.min(geo.n - 1, Math.round((px - geo.m.l) / (geo.step || 1))));
    }
    function hover(i, ev) {
      var g = holder.querySelector('#hov');
      if (i == null) { g.innerHTML = ''; tip.hidden = true; return; }
      var h = '<line class="xh" x1="' + geo.x(i) + '" x2="' + geo.x(i) + '" y1="' + geo.m.t + '" y2="' + (geo.H - geo.m.b) + '"/>';
      var t = '<b>' + monLong(o.months[i]) + '</b>';
      o.series.forEach(function (se) {
        h += '<circle class="dot" r="4.5" cx="' + geo.x(i) + '" cy="' + geo.y(se.values[i]) + '" fill="' + color(se.ci) + '"/>';
        t += '<div><i style="background:' + color(se.ci) + '"></i>' + esc(se.name) + '<span class="v">' + fmtN(se.values[i], o.dec) + '</span></div>';
      });
      if (o.partial && i === geo.n - 1) t += '<div style="color:var(--muted);margin-top:3px">' + esc(o.partial) + '</div>';
      if (o.tipNote) t += '<div style="color:var(--muted);margin-top:3px">' + o.tipNote + '</div>';
      g.innerHTML = h;
      tip.innerHTML = t; tip.hidden = false;
      var r = el.getBoundingClientRect(), tx = ev.clientX - r.left + 14;
      if (tx + tip.offsetWidth > r.width) tx = ev.clientX - r.left - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, tx) + 'px'; tip.style.top = Math.max(0, ev.clientY - r.top - tip.offsetHeight - 10) + 'px';
    }
    holder.addEventListener('pointermove', function (ev) { if (geo) hover(at(ev), ev); });
    holder.addEventListener('pointerleave', function () { if (geo) hover(null); });
    holder.addEventListener('click', function (ev) { if (geo && o.onPick) { var i = at(ev); o.sel = i; draw(); hover(i, ev); o.onPick(i); } });
    draw();
    // One resize/theme hook per element, always drawing the element's latest chart.
    el._sfDraw = draw;
    if (!el._sfHooked) {
      el._sfHooked = true;
      var lastW = el.clientWidth;
      if (window.ResizeObserver) new ResizeObserver(function () { if (el.clientWidth !== lastW) { lastW = el.clientWidth; el._sfDraw(); } }).observe(el);
      themeCbs.push(function () { el._sfDraw(); });
    }
    return { redraw: function (no) { if (no) for (var k in no) o[k] = no[k]; draw(); } };
  }

  function sparkline(values, w, h) {
    var max = Math.max.apply(null, values) || 1, n = values.length;
    var pts = values.map(function (v, i) { return (i * (w - 2) / (n - 1) + 1).toFixed(1) + ',' + (h - 1 - v / max * (h - 2)).toFixed(1); }).join(' ');
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  }

  function tableView(months, series, dec) {
    var h = '<div class="tv-wrap"><table class="tv"><thead><tr><th>Month</th>' + series.map(function (s) { return '<th>' + esc(s.name) + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (var i = months.length - 1; i >= 0; i--) h += '<tr><td>' + monShort(months[i]) + '</td>' + series.map(function (s) { return '<td>' + fmtN(s.values[i], dec) + '</td>'; }).join('') + '</tr>';
    return h + '</tbody></table></div>';
  }

  // Research's section tabs: carry the current name or term over to Moments, Full text and Trends.
  function rtabs(q) {
    var nav = document.getElementById('rtabs');
    if (!nav) return;
    var p = q ? { q: q } : {};
    var to = { m: HREF.research(p), ft: HREF.research(q ? { q: q, tab: 'ft' } : { tab: 'ft' }), trends: HREF.trends(p), people: HREF.people() };
    [].forEach.call(nav.querySelectorAll('a[data-rt]'), function (a) { a.href = to[a.getAttribute('data-rt')]; });
  }

  var SPK_BADGE = { bit: 'Bit', clip: 'Clip', reading: 'Reading', guest: 'Guest' };
  function badge(spk) { return SPK_BADGE[spk] ? '<span class="spk">' + SPK_BADGE[spk] + '</span>' : ''; }

  window.SF = { MON: MON, DATA: DATA, HREF: HREF, rtabs: rtabs, STATIC: ST, slugify: slugify, esc: esc, dateMed: dateMed, monShort: monShort, monLong: monLong, hms: hms, epHref: epHref,
    getJSON: getJSON, catalogue: catalogue, epLabel: epLabel, lineChart: lineChart, sparkline: sparkline, tableView: tableView,
    color: color, badge: badge, fmtN: fmtN, onTheme: function (f) { themeCbs.push(f); } };
})();
