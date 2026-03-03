(function () {
  "use strict";

  var baseurl = window.GameClub ? window.GameClub.baseurl : "";
  var map;
  var search;
  var debounceTimer;

  function init() {
    map = window.GameClubMap.init();

    fetch(baseurl + "/api/clubs.json")
      .then(function (res) {
        return res.json();
      })
      .then(function (clubs) {
        search = window.GameClubSearch.init(clubs);
        restoreFromUrl();
        update();
        bindEvents();
      })
      .catch(function (err) {
        console.error("Failed to load clubs:", err);
      });
  }

  function restoreFromUrl() {
    var params = readUrlParams();
    var searchInput = document.getElementById("search-input");
    var searchInputMobile = document.getElementById("search-input-mobile");
    var distanceFilter = document.getElementById("distance-filter");

    if (params.q) {
      search.setQuery(params.q);
      if (searchInput) searchInput.value = params.q;
      if (searchInputMobile) searchInputMobile.value = params.q;
    }
    if (params.type && params.type.length > 0) {
      search.setTypeFilters(params.type);
      var typeCheckboxes = document.querySelectorAll("#type-filter input[type='checkbox']");
      for (var i = 0; i < typeCheckboxes.length; i++) {
        if (params.type.indexOf(typeCheckboxes[i].value) !== -1) {
          typeCheckboxes[i].checked = true;
        }
      }
      updateTypeFilterLabel();
    }
    if (params.days && params.days.length > 0) {
      search.setDayFilters(params.days);
      // Check matching checkboxes in multi-select
      var checkboxes = document.querySelectorAll("#day-filter input[type='checkbox']");
      for (var i = 0; i < checkboxes.length; i++) {
        if (params.days.indexOf(checkboxes[i].value) !== -1) {
          checkboxes[i].checked = true;
        }
      }
      updateDayFilterLabel();
    }
    if (params.distance) {
      search.setMaxDistance(params.distance);
      if (distanceFilter) distanceFilter.value = params.distance;
    }
  }

  function readUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var daysStr = params.get("days") || "";
    // Backward compat: support old ?day= single param
    if (!daysStr) {
      var singleDay = params.get("day") || "";
      if (singleDay) daysStr = singleDay;
    }
    var days = daysStr ? daysStr.split(",").filter(function (d) { return d; }) : [];
    var typeStr = params.get("type") || "";
    var types = typeStr ? typeStr.split(",").filter(function (t) { return t; }) : [];
    return {
      q: params.get("q") || "",
      days: days,
      type: types,
      distance: params.get("distance") || ""
    };
  }

  function writeUrlParams() {
    var searchInput = document.getElementById("search-input");
    var distanceFilter = document.getElementById("distance-filter");

    var params = new URLSearchParams();
    var q = searchInput ? searchInput.value.trim() : "";
    var days = search.dayFilters.join(",");
    var types = search.typeFilters.join(",");
    var distance = distanceFilter ? distanceFilter.value : "";

    if (q) params.set("q", q);
    if (types) params.set("type", types);
    if (days) params.set("days", days);
    if (distance) params.set("distance", distance);

    var newUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    history.replaceState(null, "", newUrl);
  }

  function update() {
    var filtered = search.getFiltered();
    map.addClubs(filtered);
    // Skip fitToMarkers when user location is active — showUserLocation already
    // sets appropriate bounds that include the user marker.
    if (!map.userMarker) {
      map.fitToMarkers();
    }
    renderCards(filtered);
    updateResultCount(filtered.length, search.allClubs.length);
    writeUrlParams();
  }

  function renderCards(clubs) {
    var container = document.getElementById("club-list");
    if (!container) return;

    if (clubs.length === 0) {
      container.innerHTML =
        '<p style="color:#555;text-align:center;padding:2rem 0;">No clubs match your search. Try a different filter or search term.</p>';
      return;
    }

    var html = clubs
      .map(function (club) {
        var tags = "";
        var clubTypes = club.type || ["Board Games"];
        clubTypes.forEach(function (t) {
          var cls = "tag tag-type tag-type-" + t.toLowerCase().replace(/ /g, "-");
          tags += '<span class="' + cls + '">' + escapeHtml(t) + "</span>";
        });

        if (club.cost) {
          tags += '<span class="tag tag-cost">' + escapeHtml(club.cost) + "</span>";
        }

        var distanceBadge = "";
        if (club._distance !== undefined) {
          distanceBadge =
            '<span class="club-distance">' +
            club._distance.toFixed(1) +
            " mi</span>";
        }

        var icon = "";
        if (club.image) {
          var imgSrc = club.image.indexOf("://") !== -1
            ? escapeHtml(club.image)
            : baseurl + "/assets/images/clubs/" + encodeURIComponent(club.image);
          icon = '<div class="club-icon-wrap"><img src="' + imgSrc + '" alt="" loading="lazy" onload="window.GameClub.applyImgBg(this)"></div>';
        }

        var venue = club.location && club.location.name
          ? '<div class="club-venue"><i data-lucide="map-pin"></i><span>' + escapeHtml(club.location.name) + "</span></div>"
          : "";

        var daysText = club.days.join(", ");
        if (club.frequency && club.frequency !== "Weekly") {
          daysText += " \u00b7 " + club.frequency;
        }
        var daysLine = '<div class="club-days"><i data-lucide="calendar"></i><span>' + escapeHtml(daysText) + "</span></div>";

        var meta = '<div class="club-card-meta">' + venue + daysLine + "</div>";

        return (
          '<a class="club-card" href="' +
          escapeHtml(club.url) +
          '">' +
          '<div class="club-card-body">' +
          icon +
          '<div class="club-card-content">' +
          '<div class="club-card-header">' +
          '<div class="club-name">' +
          escapeHtml(club.name) +
          "</div>" +
          distanceBadge +
          "</div>" +
          meta +
          "</div>" +
          "</div>" +
          '<div class="club-tags">' +
          tags +
          "</div>" +
          "</a>"
        );
      })
      .join("");

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  function updateResultCount(shown, total) {
    var el = document.getElementById("result-count");
    if (!el) return;

    var text;
    if (shown === total) {
      text = "Showing " + total + " clubs";
    } else {
      text = "Showing " + shown + " of " + total + " clubs";
    }

    var locationLabel = window.GameClubLocation && window.GameClubLocation.getActiveLabel
      ? window.GameClubLocation.getActiveLabel()
      : null;

    if (locationLabel) {
      text += " \u00b7 sorted by nearest to " + locationLabel;
    }

    el.textContent = text;
  }

  function updateDayFilterLabel() {
    var label = document.querySelector("#day-filter .multi-select-label");
    if (!label) return;
    var days = search.dayFilters;
    if (days.length === 0) {
      label.textContent = "All days";
    } else if (days.length === 1) {
      label.textContent = days[0];
    } else {
      label.textContent = days.length + " days selected";
    }
  }

  function updateTypeFilterLabel() {
    var label = document.querySelector("#type-filter .multi-select-label");
    if (!label) return;
    var types = search.typeFilters;
    if (types.length === 0) {
      label.textContent = "All types";
    } else if (types.length === 1) {
      label.textContent = types[0];
    } else {
      label.textContent = types.length + " types selected";
    }
  }

  function bindEvents() {
    var searchInput = document.getElementById("search-input");
    var searchInputMobile = document.getElementById("search-input-mobile");
    var typeFilterEl = document.getElementById("type-filter");
    var typeToggle = typeFilterEl ? typeFilterEl.querySelector(".multi-select-toggle") : null;
    var typeCheckboxes = typeFilterEl ? typeFilterEl.querySelectorAll("input[type='checkbox']") : [];
    var dayFilterEl = document.getElementById("day-filter");
    var dayToggle = dayFilterEl ? dayFilterEl.querySelector(".multi-select-toggle") : null;
    var dayCheckboxes = dayFilterEl ? dayFilterEl.querySelectorAll("input[type='checkbox']") : [];
    var distanceFilter = document.getElementById("distance-filter");

    // Sync both search inputs
    function onSearchInput(source, other) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        if (other) other.value = source.value;
        search.setQuery(source.value);
        update();
      }, 200);
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        onSearchInput(searchInput, searchInputMobile);
      });
    }
    if (searchInputMobile) {
      searchInputMobile.addEventListener("input", function () {
        onSearchInput(searchInputMobile, searchInput);
      });
    }

    // Type filter multi-select dropdown
    if (typeToggle) {
      typeToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        // Close day dropdown
        if (dayFilterEl) {
          dayFilterEl.classList.remove("is-open");
          if (dayToggle) dayToggle.setAttribute("aria-expanded", "false");
        }
        var isOpen = typeFilterEl.classList.toggle("is-open");
        typeToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
    }

    for (var t = 0; t < typeCheckboxes.length; t++) {
      typeCheckboxes[t].addEventListener("change", function () {
        search.toggleTypeFilter(this.value);
        updateTypeFilterLabel();
        update();
      });
    }

    // Day filter multi-select dropdown
    if (dayToggle) {
      dayToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        // Close type dropdown
        if (typeFilterEl) {
          typeFilterEl.classList.remove("is-open");
          if (typeToggle) typeToggle.setAttribute("aria-expanded", "false");
        }
        var isOpen = dayFilterEl.classList.toggle("is-open");
        dayToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
    }

    for (var i = 0; i < dayCheckboxes.length; i++) {
      dayCheckboxes[i].addEventListener("change", function () {
        search.toggleDayFilter(this.value);
        updateDayFilterLabel();
        update();
      });
    }

    // Close dropdowns when clicking outside
    document.addEventListener("click", function (e) {
      if (typeFilterEl && !typeFilterEl.contains(e.target)) {
        typeFilterEl.classList.remove("is-open");
        if (typeToggle) typeToggle.setAttribute("aria-expanded", "false");
      }
      if (dayFilterEl && !dayFilterEl.contains(e.target)) {
        dayFilterEl.classList.remove("is-open");
        if (dayToggle) dayToggle.setAttribute("aria-expanded", "false");
      }
    });

    // Distance filter
    if (distanceFilter) {
      distanceFilter.addEventListener("change", function () {
        search.setMaxDistance(distanceFilter.value);
        update();
      });
    }

    // Location autocomplete + geolocation
    window.GameClubLocation.init(
      function (lat, lng, label) {
        // Clear text search when a location is selected via postcode
        search.setQuery("");
        if (searchInput) searchInput.value = "";
        if (searchInputMobile) searchInputMobile.value = "";
        search.setUserLocation(lat, lng);
        map.showUserLocation(lat, lng);
        // Enable distance filter
        if (distanceFilter) distanceFilter.disabled = false;
        update();
      },
      function () {
        search.clearUserLocation();
        search.setMaxDistance(0);
        map.removeUserLocation();
        // Reset and disable distance filter
        if (distanceFilter) {
          distanceFilter.value = "";
          distanceFilter.disabled = true;
        }
        update();
      }
    );
  }

  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  // Toggle shadow on filter bar when sidebar is scrolled
  function initSidebarScroll() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.addEventListener("scroll", function () {
      sidebar.classList.toggle("sidebar--scrolled", sidebar.scrollTop > 0);
    });
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
      initSidebarScroll();
    });
  } else {
    init();
    initSidebarScroll();
  }
})();
