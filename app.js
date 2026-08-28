(function () {
  "use strict";

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

  // ---------- Flatten data ----------

  var flatKits = [];
  KIT_DATA.forEach(function (season) {
    season.kits.forEach(function (kit) {
      flatKits.push({
        season: season,
        kit: kit
      });
    });
  });

  // ---------- Populate filters ----------

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

  // ---------- Stats bar ----------

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

  // ---------- Filtering ----------

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

  function matchesFilters(fk) {
    var season = fk.season, kit = fk.kit;

    if (els.brand.value && kit.brand !== els.brand.value) return false;
    if (els.sponsor.value && kit.sponsor !== els.sponsor.value) return false;
    if (els.manager.value && season.manager !== els.manager.value) return false;
    if (els.trophy.value && (season.trophies || []).indexOf(els.trophy.value) === -1) return false;
    if (els.kitType.value && kit.kitType !== els.kitType.value) return false;
    if (els.ownedOnly.checked && !isOwned(kit, season.startYear)) return false;

    var q = els.search.value.trim().toLowerCase();
    if (q) {
      var haystack = [
        season.label,
        season.manager,
        kit.brand,
        kit.sponsor,
        kit.kitType
      ].join(" ").toLowerCase();
      var playerMatch = (season.squad || []).some(function (p) {
        return p.name.toLowerCase().indexOf(q) !== -1;
      });
      if (haystack.indexOf(q) === -1 && !playerMatch) return false;
    }

    return true;
  }

  function currentFiltered() {
    return flatKits.filter(matchesFilters);
  }

  // ---------- Render grid ----------

  var grid = document.getElementById("kitGrid");
  var resultsCount = document.getElementById("resultsCount");

  function kitCardHTML(fk) {
    var season = fk.season, kit = fk.kit;
    var owned = isOwned(kit, season.startYear);
    return (
      '<article class="kit-card' + (owned ? ' owned' : '') + '" data-start-year="' + season.startYear + '">' +
        '<div class="kit-card-photo">' +
          '<img src="' + kit.image + '" alt="' + season.label + ' ' + kit.kitType + ' kit" loading="lazy">' +
          '<span class="kit-type-tag">' + kit.kitType + '</span>' +
          (owned ? '<span class="owned-badge">Owned</span>' : '') +
        '</div>' +
        '<div class="kit-card-perf"></div>' +
        '<div class="kit-card-info">' +
          '<p class="kit-card-season">' + season.label + '</p>' +
          '<p class="kit-card-meta">' + kit.brand + ' &middot; <span class="sponsor">' + (kit.sponsor || "No sponsor") + '</span></p>' +
        '</div>' +
      '</article>'
    );
  }

  function renderGrid() {
    var filtered = currentFiltered();
    resultsCount.textContent = filtered.length + " kit" + (filtered.length === 1 ? "" : "s") + " shown";
    if (filtered.length === 0) {
      grid.innerHTML = '<p class="no-results">No kits match those filters.</p>';
      return;
    }
    grid.innerHTML = filtered.map(kitCardHTML).join("");
    Array.from(grid.querySelectorAll(".kit-card")).forEach(function (card) {
      card.addEventListener("click", function () {
        openSeasonModal(parseInt(card.getAttribute("data-start-year"), 10));
      });
    });
  }

  [els.search, els.brand, els.sponsor, els.manager, els.trophy, els.kitType, els.ownedOnly].forEach(function (el) {
    el.addEventListener("input", renderGrid);
    el.addEventListener("change", renderGrid);
  });

  els.clear.addEventListener("click", function () {
    els.search.value = "";
    els.brand.value = "";
    els.sponsor.value = "";
    els.manager.value = "";
    els.trophy.value = "";
    els.kitType.value = "";
    els.ownedOnly.checked = false;
    renderGrid();
  });

  // ---------- Formation pitch ----------

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
    starters.forEach(function (p) {
      byCat[cat(p.position)].push(p);
    });
    ["GK", "DEF", "MID", "FWD"].forEach(function (c) {
      byCat[c].sort(function (a, b) {
        var an = a.shirtNumber == null ? 999 : a.shirtNumber;
        var bn = b.shirtNumber == null ? 999 : b.shirtNumber;
        return an - bn;
      });
    });

    var rowsSpec = (season.formation || "4-4-2").split("-").map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
    if (rowsSpec.length === 0) rowsSpec = [4, 4, 2];

    var midRowCount = rowsSpec.length - 2; // rows between DEF (first) and FWD (last)
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
    // total rows including GK
    var totalLines = rows.length + 1;
    var layout = [];

    // GK row at bottom
    layout.push({ y: 90, players: byCat.GK.slice(0, 1) });

    rows.forEach(function (rowPlayers, idx) {
      var y = 90 - ((idx + 1) * (78 / rows.length));
      layout.push({ y: Math.max(y, 8), players: rowPlayers });
    });

    return layout;
  }

  function pitchHTML(season) {
    var layout = buildFormationLayout(season);
    var html = '<div class="pitch-wrap">';
    layout.forEach(function (row) {
      var count = row.players.length;
      if (count === 0) return;
      row.players.forEach(function (p, idx) {
        var x = count === 1 ? 50 : 12 + (idx * (76 / (count - 1)));
        var num = p.shirtNumber != null ? p.shirtNumber : "-";
        html += '<div class="pitch-player" style="top:' + row.y + '%; left:' + x + '%;">' +
                  '<div class="pitch-jersey">' + num + '</div>' +
                  '<div class="pitch-player-name">' + p.name + '</div>' +
                '</div>';
      });
    });
    html += '</div>';
    return html;
  }

  // ---------- Squad list ----------

  function squadListHTML(season) {
    var starters = (season.squad || []).filter(function (p) { return p.isStartingXI; });
    var bench = (season.squad || []).filter(function (p) { return !p.isStartingXI; });

    function listItems(players) {
      return players.map(function (p) {
        return '<li><span><span class="num">' + (p.shirtNumber != null ? p.shirtNumber : "&ndash;") + '</span>' + p.name + '</span><span class="pos">' + p.position + '</span></li>';
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

  // ---------- Modal ----------

  var backdrop = document.getElementById("modalBackdrop");
  var modalContent = document.getElementById("modalContent");
  var modalClose = document.getElementById("modalClose");

  function openSeasonModal(startYear) {
    var season = KIT_DATA.find(function (s) { return s.startYear === startYear; });
    if (!season) return;

    var trophiesHTML = (season.trophies && season.trophies.length)
      ? '<div class="modal-trophies">' + season.trophies.map(function (t) { return '<span class="trophy-pill">' + t + '</span>'; }).join("") + '</div>'
      : '';

    var kitsHTML = '<div class="modal-kits-row">' + season.kits.map(function (kit) {
      var owned = isOwned(kit, season.startYear);
      return (
        '<div class="modal-kit-card' + (owned ? ' owned' : '') + '">' +
          '<img src="' + kit.image + '" alt="' + season.label + ' ' + kit.kitType + '">' +
          '<div class="modal-kit-card-body">' +
            '<div class="type-label">' + kit.kitType + ' &middot; ' + kit.brand + '</div>' +
            '<button class="owned-toggle' + (owned ? ' is-owned' : '') + '" data-kit-type="' + kit.kitType + '" data-start-year="' + season.startYear + '">' +
              (owned ? "In collection" : "Mark as owned") +
            '</button>' +
          '</div>' +
        '</div>'
      );
    }).join("") + '</div>';

    modalContent.innerHTML =
      '<div class="modal-header">' +
        '<h2 class="modal-season-label">' + season.label + '</h2>' +
        '<p class="modal-manager">Manager: ' + (season.manager || "Unknown") + ' &middot; Formation: ' + (season.formation || "-") + '</p>' +
        trophiesHTML +
        (season.notes ? '<p class="modal-notes">' + season.notes + '</p>' : '') +
      '</div>' +
      '<h3 class="modal-section-title">Kits</h3>' +
      kitsHTML +
      '<h3 class="modal-section-title">Starting XI</h3>' +
      pitchHTML(season) +
      '<h3 class="modal-section-title">Full Squad</h3>' +
      squadListHTML(season);

    Array.from(modalContent.querySelectorAll(".owned-toggle")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kitType = btn.getAttribute("data-kit-type");
        var sy = parseInt(btn.getAttribute("data-start-year"), 10);
        var kit = season.kits.find(function (k) { return k.kitType === kitType; });
        var nowOwned = toggleOwned(kit, sy);
        btn.classList.toggle("is-owned", nowOwned);
        btn.textContent = nowOwned ? "In collection" : "Mark as owned";
        btn.closest(".modal-kit-card").classList.toggle("owned", nowOwned);
        renderGrid();
        renderStats();
      });
    });

    backdrop.classList.add("open");
  }

  function closeModal() {
    backdrop.classList.remove("open");
  }

  modalClose.addEventListener("click", closeModal);
  backdrop.addEventListener("click", function (e) {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  // ---------- Export / Import ----------

  document.getElementById("exportBtn").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(overrides, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "my-uni-kit-collection-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  document.getElementById("importInput").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var imported = JSON.parse(reader.result);
        overrides = Object.assign({}, overrides, imported);
        saveOverrides(overrides);
        renderGrid();
        renderStats();
        alert("Collection imported.");
      } catch (err) {
        alert("Could not read that file as a valid collection export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // ---------- Init ----------

  renderStats();
  renderGrid();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
