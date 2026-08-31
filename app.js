(function () {
  "use strict";

  // A URL of the form ...?readonly=1 renders the app with every editing
  // control (owned toggle, image replace/reset, team photo upload, import)
  // removed, so the link is safe to share for viewing only. Note this is a
  // UI convenience, not a security boundary: all collection data already
  // lives only in each visitor's own browser (localStorage/IndexedDB), so a
  // normal (non-readonly) link can never let a viewer change what's stored
  // on the owner's device either way.
  var READONLY = new URLSearchParams(window.location.search).get("readonly") === "1";

  // ================= Collection ownership (localStorage) =================

  var STORAGE_KEY = "uniKitCollectionOverrides.v1";

  function loadOverrides() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveOverrides(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }

  var overrides = loadOverrides();

  function kitKey(startYear, kitType) {
    return startYear + "_" + kitType;
  }

  function isOwned(kit, startYear) {
    var key = kitKey(startYear, kit.kitType);
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      return overrides[key];
    }
    return !!kit.inCollection;
  }

  function toggleOwned(kit, startYear) {
    var key = kitKey(startYear, kit.kitType);
    var current = isOwned(kit, startYear);
    overrides[key] = !current;
    saveOverrides(overrides);
    return !current;
  }

  // ================= Image storage (IndexedDB): team photos + kit image overrides =================

  var DB_NAME = "uniKitDB";
  var DB_VERSION = 2;
  var TEAM_PHOTO_STORE = "teamPhotos";
  var KIT_IMAGE_STORE = "kitImages";

  var teamPhotoCache = {}; // startYear -> { blob, url }
  var kitImageCache = {};  // "startYear_kitType" -> { blob, url }

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(TEAM_PHOTO_STORE)) db.createObjectStore(TEAM_PHOTO_STORE);
        if (!db.objectStoreNames.contains(KIT_IMAGE_STORE)) db.createObjectStore(KIT_IMAGE_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbPut(storeName, key, blob) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(blob, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbDelete(storeName, key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function loadAllFromStore(storeName) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readonly");
        var store = tx.objectStore(storeName);
        var keysReq = store.getAllKeys();
        var valsReq = store.getAll();
        tx.oncomplete = function () {
          var map = {};
          keysReq.result.forEach(function (k, i) {
            var blob = valsReq.result[i];
            map[k] = { blob: blob, url: URL.createObjectURL(blob) };
          });
          resolve(map);
        };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(dataURL) {
    return fetch(dataURL).then(function (r) { return r.blob(); });
  }

  // ================= Data =================

  var flatKits = [];
  KIT_DATA.forEach(function (season) {
    season.kits.forEach(function (kit) {
      flatKits.push({ season: season, kit: kit });
    });
  });

  // First season each player appears anywhere in the dataset (KIT_DATA is
  // already ordered oldest-to-newest). Used to flag "new" signings -- this is
  // a proxy, not a verified transfer record: it really means "first time this
  // app has this player on the books", so anyone already at the club before
  // the data begins in 1992/93 would incorrectly look new that year. The
  // 1992/93 season itself is therefore excluded from the flag entirely.
  var EARLIEST_SEASON_YEAR = KIT_DATA.length ? KIT_DATA[0].startYear : null;
  var firstSeasonByPlayer = {};
  KIT_DATA.forEach(function (season) {
    (season.squad || []).forEach(function (p) {
      if (!(p.name in firstSeasonByPlayer)) {
        firstSeasonByPlayer[p.name] = season.startYear;
      }
    });
  });
  function isNewSignee(p, season) {
    return season.startYear !== EARLIEST_SEASON_YEAR && firstSeasonByPlayer[p.name] === season.startYear;
  }

  var brandSet = new Set();
  var sponsorSet = new Set();
  var managerSet = new Set();
  var trophySet = new Set();

  KIT_DATA.forEach(function (season) {
    if (season.manager) managerSet.add(season.manager);
    (season.trophies || []).forEach(function (t) { trophySet.add(t); });
    season.kits.forEach(function (k) {
      if (k.brand) brandSet.add(k.brand);
      if (k.sponsor) sponsorSet.add(k.sponsor);
    });
  });

  function fillSelect(id, values) {
    var el = document.getElementById(id);
    Array.from(values).sort().forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    });
  }

  fillSelect("brandFilter", brandSet);
  fillSelect("sponsorFilter", sponsorSet);
  fillSelect("managerFilter", managerSet);
  fillSelect("trophyFilter", trophySet);

  var jumpTo = document.getElementById("jumpTo");
  KIT_DATA.forEach(function (season) {
    var opt = document.createElement("option");
    opt.value = season.startYear;
    opt.textContent = season.label;
    jumpTo.appendChild(opt);
  });
  jumpTo.addEventListener("change", function () {
    if (!jumpTo.value) return;
    var el = document.getElementById("season-" + jumpTo.value);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    jumpTo.value = "";
  });

  // ================= Stats =================

  function renderStats() {
    var totalKits = flatKits.length;
    var ownedCount = flatKits.filter(function (fk) { return isOwned(fk.kit, fk.season.startYear); }).length;
    var seasonCount = KIT_DATA.length;
    var stats = [
      { num: seasonCount, label: "Seasons" },
      { num: totalKits, label: "Total kits" },
      { num: ownedCount, label: "Owned" },
      { num: Math.round((ownedCount / totalKits) * 100) + "%", label: "Complete" }
    ];
    var bar = document.getElementById("statsBar");
    bar.innerHTML = "";
    stats.forEach(function (s) {
      var div = document.createElement("div");
      div.className = "stat";
      div.innerHTML = '<span class="stat-num">' + s.num + '</span><span class="stat-label">' + s.label + '</span>';
      bar.appendChild(div);
    });
  }

  // ================= Filtering (season-level) =================

  var els = {
    search: document.getElementById("searchInput"),
    brand: document.getElementById("brandFilter"),
    sponsor: document.getElementById("sponsorFilter"),
    manager: document.getElementById("managerFilter"),
    trophy: document.getElementById("trophyFilter"),
    kitType: document.getElementById("kitTypeFilter"),
    ownedOnly: document.getElementById("ownedOnly"),
    clear: document.getElementById("clearFilters")
  };

  function seasonMatches(season) {
    if (els.brand.value && !season.kits.some(function (k) { return k.brand === els.brand.value; })) return false;
    if (els.sponsor.value && !season.kits.some(function (k) { return k.sponsor === els.sponsor.value; })) return false;
    if (els.manager.value && season.manager !== els.manager.value) return false;
    if (els.trophy.value && (season.trophies || []).indexOf(els.trophy.value) === -1) return false;
    if (els.kitType.value && !season.kits.some(function (k) { return k.kitType === els.kitType.value; })) return false;

    if (els.ownedOnly.checked) {
      var relevantKits = els.kitType.value
        ? season.kits.filter(function (k) { return k.kitType === els.kitType.value; })
        : season.kits;
      if (!relevantKits.some(function (k) { return isOwned(k, season.startYear); })) return false;
    }

    var q = els.search.value.trim().toLowerCase();
    if (q) {
      var haystack = [season.label, season.manager]
        .concat(season.kits.map(function (k) { return k.brand + " " + k.sponsor + " " + k.kitType; }))
        .join(" ").toLowerCase();
      var playerMatch = (season.squad || []).some(function (p) {
        return p.name.toLowerCase().indexOf(q) !== -1;
      });
      if (haystack.indexOf(q) === -1 && !playerMatch) return false;
    }

    return true;
  }

  function currentFiltered() {
    return KIT_DATA.filter(seasonMatches);
  }

  // ================= Formation pitch =================

  // formationPosition is null for every squad row, so there's no ground truth
  // ordering to place players left-to-right within a row. Where bdfutbol.com
  // enrichment data is present, positionDetail gives a real side for
  // defenders (Left Back / Right Back) and that's used directly. Everything
  // else (goalkeepers, center backs, midfielders, forwards) has no side
  // information even in the enriched data -- bdfutbol's own position coding
  // doesn't distinguish wide from central there -- so it falls back to the
  // classic English squad-number convention (2=RB, 3=LB, 7=RW, 11=LW) as a
  // heuristic. Neither source is a historical record of exact formation
  // slots; this is the best approximation available from the two combined.
  var SIDE_HINT = { 2: 1, 3: -1, 7: 1, 11: -1 };
  function sideHint(p) {
    if (p.positionDetail === "Left Back") return -1;
    if (p.positionDetail === "Right Back") return 1;
    return SIDE_HINT[p.shirtNumber] || 0;
  }

  function buildFormationLayout(season) {
    var starters = (season.squad || []).filter(function (p) { return p.isStartingXI; });

    function cat(pos) {
      pos = (pos || "").toLowerCase();
      if (pos.indexOf("goal") !== -1) return "GK";
      if (pos.indexOf("def") !== -1) return "DEF";
      if (pos.indexOf("mid") !== -1) return "MID";
      return "FWD";
    }

    var byCat = { GK: [], DEF: [], MID: [], FWD: [] };
    starters.forEach(function (p) { byCat[cat(p.position)].push(p); });
    ["GK", "DEF", "MID", "FWD"].forEach(function (c) {
      byCat[c].sort(function (a, b) {
        var as = sideHint(a), bs = sideHint(b);
        if (as !== bs) return as - bs;
        var an = a.shirtNumber == null ? 999 : a.shirtNumber;
        var bn = b.shirtNumber == null ? 999 : b.shirtNumber;
        return an - bn;
      });
    });

    var rowsSpec = (season.formation || "4-4-2").split("-").map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
    if (rowsSpec.length === 0) rowsSpec = [4, 4, 2];

    var midRowCount = rowsSpec.length - 2;
    var midPool = byCat.MID.slice();
    var midRows = [];
    if (midRowCount <= 1) {
      midRows = [midPool];
    } else {
      var perRow = Math.ceil(midPool.length / midRowCount);
      for (var i = 0; i < midRowCount; i++) {
        midRows.push(midPool.slice(i * perRow, (i + 1) * perRow));
      }
    }

    var rows = [byCat.DEF].concat(midRows).concat([byCat.FWD]);
    var layout = [];
    layout.push({ y: 90, players: byCat.GK.slice(0, 1) });
    rows.forEach(function (rowPlayers, idx) {
      var y = 90 - ((idx + 1) * (78 / rows.length));
      layout.push({ y: Math.max(y, 8), players: rowPlayers });
    });
    return layout;
  }

  // Places `count` players centered within a virtual row of `maxCount` evenly
  // spaced slots, so a narrower row (e.g. 2 forwards) lines up above the
  // inner/central players of a wider row below it (e.g. 4 midfielders)
  // instead of spreading out to the full pitch width.
  function computeXPositions(count, maxCount) {
    if (count === 0) return [];
    if (maxCount <= 1) return new Array(count).fill(50);
    var startSlot = (maxCount - count) / 2;
    var xs = [];
    for (var i = 0; i < count; i++) {
      xs.push(12 + (startSlot + i) * (76 / (maxCount - 1)));
    }
    return xs;
  }

  function pitchHTML(season) {
    var layout = buildFormationLayout(season);
    var maxCount = layout.reduce(function (m, row) { return Math.max(m, row.players.length); }, 1);
    var html = '<div class="pitch-wrap">';
    layout.forEach(function (row) {
      var xs = computeXPositions(row.players.length, maxCount);
      row.players.forEach(function (p, idx) {
        var x = xs[idx];
        var num = p.shirtNumber != null ? p.shirtNumber : "-";
        html += '<div class="pitch-player" style="top:' + row.y + '%; left:' + x + '%;">' +
                  '<div class="pitch-jersey">' + num + '</div>' +
                  '<div class="pitch-player-name">' + escapeHTML(p.name) + '</div>' +
                '</div>';
      });
    });
    html += '</div>';
    return html;
  }

  function statsLine(p) {
    if (!p.stats) return "";
    var parts = [p.stats.appearances + (p.stats.appearances === 1 ? " app" : " apps")];
    if (p.stats.goals != null) parts.push(p.stats.goals + (p.stats.goals === 1 ? " goal" : " goals"));
    if (p.stats.yellowCards) parts.push(p.stats.yellowCards + " YC");
    if (p.stats.redCards) parts.push(p.stats.redCards + " RC");
    return '<span class="player-stats">' + parts.join(" &middot; ") + '</span>';
  }

  function squadListHTML(season) {
    var starters = (season.squad || []).filter(function (p) { return p.isStartingXI; });
    var bench = (season.squad || []).filter(function (p) { return !p.isStartingXI; });

    function listItems(players) {
      if (players.length === 0) return '<li class="empty-row">None recorded</li>';
      return players.map(function (p) {
        var newTag = isNewSignee(p, season) ? '<span class="new-badge" title="First season this player appears in the app\'s records">New</span>' : '';
        return '<li>' +
          '<div class="squad-row-top">' +
            '<span><span class="num">' + (p.shirtNumber != null ? p.shirtNumber : "&ndash;") + '</span>' + escapeHTML(p.name) + newTag + '</span>' +
            '<span class="pos">' + escapeHTML(p.positionDetail || p.position || "") + '</span>' +
          '</div>' +
          (p.stats ? '<div class="squad-row-stats">' + statsLine(p) + '</div>' : '') +
        '</li>';
      }).join("");
    }

    return (
      '<div class="squad-columns">' +
        '<div>' +
          '<p class="squad-subheading">Starting XI</p>' +
          '<ul class="squad-list">' + listItems(starters) + '</ul>' +
        '</div>' +
        '<div>' +
          '<p class="squad-subheading">Squad / Bench</p>' +
          '<ul class="squad-list">' + listItems(bench) + '</ul>' +
        '</div>' +
      '</div>'
    );
  }

  function escapeHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ================= Kit thumbnails row =================

  var KIT_TYPE_ORDER = { home: 0, away: 1, third: 2 };
  function kitTypeOrder(t) {
    return Object.prototype.hasOwnProperty.call(KIT_TYPE_ORDER, t) ? KIT_TYPE_ORDER[t] : 9;
  }

  function kitThumbHTML(season, kit) {
    var owned = isOwned(kit, season.startYear);
    var key = kitKey(season.startYear, kit.kitType);
    var override = kitImageCache[key];
    var displaySrc = override ? override.url : kit.image;

    return (
      '<div class="kit-thumb' + (owned ? ' owned' : '') + '">' +
        '<div class="kit-thumb-photo" data-lightbox="1" data-src="' + displaySrc + '" data-caption="' + escapeHTML(season.label) + ' &middot; ' + escapeHTML(kit.kitType) + '">' +
          '<img src="' + displaySrc + '" alt="' + escapeHTML(season.label) + ' ' + kit.kitType + ' kit" loading="lazy">' +
          '<span class="kit-type-tag">' + kit.kitType + '</span>' +
          (owned ? '<span class="owned-badge">Owned</span>' : '') +
          (override ? '<span class="custom-badge">Custom</span>' : '') +
        '</div>' +
        '<p class="kit-thumb-meta">' + escapeHTML(kit.brand) + '<br><span class="sponsor">' + escapeHTML(kit.sponsor || "No sponsor") + '</span></p>' +
        (READONLY ? '' :
          '<div class="kit-thumb-imgactions">' +
            '<label class="btn-mini">Replace<input type="file" accept="image/*" class="kit-image-input" data-start-year="' + season.startYear + '" data-kit-type="' + kit.kitType + '" hidden></label>' +
            (override ? '<button class="btn-mini btn-remove-kit-image" data-start-year="' + season.startYear + '" data-kit-type="' + kit.kitType + '">Reset</button>' : '') +
          '</div>'
        ) +
        (READONLY ? '' :
          '<button class="owned-toggle' + (owned ? ' is-owned' : '') + '" data-kit-type="' + kit.kitType + '" data-start-year="' + season.startYear + '">' +
            (owned ? "In collection" : "Mark as owned") +
          '</button>'
        ) +
      '</div>'
    );
  }

  // ================= Team photo block =================

  function teamPhotoHTML(season) {
    var override = teamPhotoCache[season.startYear];
    var src = override ? override.url : season.teamPhoto;

    if (src) {
      var caption = escapeHTML(season.label) + ' team photo';
      return (
        '<div class="team-photo-box has-photo" data-start-year="' + season.startYear + '">' +
          '<img src="' + src + '" alt="' + caption + '" class="team-photo-img" data-lightbox="1" data-src="' + src + '" data-caption="' + caption + '">' +
          (override ? '<span class="custom-badge">Custom</span>' : '') +
          (READONLY ? '' :
            '<div class="team-photo-actions">' +
              '<label class="btn-mini">Replace<input type="file" accept="image/*" class="team-photo-input" data-start-year="' + season.startYear + '" hidden></label>' +
              (override ? '<button class="btn-mini btn-remove-photo" data-start-year="' + season.startYear + '">Reset</button>' : '') +
            '</div>'
          ) +
        '</div>'
      );
    }
    if (READONLY) {
      return '<div class="team-photo-box empty"><span class="no-photo-label">No team photo</span></div>';
    }
    return (
      '<div class="team-photo-box empty" data-start-year="' + season.startYear + '">' +
        '<label class="upload-prompt">' +
          '<span class="upload-icon">+</span>' +
          '<span>Add team photo</span>' +
          '<input type="file" accept="image/*" class="team-photo-input" data-start-year="' + season.startYear + '" hidden>' +
        '</label>' +
      '</div>'
    );
  }

  // ================= Season section =================

  function seasonSectionHTML(season) {
    var trophiesHTML = (season.trophies && season.trophies.length)
      ? '<div class="season-trophies">' + season.trophies.map(function (t) { return '<span class="trophy-pill">' + escapeHTML(t) + '</span>'; }).join("") + '</div>'
      : '<div class="season-trophies"><span class="trophy-pill trophy-none">No trophies</span></div>';

    var kits = season.kits.slice().sort(function (a, b) { return kitTypeOrder(a.kitType) - kitTypeOrder(b.kitType); });
    var kitsHTML = '<div class="kits-row">' + kits.map(function (k) { return kitThumbHTML(season, k); }).join("") + '</div>';

    return (
      '<section class="season-section" id="season-' + season.startYear + '" data-start-year="' + season.startYear + '">' +
        '<div class="season-head">' +
          '<div class="season-head-main">' +
            '<h2 class="season-title">' + escapeHTML(season.label) + '</h2>' +
            '<p class="season-manager">Manager: ' + escapeHTML(season.manager || "Unknown") + ' &middot; Formation: ' + escapeHTML(season.formation || "-") + '</p>' +
            (season.notes ? '<p class="season-notes">' + escapeHTML(season.notes) + '</p>' : '') +
          '</div>' +
          trophiesHTML +
        '</div>' +

        '<div class="season-body">' +
          '<div class="kits-panel">' +
            '<h3 class="panel-label">Kits</h3>' +
            kitsHTML +
          '</div>' +
        '</div>' +

        '<div class="season-squad">' +
          '<button class="squad-toggle" data-start-year="' + season.startYear + '" aria-expanded="false">' +
            '<span class="squad-toggle-label">Show Team Photo, Starting XI &amp; Full Squad</span>' +
            '<span class="squad-toggle-icon">&#9662;</span>' +
          '</button>' +
          '<div class="squad-collapsible" hidden>' +
            '<h3 class="panel-label">Team Photo</h3>' +
            teamPhotoHTML(season) +
            '<h3 class="panel-label">Starting XI</h3>' +
            pitchHTML(season) +
            '<h3 class="panel-label">Full Squad</h3>' +
            squadListHTML(season) +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  // ================= Render =================

  var container = document.getElementById("seasonsContainer");
  var resultsCount = document.getElementById("resultsCount");

  function render() {
    var filtered = currentFiltered();
    resultsCount.textContent = filtered.length + " season" + (filtered.length === 1 ? "" : "s") + " shown";
    if (filtered.length === 0) {
      container.innerHTML = '<p class="no-results">No seasons match those filters.</p>';
      return;
    }
    container.innerHTML = filtered.map(seasonSectionHTML).join("");
    wireSection(container);
  }

  function findSectionEl(startYear) {
    return container.querySelector("#season-" + startYear);
  }

  function refreshSection(startYear) {
    var season = KIT_DATA.find(function (s) { return s.startYear === startYear; });
    var oldEl = findSectionEl(startYear);
    if (!season || !oldEl) return;
    var wrapper = document.createElement("div");
    wrapper.innerHTML = seasonSectionHTML(season);
    var newEl = wrapper.firstElementChild;
    oldEl.replaceWith(newEl);
    wireSection(newEl);
  }

  function wireSection(root) {
    Array.from(root.querySelectorAll(".squad-toggle")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var panel = btn.nextElementSibling;
        var isHidden = panel.hasAttribute("hidden");
        if (isHidden) {
          panel.removeAttribute("hidden");
          btn.setAttribute("aria-expanded", "true");
          btn.querySelector(".squad-toggle-label").textContent = "Hide Team Photo, Starting XI & Full Squad";
          btn.querySelector(".squad-toggle-icon").innerHTML = "&#9652;";
        } else {
          panel.setAttribute("hidden", "");
          btn.setAttribute("aria-expanded", "false");
          btn.querySelector(".squad-toggle-label").textContent = "Show Team Photo, Starting XI & Full Squad";
          btn.querySelector(".squad-toggle-icon").innerHTML = "&#9662;";
        }
      });
    });

    Array.from(root.querySelectorAll(".owned-toggle")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kitType = btn.getAttribute("data-kit-type");
        var sy = parseInt(btn.getAttribute("data-start-year"), 10);
        var season = KIT_DATA.find(function (s) { return s.startYear === sy; });
        var kit = season.kits.find(function (k) { return k.kitType === kitType; });
        toggleOwned(kit, sy);
        refreshSection(sy);
        renderStats();
      });
    });

    Array.from(root.querySelectorAll(".team-photo-input")).forEach(function (input) {
      input.addEventListener("change", function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var startYear = parseInt(input.getAttribute("data-start-year"), 10);
        idbPut(TEAM_PHOTO_STORE, startYear, file).then(function () {
          if (teamPhotoCache[startYear]) URL.revokeObjectURL(teamPhotoCache[startYear].url);
          teamPhotoCache[startYear] = { blob: file, url: URL.createObjectURL(file) };
          refreshSection(startYear);
        });
      });
    });

    Array.from(root.querySelectorAll(".btn-remove-photo")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var startYear = parseInt(btn.getAttribute("data-start-year"), 10);
        idbDelete(TEAM_PHOTO_STORE, startYear).then(function () {
          if (teamPhotoCache[startYear]) URL.revokeObjectURL(teamPhotoCache[startYear].url);
          delete teamPhotoCache[startYear];
          refreshSection(startYear);
        });
      });
    });

    Array.from(root.querySelectorAll(".kit-image-input")).forEach(function (input) {
      input.addEventListener("change", function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var startYear = parseInt(input.getAttribute("data-start-year"), 10);
        var kitType = input.getAttribute("data-kit-type");
        var key = kitKey(startYear, kitType);
        idbPut(KIT_IMAGE_STORE, key, file).then(function () {
          if (kitImageCache[key]) URL.revokeObjectURL(kitImageCache[key].url);
          kitImageCache[key] = { blob: file, url: URL.createObjectURL(file) };
          refreshSection(startYear);
        });
      });
    });

    Array.from(root.querySelectorAll(".btn-remove-kit-image")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var startYear = parseInt(btn.getAttribute("data-start-year"), 10);
        var kitType = btn.getAttribute("data-kit-type");
        var key = kitKey(startYear, kitType);
        idbDelete(KIT_IMAGE_STORE, key).then(function () {
          if (kitImageCache[key]) URL.revokeObjectURL(kitImageCache[key].url);
          delete kitImageCache[key];
          refreshSection(startYear);
        });
      });
    });

    Array.from(root.querySelectorAll('[data-lightbox="1"]')).forEach(function (el) {
      el.addEventListener("click", function () {
        openLightbox(el.getAttribute("data-src"), el.getAttribute("data-caption"));
      });
    });
  }

  [els.search, els.brand, els.sponsor, els.manager, els.trophy, els.kitType, els.ownedOnly].forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });

  els.clear.addEventListener("click", function () {
    els.search.value = "";
    els.brand.value = "";
    els.sponsor.value = "";
    els.manager.value = "";
    els.trophy.value = "";
    els.kitType.value = "";
    els.ownedOnly.checked = false;
    render();
  });

  // ================= Lightbox =================

  var lightboxBackdrop = document.getElementById("lightboxBackdrop");
  var lightboxImg = document.getElementById("lightboxImg");
  var lightboxCaption = document.getElementById("lightboxCaption");

  function openLightbox(src, caption) {
    lightboxImg.src = src;
    lightboxCaption.textContent = caption || "";
    lightboxBackdrop.classList.add("open");
  }
  function closeLightbox() {
    lightboxBackdrop.classList.remove("open");
    lightboxImg.src = "";
  }
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  lightboxBackdrop.addEventListener("click", function (e) {
    if (e.target === lightboxBackdrop) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLightbox();
  });

  // ================= Export / Import =================

  document.getElementById("exportBtn").addEventListener("click", function () {
    var photoKeys = Object.keys(teamPhotoCache);
    var kitImageKeys = Object.keys(kitImageCache);

    Promise.all([
      Promise.all(photoKeys.map(function (sy) {
        return blobToDataURL(teamPhotoCache[sy].blob).then(function (dataURL) { return [sy, dataURL]; });
      })),
      Promise.all(kitImageKeys.map(function (k) {
        return blobToDataURL(kitImageCache[k].blob).then(function (dataURL) { return [k, dataURL]; });
      }))
    ]).then(function (results) {
      var teamPhotos = {};
      results[0].forEach(function (p) { teamPhotos[p[0]] = p[1]; });
      var kitImages = {};
      results[1].forEach(function (p) { kitImages[p[0]] = p[1]; });

      var payload = { collection: overrides, teamPhotos: teamPhotos, kitImages: kitImages };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "my-uni-kit-collection-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  document.getElementById("importInput").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var imported = JSON.parse(reader.result);
        var importedCollection = imported.collection || imported; // back-compat with old export format
        overrides = Object.assign({}, overrides, importedCollection);
        saveOverrides(overrides);

        var importedPhotos = imported.teamPhotos || {};
        var importedKitImages = imported.kitImages || {};

        var photoPromises = Object.keys(importedPhotos).map(function (sy) {
          return dataURLToBlob(importedPhotos[sy]).then(function (blob) {
            return idbPut(TEAM_PHOTO_STORE, parseInt(sy, 10), blob).then(function () {
              if (teamPhotoCache[sy]) URL.revokeObjectURL(teamPhotoCache[sy].url);
              teamPhotoCache[sy] = { blob: blob, url: URL.createObjectURL(blob) };
            });
          });
        });

        var kitImagePromises = Object.keys(importedKitImages).map(function (key) {
          return dataURLToBlob(importedKitImages[key]).then(function (blob) {
            return idbPut(KIT_IMAGE_STORE, key, blob).then(function () {
              if (kitImageCache[key]) URL.revokeObjectURL(kitImageCache[key].url);
              kitImageCache[key] = { blob: blob, url: URL.createObjectURL(blob) };
            });
          });
        });

        Promise.all(photoPromises.concat(kitImagePromises)).then(function () {
          render();
          renderStats();
          alert("Collection imported.");
        });
      } catch (err) {
        alert("Could not read that file as a valid collection export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // ================= Read-only mode UI =================

  if (READONLY) {
    document.getElementById("readonlyBanner").hidden = false;
    document.getElementById("footerActions").hidden = true;
    document.getElementById("footerNote").textContent = "You're viewing a read-only shared collection. Nothing here can be changed from this link.";
  } else {
    document.getElementById("copyReadonlyBtn").addEventListener("click", function () {
      var url = new URL(window.location.href);
      url.search = "?readonly=1";
      url.hash = "";
      var link = url.toString();
      var btn = document.getElementById("copyReadonlyBtn");
      var resetLabel = function () { btn.textContent = "Copy read-only link"; };
      function fallbackPrompt() { window.prompt("Copy this read-only link:", link); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(function () {
          btn.textContent = "Link copied!";
          setTimeout(resetLabel, 2000);
        }).catch(fallbackPrompt);
      } else {
        fallbackPrompt();
      }
    });
  }

  // ================= Init =================

  renderStats();
  render();

  Promise.all([
    loadAllFromStore(TEAM_PHOTO_STORE),
    loadAllFromStore(KIT_IMAGE_STORE)
  ]).then(function (results) {
    teamPhotoCache = results[0];
    kitImageCache = results[1];
    render();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
