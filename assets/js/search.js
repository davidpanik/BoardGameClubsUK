(function () {
  "use strict";

  var GameClubSearch = {
    allClubs: [],
    searchQuery: "",
    dayFilters: [],
    typeFilters: [],
    maxDistance: 0,
    userLat: null,
    userLng: null,

    init: function (clubs) {
      this.allClubs = clubs;
      return this;
    },

    setQuery: function (query) {
      this.searchQuery = query.toLowerCase().trim();
    },

    setDayFilters: function (days) {
      this.dayFilters = days || [];
    },

    toggleDayFilter: function (day) {
      var idx = this.dayFilters.indexOf(day);
      if (idx === -1) {
        this.dayFilters.push(day);
      } else {
        this.dayFilters.splice(idx, 1);
      }
    },

    setTypeFilters: function (types) {
      this.typeFilters = types || [];
    },

    toggleTypeFilter: function (type) {
      var idx = this.typeFilters.indexOf(type);
      if (idx === -1) {
        this.typeFilters.push(type);
      } else {
        this.typeFilters.splice(idx, 1);
      }
    },

    setMaxDistance: function (miles) {
      this.maxDistance = miles ? parseFloat(miles) : 0;
    },

    setUserLocation: function (lat, lng) {
      this.userLat = lat;
      this.userLng = lng;
    },

    clearUserLocation: function () {
      this.userLat = null;
      this.userLng = null;
      this.allClubs.forEach(function (club) {
        delete club._distance;
      });
    },

    getFiltered: function () {
      var self = this;

      // Compute distances first if location is set (needed for distance filter)
      if (self.userLat !== null && self.userLng !== null) {
        self.allClubs.forEach(function (club) {
          club._distance = self.haversine(
            self.userLat,
            self.userLng,
            club.location.lat,
            club.location.lng
          );
        });
      }

      var results = this.allClubs.filter(function (club) {
        // Text search
        if (self.searchQuery) {
          var haystack = [
            club.name,
            club.location.name,
            club.location.address,
            club.description,
            club.days.join(" "),
            (club.type || []).join(" "),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (haystack.indexOf(self.searchQuery) === -1) return false;
        }

        // Type filter (OR logic: club passes if it matches any selected type)
        if (self.typeFilters.length > 0) {
          var clubTypes = club.type || ["Board Games"];
          var matchesType = false;
          for (var t = 0; t < self.typeFilters.length; t++) {
            if (clubTypes.indexOf(self.typeFilters[t]) !== -1) {
              matchesType = true;
              break;
            }
          }
          if (!matchesType) return false;
        }

        // Day filter (OR logic: club passes if it matches any selected day)
        if (self.dayFilters.length > 0) {
          var matchesDay = false;
          for (var i = 0; i < self.dayFilters.length; i++) {
            if (club.days.indexOf(self.dayFilters[i]) !== -1) {
              matchesDay = true;
              break;
            }
          }
          if (!matchesDay) return false;
        }

        // Distance filter (only when location is set)
        if (self.maxDistance > 0 && club._distance !== undefined) {
          if (club._distance > self.maxDistance) return false;
        }

        return true;
      });

      // Sort by distance if user location is known
      if (self.userLat !== null && self.userLng !== null) {
        results.sort(function (a, b) {
          return a._distance - b._distance;
        });
      }

      return results;
    },

    haversine: function (lat1, lng1, lat2, lng2) {
      var R = 3959; // miles
      var dLat = this.toRad(lat2 - lat1);
      var dLng = this.toRad(lng2 - lng1);
      var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(lat1)) *
          Math.cos(this.toRad(lat2)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },

    toRad: function (deg) {
      return (deg * Math.PI) / 180;
    },
  };

  window.GameClubSearch = GameClubSearch;
})();
