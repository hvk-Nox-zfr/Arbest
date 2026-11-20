/* ARBEST ARCADE - Hub+ : favoris, récents, défi du jour, série de jours, niveau, tri, filtres auto.
   À charger APRÈS main.js et AVANT effects.js. Ne modifie pas tes jeux. */
(function () {
  'use strict';
  console.log('[Arbest] hub-plus.js chargé');
  var K = { fav: 'arbest_fav', rec: 'arbest_recent', plays: 'arbest_plays', streak: 'arbest_streak' };
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var R = function () { return (typeof GAMES_REGISTRY !== 'undefined') ? GAMES_REGISTRY : {}; };
  function playable() { return Object.keys(R()).filter(function (k) { return !R()[k].disabled; }); }
  function esc(s) { return window.escapeHTML ? escapeHTML(s) : String(s); }
  var favOnly = false, sortMode = 'new';

  /* ---- labels / icônes des catégories manquantes ---- */
  Object.assign(CATEGORY_LABELS, { horreur: 'HORREUR', tycoon: 'TYCOON', battle: 'BATAILLE' });
  Object.assign(CATEGORY_ICONS, { horreur: '', tycoon: '', battle: '' });

  /* ---- série de jours (retour quotidien) ---- */
  function today() { return new Date().toISOString().slice(0, 10); }
  function updateStreak() {
    var s = load(K.streak, { last: '', n: 0 }), t = today();
    if (s.last !== t) {
      var y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      s.n = s.last === y ? s.n + 1 : 1; s.last = t; save(K.streak, s);
    }
    return s.n;
  }
  var streak = updateStreak();

  /* ---- niveau ---- */
  function stats() {
    var p = load(K.plays, {}), n = 0, tried = Object.keys(p).length;
    Object.keys(p).forEach(function (k) { n += p[k]; });
    var xp = n * 25 + tried * 100;
    return { level: Math.floor(xp / 200) + 1, pct: (xp % 200) / 2, plays: n, tried: tried };
  }

  /* ---- jeu du jour (identique pour tout le monde) ---- */
  function daily() {
    var ids = playable().sort(), d = Math.floor(Date.now() / 864e5);
    return ids.length ? ids[d % ids.length] : null;
  }

  /* ---- suivi des parties ---- */
  var _open = window.openGame;
  window.openGame = function (id) {
    if (R()[id] && !R()[id].disabled) {
      var rec = load(K.rec, []).filter(function (x) { return x !== id; }); rec.unshift(id); save(K.rec, rec.slice(0, 8));
      var p = load(K.plays, {}); p[id] = (p[id] || 0) + 1; save(K.plays, p);
    }
    return _open.apply(this, arguments);
  };
  var _close = window.closeGame;
  window.closeGame = function () { var r = _close.apply(this, arguments); renderDash(); decorate(); return r; };

  /* ---- favoris ---- */
  window.toggleFav = function (id, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    var f = load(K.fav, []), i = f.indexOf(id);
    i < 0 ? f.push(id) : f.splice(i, 1); save(K.fav, f);
    decorate(); renderDash();
  };

  /* ---- filtres générés depuis le registre + FAVORIS ---- */
  function buildFilters() {
    var box = document.querySelector('.category-filters'); if (!box) return;
    var counts = {}; Object.keys(R()).forEach(function (k) { var c = R()[k].category; if (c) counts[c] = (counts[c] || 0) + 1; });
    var h = '<button class="filter-btn active" data-cat="all" onclick="setFilter(\'all\', this)">TOUS <b>' + Object.keys(R()).length + '</b></button>' +
            '<button class="filter-btn fav-btn" data-cat="fav" onclick="setFilter(\'fav\', this)">Favoris</button>';
    Object.keys(counts).forEach(function (c) {
      h += '<button class="filter-btn" data-cat="' + c + '" onclick="setFilter(\'' + c + '\', this)">' +
           esc(CATEGORY_LABELS[c] || c.toUpperCase()) + ' <b>' + counts[c] + '</b></button>';
    });
    box.innerHTML = h;
  }
  var _setFilter = window.setFilter;
  window.setFilter = function (cat, btn) { favOnly = cat === 'fav'; _setFilter(favOnly ? 'all' : cat, btn); };

  /* ---- tri ---- */
  function buildSort() {
    var host = document.querySelector('.search-box'); if (!host || document.getElementById('sort-select')) return;
    var s = document.createElement('select'); s.id = 'sort-select'; s.className = 'sort-select'; s.setAttribute('aria-label', 'Trier');
    s.innerHTML = '<option value="new">Nouveautés</option><option value="az">A → Z</option><option value="best">Mes records</option><option value="played">Les plus joués</option>';
    s.onchange = function () { sortMode = s.value; renderHubGrid(); };
    host.parentNode.insertBefore(s, host.nextSibling);
    var row = document.createElement('div'); row.className = 'search-row';
    host.parentNode.insertBefore(row, host); row.appendChild(host); row.appendChild(s);
    var rnd = document.getElementById('random-game'); if (rnd) row.appendChild(rnd);
  }

  /* ---- rendu de la grille : on laisse main.js dessiner, puis on enrichit ---- */
  var _render = window.renderHubGrid;
  window.renderHubGrid = function () { _render(); decorate(); };

  function cardId(c) { var e = c.querySelector('[id^="hs-"]'); return e ? e.id.slice(3) : null; }
  function decorate() {
    var grid = document.getElementById('game-grid'); if (!grid) return;
    var favs = load(K.fav, []), plays = load(K.plays, {}), cards = [].slice.call(grid.querySelectorAll('.game-card'));
    cards.forEach(function (c) {
      var id = cardId(c); if (!id) return;
      c.dataset.id = id; var fb=c.querySelector('.thumb-fallback'); if(!c.style.getPropertyValue('--h')){var x=0;for(var q=0;q<id.length;q++)x=(x*31+id.charCodeAt(q))%360;c.style.setProperty('--h',x);} if(fb){var t=c.querySelector('h3');fb.dataset.l=t?t.textContent.trim().charAt(0).toUpperCase():'';}
      var th = c.querySelector('.card-thumb'), old = th && th.querySelector('.fav-star');
      if (th && !old) {
        var b = document.createElement('button'); b.className = 'fav-star'; b.type = 'button'; b.setAttribute('aria-label', 'Favori');
        b.onclick = function (e) { toggleFav(id, e); }; th.appendChild(b); old = b;
      }
      if (old) { var on = favs.indexOf(id) > -1; old.classList.toggle('on', on); old.textContent = on ? '★' : '☆'; }
      var meta = c.querySelector('.card-meta'), pl = meta && meta.querySelector('.plays-chip');
      if (meta && plays[id] && !pl) { pl = document.createElement('span'); pl.className = 'plays-chip'; meta.appendChild(pl); }
      if (pl) pl.textContent = 'Joué ×' + plays[id];
    });
    var vis = cards.filter(function (c) { return !favOnly || favs.indexOf(c.dataset.id) > -1; });
    cards.forEach(function (c) { c.style.display = vis.indexOf(c) > -1 ? '' : 'none'; });
    var hs = function (c) { return parseInt(localStorage.getItem('hs_' + c.dataset.id), 10) || 0; };
    var sorters = {
      az: function (a, b) { return a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent, 'fr'); },
      best: function (a, b) { return hs(b) - hs(a); },
      played: function (a, b) { return (plays[b.dataset.id] || 0) - (plays[a.dataset.id] || 0); }
    };
    if (sorters[sortMode]) vis.slice().sort(sorters[sortMode]).forEach(function (c) { grid.appendChild(c); });
    var old = grid.querySelector('.fav-empty'); if (old) old.remove();
    if (favOnly && !vis.length) grid.insertAdjacentHTML('beforeend', '<div class="empty-state fav-empty">Aucun favori pour l\'instant.<br>Clique sur l\'étoile d\'une carte pour la garder ici !</div>');
    var cnt = document.getElementById('result-count'); if (cnt) cnt.textContent = vis.length + ' jeu' + (vis.length > 1 ? 'x' : '') + ' affiché' + (vis.length > 1 ? 's' : '');
  }

  /* ---- tableau de bord : défi du jour, reprendre, niveau ---- */
  function renderDash() {
    var hub = document.getElementById('hub-view'), grid = document.getElementById('game-grid'); if (!hub || !grid) return;
    var d = document.getElementById('hub-dash');
    if (!d) { d = document.createElement('div'); d.id = 'hub-dash'; grid.parentNode.insertBefore(d, grid);
      var c = document.createElement('div'); c.id = 'result-count'; c.className = 'result-count'; grid.parentNode.insertBefore(c, grid); }
    var did = daily(), g = did && R()[did], st = stats(), rec = load(K.rec, []).filter(function (x) { return R()[x] && !R()[x].disabled; }).slice(0, 5);
    var html = '<div class="dash-top">';
    if (g) html += '<button class="daily-card" onclick="openGame(\'' + did + '\')"><span class="daily-tag">Défi du jour</span><strong>' + esc(g.title) + '</strong><em>Bats ton record aujourd\'hui !</em><span class="daily-go">Jouer</span></button>';
    html += '<div class="player-card"><div class="pc-row"><span class="pc-lvl">Niveau ' + st.level + '</span><span class="pc-streak">' + streak + ' jour' + (streak > 1 ? 's' : '') + ' d\'affilée</span></div>' +
            '<div class="xp-bar"><i style="width:' + st.pct + '%"></i></div><div class="pc-sub">' + st.tried + ' jeu' + (st.tried > 1 ? 'x' : '') + ' essayé' + (st.tried > 1 ? 's' : '') + ' · ' + st.plays + ' partie' + (st.plays > 1 ? 's' : '') + '</div></div></div>';
    if (rec.length) html += '<div class="recent-row"><span class="recent-title">Reprendre</span>' + rec.map(function (id) {
      return '<button class="recent-chip" onclick="openGame(\'' + id + '\')">' + esc(R()[id].title) + '</button>'; }).join('') + '</div>';
    d.innerHTML = html;
  }

  /* ---- raccourci "/" pour chercher ---- */
  document.addEventListener('keydown', function (e) {
    var inGame = document.body.classList.contains('in-game'), t = e.target.tagName;
    if (e.key === '/' && !inGame && t !== 'INPUT' && t !== 'SELECT') { e.preventDefault(); var i = document.getElementById('game-search'); if (i) i.focus(); }
  });

  function init() { buildFilters(); buildSort(); renderDash(); decorate(); }
  window.addEventListener('load', function () { setTimeout(init, 0); });
})();