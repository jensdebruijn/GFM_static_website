/* global L */

"use strict";

L.Timeline = L.GeoJSON.extend({
  times: null,
  ranges: null,

  initialize: function initialize(events_per_area) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    if (options.childs) {
      this.displayedCities = {};
      this.childs = options.childs;
    }

    this.times = [];
    this.features = [];
    this.ranges = new IntervalTree();
    var defaultOptions = {
      drawOnSetTime: true
    };
    L.GeoJSON.prototype.initialize.call(this, null, options);
    L.Util.setOptions(this, defaultOptions);
    L.Util.setOptions(this, options);
    if (events_per_area) {
      this._process(events_per_area, options.type, options.areas);
    };
  },
  _getInterval: function _getInterval(feature) {
    var hasStart = 'start' in feature;
    var hasEnd = 'end' in feature;
    if (hasStart && hasEnd) {
      return {
        start: new Date(feature.start + '.000Z').getTime(),
        end: new Date(feature.end + '.000Z').getTime()
      };
    }
    return false;
  },

  _process: function _process(events_per_area, type, areas) {
    var start = Infinity;
    var end = -Infinity;
    events_per_area.forEach(function (event) {
      var area = areas[event.location_ID];
      if (area) {
        if (area.properties.type == type) {
          var interval = this._getInterval(event);
          if (!interval) {
            return;
          }
          var feature = {
            "type": "Feature",
            "geometry": area.geometry,
            "properties": area.properties,
            "event": event
          };
          this.features.push(feature);
          this.ranges.insert(interval.start, interval.end, feature);
          this.times.push(interval.start);
          this.times.push(interval.end);
          start = Math.min(start, interval.start);
          end = Math.max(end, interval.end);
        }
      } else {
        console.log(event.location_ID + " not found")
      }
    }.bind(this));
    this.start = this.options.start || start;
    this.end = this.options.end || end;
    this.time = this.start;
    if (this.times.length === 0) {
      return;
    }
    this.times.sort(function (a, b) {
      return a - b;
    });
    this.times = this.times.reduce(function (newList, x, i) {
      if (i === 0) {
        return newList;
      }
      var lastTime = newList[newList.length - 1];
      if (lastTime !== x) {
        newList.push(x);
      }
      return newList;
    }, [this.times[0]]);
  },

  setTime: function setTime(time) {
    this.time = typeof time === 'number' ? time : new Date(time).getTime();
    if (this.options.drawOnSetTime) {
      this.updateDisplayedLayers();
    }
    this.fire('change');
  },

  getDisplayed: function getDisplayed() {
    return this.ranges.lookup(this.time);
  },

  updateDisplayedLayers: function updateDisplayedLayers() {
    var features = this.ranges.lookup(this.time);
    for (var i = 0; i < this.getLayers().length; i++) {
      var found = false;
      var layer = this.getLayers()[i];
      for (var j = 0; j < features.length; j++) {
        if (layer.feature === features[j]) {
          found = true;
          features.splice(j, 1);
          break;
        }
      }
      if (!found) {
        var toRemove = this.getLayers()[i--];
        this.removeLayer(toRemove);
        if (this.childs != undefined) {
          var event_id = toRemove.feature.event.event_id;
          var childsToRemove = this.displayedCities[event_id];
          if (childsToRemove != undefined) {
            this.childs.RemoveMarkers(childsToRemove);
          }
          delete this.displayedCities[event_id];
          this.childs.ProcessView();
        }
      }
    }
    features.forEach(function (feature) {
      this.addData(feature);
      var childs = feature.event.childs;
      if (childs !== undefined & childs.length !== 0) {
        var event_id = feature.event.event_id;
        this.displayedCities[event_id] = [];
        feature.event.childs.forEach(function(city) {
          var cityMarker = new PruneCluster.Marker(city['centroid'][1], city['centroid'][0]);
          cityMarker.data = {
            "event": {
              "start": feature.event.start,
              "end": feature.event.end,
              "detection": feature.event.detection,
              "event_id": event_id
            },
            "properties": {
              "type": "city",
              "location_ID": city.location_ID
            }
          };
          this.childs.RegisterMarker(cityMarker);
          this.displayedCities[event_id].push(cityMarker);
        }.bind(this))
        this.childs.ProcessView();
      }
    }.bind(this));
  }
});

L.timeline = function (geojson, options) {
  return new L.Timeline(geojson, options);
};
