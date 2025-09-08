"use strict";

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/* global L */

L.TimelineSliderControl = L.Control.extend({
  initialize: function initialize() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var defaultOptions = {
      duration: 10000,
      enableKeyboardControls: false,
      enablePlayback: true,
      formatOutput: function formatOutput(output) {
        return '' + (output || '');
      },
      showTicks: true,
      waitToUpdateMap: false,
      position: 'bottomleft',
      steps: 1000
    };
    this.timelines = [];
    this.buttonTimer;
    L.Util.setOptions(this, defaultOptions);
    L.Util.setOptions(this, options);
    if (typeof options.start !== 'undefined') {
      this.start = options.start;
    }
    if (typeof options.end !== 'undefined') {
      this.end = options.end;
    }
  },
  _getTimes: function _getTimes() {
    var _this = this;

    var times = [];
    this.timelines.forEach(function (timeline) {
      var timesInRange = timeline.times.filter(function (time) {
        return time >= _this.start && time <= _this.end;
      });
      times.push.apply(times, _toConsumableArray(timesInRange));
    });
    if (times.length) {
      times.sort(function (a, b) {
        return a - b;
      });
      var dedupedTimes = [times[0]];
      times.reduce(function (a, b) {
        if (a !== b) {
          dedupedTimes.push(b);
        }
        return b;
      });
      return dedupedTimes;
    }
    return times;
  },
  _recalculate: function _recalculate() {
    var manualStart = typeof this.options.start !== 'undefined';
    var manualEnd = typeof this.options.end !== 'undefined';
    var duration = this.options.duration;
    var min = Infinity;
    var max = -Infinity;
    this.timelines.forEach(function (timeline) {
      if (timeline.start < min) {
        min = timeline.start;
      }
      if (timeline.end > max) {
        max = timeline.end;
      }
    });
    if (!manualStart) {
      this.start = min;
      this._timeSlider.min = min === Infinity ? 0 : min;
      this._timeSlider.value = this._timeSlider.min;
    }
    if (!manualEnd) {
      this.end = max;
      this._timeSlider.max = max === -Infinity ? 0 : max;
    }
    this._stepSize = 3600000 * 24;
    this._stepDuration = Math.max(1, duration / this.options.steps);
  },
  _nearestEventTime: function _nearestEventTime(findTime) {
    var mode = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

    var times = this._getTimes();
    var retNext = false;
    var lastTime = times[0];
    for (var i = 1; i < times.length; i++) {
      var time = times[i];
      if (retNext) {
        return time;
      }
      if (time >= findTime) {
        if (mode === -1) {
          return lastTime;
        }
        if (time === findTime) {
          retNext = true;
        } else {
          return time;
        }
      }
      lastTime = time;
    }
    return lastTime;
  },
  _createDOM: function _createDOM() {
    var _this2 = this;

    var classes = ['leaflet-control-layers', 'leaflet-control-layers-expanded', 'leaflet-timeline-control'];
    var container = L.DomUtil.create('div', classes.join(' '));
    this.container = container;
    this.container.addEventListener('pointerdown', function () {
      _this2.pause();
      return _this2.map.dragging.disable();
    });
    document.addEventListener('pointerup', function () {
      return _this2.map.dragging.enable();
    });
    this.container.addEventListener('mousedown', function () {
      _this2.pause();
      return _this2.map.dragging.disable();
    });
    document.addEventListener('mouseup', function () {
      return _this2.map.dragging.enable();
    });

    if (this.options.enablePlayback) {
      var sliderCtrlC = L.DomUtil.create('div', 'sldr-ctrl-container', container);
      var buttonContainer = L.DomUtil.create('div', 'button-container', sliderCtrlC);
      this._makeButtons(buttonContainer);
      if (this.options.enableKeyboardControls) {
        this._addKeyListeners();
      }
      this._makeOutput(sliderCtrlC);
    }
    this._makeSlider(container);
    this._makeLogos(container);
    if (this.options.showTicks) {
      this._buildDataList(container);
    }
  },
  _addKeyListeners: function _addKeyListeners() {
    var _this3 = this;

    this._listener = function () {
      return _this3._onKeydown.apply(_this3, arguments);
    };
    document.addEventListener('keydown', this._listener);
  },
  _removeKeyListeners: function _removeKeyListeners() {
    document.removeEventListener('keydown', this._listener);
  },
  _buildDataList: function _buildDataList(container) {
    this._datalist = L.DomUtil.create('datalist', '', container);
    var idNum = Math.floor(Math.random() * 1000000);
    this._datalist.id = 'timeline-datalist-' + idNum;
    this._timeSlider.setAttribute('list', this._datalist.id);
    this._rebuildDataList();
  },
  _rebuildDataList: function _rebuildDataList() {
    var datalist = this._datalist;
    while (datalist.firstChild) {
      datalist.removeChild(datalist.firstChild);
    }
    var datalistSelect = L.DomUtil.create('select', '', this._datalist);
    this._getTimes().forEach(function (time) {
      L.DomUtil.create('option', '', datalistSelect).value = time;
    });
  },
  _makeButton: function _makeButton(container, name) {
    var _this4 = this;

    var button = L.DomUtil.create('button', name, container);
    button.addEventListener('click', function () {
      return _this4[name]();
    });
    L.DomEvent.disableClickPropagation(button);
  },
  _makeButtons: function _makeButtons(container) {
    this._makeButton(container, 'prev');
    this._makeButton(container, 'play');
    this._makeButton(container, 'pause');
    this._makeButton(container, 'next');
  },
  _makeSlider: function _makeSlider(container) {
    var _this5 = this;

    var slider = L.DomUtil.create('input', 'time-slider', container);
    slider.type = 'range';
    slider.min = this.start || 0;
    slider.max = this.end || 0;
    slider.value = this.start || 0;
    slider.addEventListener('mouseup', function (e) {
      return _this5._sliderChanged(e);
    });
    slider.addEventListener('touchend', function (e) {
      return _this5._sliderChanged(e);
    });
    slider.addEventListener('touchstart', function (e) {
      return _this5._sliderChanged(e);
    });
    slider.addEventListener('change', function (e) {
      return _this5._sliderChanged(e);
    });
    slider.addEventListener('input', function (e) {
      return _this5._sliderChanged(e);
    });
    slider.addEventListener('pointerdown', function (e) {
      return _this5._sliderChanged(e);
    });
    slider.addEventListener('pointerup', function (e) {
      return _this5._sliderChanged(e);
    });
    slider.addEventListener('mousedown', function (e) {
      return _this5._sliderChanged(e);
    });
    this._timeSlider = slider;
  },
  _makeLogos: function _makeLogos(container) {
    var FTlogo = L.DomUtil.create('div', 'sldr-logos-container', container);
    FTlogo.innerHTML = '<a href="http://www.ivm.vu.nl" target=newtab><img src="static/img/IVM_logo.jpg"/ class="ivm-logo"></a><a href="http://www.floodtags.com" target=newtab><img src="static/img/FloodTags_logo.svg" class="floodtags-logo"/></a>';
  },
  _makeOutput: function _makeOutput(container) {
    this._output = L.DomUtil.create('output', 'time-text', container);
    this._output.innerHTML = this.options.formatOutput(this.start);
  },
  _onKeydown: function _onKeydown(e) {
    switch (e.keyCode || e.which) {
      case 37:
        this.prev();break;
      case 39:
        this.next();break;
      case 32:
        this.toggle();break;
      default:
        return;
    }
    e.preventDefault();
  },
  _sliderChanged: function _sliderChanged(e) {
    var newTime = parseFloat(e.target.value, 10);
    if (locations != undefined) {
      map.removeLayer(locations);
    };
    if (!isNaN(newTime)) {
      this.time = newTime;
      if (!this.options.waitToUpdateMap || e.type === 'change') {
        this.timelines.forEach(function (timeline) {
          return timeline.setTime(newTime);
        });
      };
      if (this._output) {
        this._output.innerHTML = this.options.formatOutput(newTime);
      };
    }
  },
  _resetIfTimelinesChanged: function _resetIfTimelinesChanged(oldTimelineCount) {
    if (this.timelines.length !== oldTimelineCount) {
      this._recalculate();
      if (this.options.showTicks) {
        this._rebuildDataList();
      }
      // this.setTime(this.start, 'init');
    }
  },
  addTimelines: function addTimelines() {
    var _this6 = this;

    this.pause(false);
    var timelineCount = this.timelines.length;

    for (var _len = arguments.length, timelines = Array(_len), _key = 0; _key < _len; _key++) {
      timelines[_key] = arguments[_key];
    }

    timelines.forEach(function (timeline) {
      if (_this6.timelines.indexOf(timeline) === -1) {
        _this6.timelines.push(timeline);
      }
    });
    this._resetIfTimelinesChanged(timelineCount);
  },
  removeTimelines: function removeTimelines() {
    var _this7 = this;

    this.pause(false);
    var timelineCount = this.timelines.length;

    for (var _len2 = arguments.length, timelines = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      timelines[_key2] = arguments[_key2];
    }

    timelines.forEach(function (timeline) {
      var index = _this7.timelines.indexOf(timeline);
      if (index !== -1) {
        _this7.timelines.splice(index, 1);
      }
    });
    this._resetIfTimelinesChanged(timelineCount);
  },
  getDisplayed: function getDisplayed() {
    var features = [];
    this.timelines.forEach(function (timeline) {
      features = features.concat(timeline.getDisplayed());
    });
    return features;
  },
  getLayers: function getLayers() {
    var layers = [];
    this.timelines.forEach(function (timeline) {
      layers = layers.concat(timeline.getLayers());
    });
    return layers;
  },
  getFeatures: function getFeatures() {
    var features = [];
    this.timelines.forEach(function (timeline) {
      features = features.concat(timeline.features);
    });
    return features;
  },
  toggle: function toggle() {
    if (this._playing) {
      this.pause(false);
    } else {
      this.play();
    }
  },
  prev: function prev() {
    this.pause(false);
    var prevTime = this._nearestEventTime(this.time, -1);
    this._timeSlider.value = prevTime;
    this.setTime(prevTime, 'button');
  },
  pause: function pause() {
    var pauseButtonPress = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    clearTimeout(this._timer);
    this._playing = false;
    this.container.classList.remove('playing');
  },
  play: function play() {
    var _this8 = this;

    clearTimeout(this._timer);
    if (parseFloat(this._timeSlider.value, 10) === this.end) {
      this._timeSlider.value = this.start;
    }
    this._timeSlider.value = parseFloat(this._timeSlider.value, 10) + this._stepSize;
    this.setTime(this._timeSlider.value, 'play');
    this._playing = true;
    this.container.classList.add('playing');
    this._timer = setTimeout(function () {
      return _this8.play();
    }, this._stepDuration);
  },
  next: function next() {
    this.pause(false);
    var nextTime = this._nearestEventTime(this.time, 1);
    this._timeSlider.value = nextTime;
    this.setTime(nextTime, 'button');
  },
  setTime: function setTime(time, type, openRandom) {
    var onDone = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    this._sliderChanged({
      type: type,
      target: { value: time }
    });
    if (onDone !== false) {
      openRandom();
    }
  },
  onAdd: function onAdd(map) {
    this.map = map;
    this._createDOM();
    // this.setTime(this.start, 'init');
    return this.container;
  },
  onRemove: function onRemove() {
    if (this.options.enableKeyboardControls) {
      this._removeKeyListeners();
    }
  }
});

L.timelineSliderControl = function (timeline, start, end, timelist) {
  return new L.TimelineSliderControl(timeline, start, end, timelist);
};
