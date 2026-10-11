/* Signal search engine (shared: public/index.html, public/research.html).
   Query syntax: words are ANDed, "exact phrase", -exclude. Full text runs over the
   monthly shards in data/search/YYYYMM.json ({m, e: [[tid, [[seconds, text]…]]…]}). */
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // Name aliases (catalogue.json "aliases", from positions/aliases.json): an unquoted name, one
  // word or several in a row, also matches the other forms of its group as whole words.
  var ALIAS = {}, MAXW = 1;
  function aliases(groups) {
    ALIAS = {}; MAXW = 1;
    (groups || []).forEach(function (g) {
      var low = g.map(function (x) { return x.toLowerCase(); });
      low.forEach(function (x) { ALIAS[x] = low; MAXW = Math.max(MAXW, x.split(' ').length); });
    });
  }
  // A term's alternatives: [text, wholeWord]. The typed term itself keeps plain substring matching.
  function alts(t, exact) {
    return [[t, false]].concat(exact || !ALIAS[t] ? [] : ALIAS[t].filter(function (x) { return x !== t; }).map(function (x) { return [x, true]; }));
  }
  function isW(c) { return !!c && /[a-z0-9]/.test(c); }
  function find(hay, a, from) {
    var i = hay.indexOf(a[0], from || 0);
    if (!a[1]) return i;
    while (i !== -1 && (isW(hay[i - 1]) || isW(hay[i + a[0].length]))) i = hay.indexOf(a[0], i + 1);
    return i;
  }
  function first(hay, as) {
    var best = -1;
    as.forEach(function (a) { var x = find(hay, a); if (x !== -1 && (best === -1 || x < best)) best = x; });
    return best;
  }
  function parse(q) {
    var toks = [], neg = [], m, re = /(-?)"([^"]+)"|(-?)(\S+)/g;
    while ((m = re.exec(q))) {
      var t = (m[2] || m[4] || '').toLowerCase().replace(/\s+/g, ' ').trim(), isNeg = !!(m[1] || m[3]);
      if (t && t !== '-') (isNeg ? neg : toks).push([t, !!m[2]]);
    }
    // Join runs of unquoted words that spell an alias ("peter thiel"), longest first.
    var terms = [], alt = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i][0], exact = toks[i][1];
      if (!exact) for (var w = Math.min(MAXW, toks.length - i); w > 1; w--) {
        var run = toks.slice(i, i + w);
        if (run.some(function (x) { return x[1]; })) continue;
        var j = run.map(function (x) { return x[0]; }).join(' ');
        if (ALIAS[j]) { t = j; i += w - 1; break; }
      }
      terms.push(t); alt.push(alts(t, exact));
    }
    return { terms: terms, neg: neg.map(function (x) { return x[0]; }), alt: alt };
  }
  function termAlts(p, k) { return (p.alt && p.alt[k]) || [[p.terms[k], false]]; }
  function hl(text, terms) {
    if (!terms.length) return esc(text);
    var low = text.toLowerCase(), marks = [];
    terms.forEach(function (t) { alts(t).forEach(function (a) { var i = find(low, a); while (i !== -1) { marks.push([i, i + a[0].length]); i = find(low, a, i + a[0].length); } }); });
    if (!marks.length) return esc(text);
    marks.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var out = '', last = 0;
    marks.forEach(function (m) { if (m[0] < last) return; out += esc(text.slice(last, m[0])) + '<mark>' + esc(text.slice(m[0], m[1])) + '</mark>'; last = m[1]; });
    return out + esc(text.slice(last));
  }
  function textMatch(low, p) {
    for (var i = 0; i < p.terms.length; i++) if (first(low, termAlts(p, i)) === -1) return false;
    for (var j = 0; j < p.neg.length; j++) if (low.indexOf(p.neg[j]) !== -1) return false;
    return p.terms.length > 0;
  }
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }); }
  // One cache per data folder; each episode row gets its lowercased lines appended (ep[2]).
  function shards(base) {
    var cache = {};
    return function (m) {
      if (!cache[m]) cache[m] = getJSON(base + 'search/' + m + '.json').then(function (j) {
        j.e.forEach(function (ep) { ep.push(ep[1].map(function (l) { return l[1].trim().toLowerCase(); })); });
        return j;
      }, function (err) { delete cache[m]; throw err; });
      return cache[m];
    };
  }
  // A line matches when every term is in it plus the next line (so phrases that wrap
  // a caption break are found) and the first match starts in this line.
  function scanEp(lines, low, p) {
    var hits = [], n = lines.length;
    for (var i = 0; i < n; i++) {
      var a = low[i], win = i + 1 < n ? a + ' ' + low[i + 1] : a, at = Infinity, ok = true;
      for (var k = 0; k < p.terms.length; k++) { var x = first(win, termAlts(p, k)); if (x === -1) { ok = false; break; } if (x < at) at = x; }
      if (!ok || at >= a.length) continue;
      for (var j = 0; j < p.neg.length; j++) if (win.indexOf(p.neg[j]) !== -1) { ok = false; break; }
      if (!ok) continue;
      hits.push(i); i++;
    }
    return hits;
  }
  function snippet(lines, i, terms) {
    var a = lines[i][1].trim(), b = i + 1 < lines.length ? lines[i + 1][1].trim() : '';
    var text = b ? a + ' ' + b : a, low = text.toLowerCase(), at = Infinity;
    terms.forEach(function (t) { var x = first(low, alts(t)); if (x !== -1 && x < at) at = x; });
    var s = Math.max(0, (at === Infinity ? 0 : at) - 60), e = Math.min(text.length, s + 220);
    if (s > 0) s = text.indexOf(' ', s) + 1 || s;
    return (s > 0 ? '…' : '') + hl(text.slice(s, e), terms) + (e < text.length ? '…' : '');
  }
  window.SignalSearch = { esc: esc, aliases: aliases, parse: parse, hl: hl, textMatch: textMatch, getJSON: getJSON, shards: shards, scanEp: scanEp, snippet: snippet };
})();
