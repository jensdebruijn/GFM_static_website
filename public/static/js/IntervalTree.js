'use strict';

var _createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
    }
  }return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
  };
}();

function _toConsumableArray(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
      arr2[i] = arr[i];
    }
    return arr2;
  } else {
    return Array.from(arr);
  }
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

var IntervalTreeNode = function IntervalTreeNode(low, high, data, parent) {
  _classCallCheck(this, IntervalTreeNode);

  this.low = low;
  this.high = high;
  this.min = low;
  this.max = high;
  this.data = data;
  this.left = null;
  this.right = null;
  this.parent = parent;
};

var IntervalTree = function () {
  function IntervalTree() {
    _classCallCheck(this, IntervalTree);

    this._root = null;
    /** @type {number} */
    this.size = 0;
  }

  _createClass(IntervalTree, [{
    key: '_insert',
    value: function _insert(begin, end, value, node, parent, parentSide) {
      var newNode = void 0;
      if (node === null) {
        newNode = new IntervalTreeNode(begin, end, value, parent);
        if (parent === null) {
          this._root = newNode;
        } else {
          parent[parentSide] = newNode;
        }
      } else {
        var side = begin < node.low || begin === node.low && end < node.high ? 'left' : 'right';
        newNode = this._insert(begin, end, value, node[side], node, side);
        node.max = Math.max(node.max, newNode.max);
        node.min = Math.min(node.min, newNode.min);
      }
      return newNode;
    }

  }, {
    key: 'insert',
    value: function insert(begin, end, value) {
      this._insert(begin, end, value, this._root, this._root);
      this.size++;
    }
  }, {
    key: 'pushleft',
    value: function pushleft(overlaps, point, node) {
      var timeout = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

      timeout += 100;
      var this2 = this;
      try {
        overlaps.push.apply(overlaps, _toConsumableArray(this._lookup(point, node.left)));
      } catch (ex) {
        setTimeout(function () {
          this2.pushleft(overlaps, point, node, timeout);
        }, timeout);
      }
    }
  }, {
    key: 'pushright',
    value: function pushright(overlaps, point, node) {
      var timeout = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

      timeout += 100;
      var this2 = this;
      try {
        overlaps.push.apply(overlaps, _toConsumableArray(this._lookup(point, node.right)));
      } catch (ex) {
        setTimeout(function () {
          this2.pushright(overlaps, point, node, timeout);
        }, timeout);
      }
    }
  }, {
    key: '_lookup',
    value: function _lookup(point) {
      var this2 = this;
      var node = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this._root;
      var overlaps = [];
      if (node === null || node.max < point) {
        return overlaps;
      }
      this.pushleft(overlaps, point, node);
      if (node.low <= point) {
        if (node.high >= point) {
          overlaps.push(node.data);
        }
        this.pushright(overlaps, point, node);
      }
      return overlaps;
    }

  }, {
    key: 'lookup',
    value: function lookup(point) {
      var overlaps = this._lookup(point);
      return overlaps;
    }
  }, {
    key: '_overlap',
    value: function _overlap(begin, end) {
      var node = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this._root;

      var overlaps = [];
      if (!(begin > node.high || node.low > end)) {
        overlaps.push(node.data);
      }
      if (node.left && node.left.max >= begin) {
        overlaps.push.apply(overlaps, _toConsumableArray(this._overlap(begin, end, node.left)));
      }
      if (node.right && node.right.min <= end) {
        overlaps.push.apply(overlaps, _toConsumableArray(this._overlap(begin, end, node.right)));
      }
      return overlaps;
    }

  }, {
    key: 'overlap',
    value: function overlap(begin, end) {
      return this._overlap(begin, end);
    }
  }]);

  return IntervalTree;
}();
