(function(root) {
  'use strict';

  const BACKGROUND_COLOR = "#210d3e";
  const TIME_STEP = 30;
  const EED_WINDOW = 50;

  function _isFunction(v) {
    return typeof v === 'function';
  }

  function _result(v) {
    return _isFunction(v) ? v() : v;
  }

  var toString = Object.prototype.toString;

  function Spectrogram(canvas, options) {
    if (!(this instanceof Spectrogram)) {
      return new Spectrogram(canvas, options);
    }

    var baseCanvasOptions = options.canvas || {};
    this._fragmentsQueue = [];
    this._isDrawing = false;
    this._emergencyOccurred = false;
    this._newFragmentReceived = false;
    this._audioEnded = null;
    this._paused = null;
    this._pausedAt = null;
    this._startedAt = null;
    this._sources = {
      audioBufferStream: null,
      userMediaStream: null
    };
    this._baseCanvas = canvas;
    this._baseCanvasContext = this._baseCanvas.getContext('2d');

    this._baseCanvas.width = _result(baseCanvasOptions.width) || this._baseCanvas.width;
    this._baseCanvas.height = _result(baseCanvasOptions.height) || this._baseCanvas.height;

    window.onresize = function() {
      this._baseCanvas.width = _result(baseCanvasOptions.width) || this._baseCanvas.width;
      this._baseCanvas.height = _result(baseCanvasOptions.height) || this._baseCanvas.height;
    }.bind(this);

    var audioOptions = options.audio || {};
    this.audio = audioOptions;

    var colors = [];

    if (typeof options.colors === 'function') {
      colors = options.colors(275);

    } else if (typeof options.colors === 'object') {
      for (var i = 0; i < options.colors.length; i++) {
        colors.push(toRGBString(options.colors[i]));
      }
    } else {
      colors = this._generateDefaultColors(275);
    }

    this._colors = colors;

    this._baseCanvasContext.fillStyle = BACKGROUND_COLOR;
    this._baseCanvasContext.fillRect(0, 0, this._baseCanvas.width, this._baseCanvas.height);

    function toRGBString(color) {
      return 'rgba(' + [color[0],color[1],color[2],1].toString() + ')';
    }
  }

  Spectrogram.prototype.setEmergencyFlag = function () {
    this._emergencyOccurred = true;
  }

  Spectrogram.prototype.resetEmergencyFlag = function () {
    this._emergencyOccurred = false;
  }

  Spectrogram.prototype.setFragmentFlag = function () {
    this._newFragmentReceived = true;
  }

  Spectrogram.prototype.resetFragmentFlag = function () {
    this._newFragmentReceived = false;
  }

  Spectrogram.prototype.drawSpectrogram = function (data, baseCanvasCtx) {
    return new Promise((resolve) => {

      this._isDrawing = true;
      let eedEnd = 0;

      for (let i=0; i < data.length; i++) {

        setTimeout(()=>{
          // emergnecy event occured
          if (this._emergencyOccurred) {
            eedEnd = i + EED_WINDOW;
            this.draw(data[i], baseCanvasCtx, 'line')
            this.resetEmergencyFlag();
            // drawing top and bottom border
          } else if (eedEnd > 0 && i < eedEnd && i !== data.length - 1) {
            this.draw(data[i], baseCanvasCtx, 'border')
            // end of emergency event
          } else if (eedEnd > 0 && (i === eedEnd || i === data.length -1)) {
            eedEnd = 0;
            this.draw(data[i], baseCanvasCtx, 'line')
            // no EE just draw as normally
          } else {
            this.draw(data[i], baseCanvasCtx);
          }
        }, i * TIME_STEP);
      }

      setTimeout(()=>{
        this._isDrawing = false;
        resolve(baseCanvasCtx);
      }, data.length * TIME_STEP);
    })
  };

  Spectrogram.prototype.blackOutCanvas = function (baseCanvasCtx) {
    return new Promise((resolve) => {
      const baseCanvas = baseCanvasCtx.canvas;
      const baseWidth = baseCanvas.width;
      const baseHeight = baseCanvas.height;

      baseCanvasCtx.fillStyle = 'black';
      let i = 0;
      this._isDrawing = true;

      do {
        setTimeout(()=>{
          const tempCanvasContext = baseCanvasCtx._tempContext;
          const tempCanvas = tempCanvasContext.canvas;
          tempCanvasContext.drawImage(baseCanvas, 0, 0, baseWidth, baseHeight);

          baseCanvasCtx.fillRect(baseWidth - 1, 0, 1, baseHeight);

          baseCanvasCtx.translate(-1, 0);
          // draw prev canvas before translation
          baseCanvasCtx.drawImage(tempCanvas, 0, 0, baseWidth, baseHeight, 0, 0, baseWidth, baseHeight);
          // reset transformation matrix
          baseCanvasCtx.setTransform(1, 0, 0, 1, 0, 0);
          this._baseCanvasContext.drawImage(baseCanvas, 0, 0, baseWidth, baseHeight);
        }, i * TIME_STEP);

        i++;

        if (i === baseWidth -1) {
          this._isDrawing = false;
        }
      } while ( !this._newFragmentReceived && i < baseWidth );


      if (this._newFragmentReceived) {
        this._isDrawing = false;
        this.processQueue(baseCanvasCtx);
      }
    });
  };

  Spectrogram.prototype.draw = function(array, baseCanvasCtx, shape = 'none') {
    const baseCanvas = baseCanvasCtx.canvas;
    const baseWidth = baseCanvas.width;
    const baseHeight = baseCanvas.height;

    const tempCanvasContext = baseCanvasCtx._tempContext;
    const tempCanvas = tempCanvasContext.canvas;
    tempCanvasContext.drawImage(baseCanvas, 0, 0, baseWidth, baseHeight);

    for (let i = 0; i < array.length; i++) {
      const value = array[i];
      // marking the part where something occured
      if (shape === 'line') {
        baseCanvasCtx.fillStyle = 'yellow';
      } else if (shape === 'border') {
        if ( i === 0 || i === array.length - 1) {
          baseCanvasCtx.fillStyle = 'yellow';
        } else {
          baseCanvasCtx.fillStyle = this.getColor(value);
        }
      }
      else {
        baseCanvasCtx.fillStyle = this.getColor(value);
      }
      baseCanvasCtx.fillRect(baseWidth - 1, (baseHeight - 1) - (i * 1), 1, 1);
    }

    baseCanvasCtx.translate(-1, 0);
    // draw prev canvas before translation
    baseCanvasCtx.drawImage(tempCanvas, 0, 0, baseWidth, baseHeight, 0, 0, baseWidth, baseHeight);
    // reset transformation matrix
    baseCanvasCtx.setTransform(1, 0, 0, 1, 0, 0);

    this._baseCanvasContext.drawImage(baseCanvas, 0, 0, baseWidth, baseHeight);
  };

  Spectrogram.prototype.createCanvas = function(data) {
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = this._baseCanvas.width;
    baseCanvas.height = this._baseCanvas.height;
    const baseCanvasContext = baseCanvas.getContext('2d');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = baseCanvas.width;
    tempCanvas.height = baseCanvas.height;

    baseCanvasContext._tempContext = tempCanvas.getContext('2d');

    if (!this._isDrawing) {
      this.drawSpectrogram(data, baseCanvasContext).then(()=>{
        this.processQueue(baseCanvasContext);
      });
    } else {
      this._fragmentsQueue.push(data);
      this.setFragmentFlag();
    }
  };

  Spectrogram.prototype.processQueue = function (baseCanvasCtx) {
    if (this._fragmentsQueue.length > 0 && !this._isDrawing) {
      const dataToDraw = this._fragmentsQueue.shift();
      this.drawSpectrogram(dataToDraw, baseCanvasCtx).then(()=>{
        this.processQueue(baseCanvasCtx);
      });
    } else {
      this.resetFragmentFlag();
      this.blackOutCanvas(baseCanvasCtx);
    }
  };

  Spectrogram.prototype.clear = function() {
    let baseCanvas;
  
    baseCanvas = this._baseCanvasContext.canvas;
  
    this._baseCanvasContext.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
  };

  Spectrogram.prototype.generateDefaultColors = function(steps) {
    const frequency = Math.PI / steps;
    const amplitude = 127;
    const center = 128;
    const slice = (Math.PI / 2) * 3.1;
    let colors = [];

    function toRGBString(v) {
      return 'rgba(' + [v,v,v,1].toString() + ')';
    }

    for (let i = 0; i < steps; i++) {
      let v = (Math.sin((frequency * i) + slice) * amplitude + center) >> 0;

      colors.push(toRGBString(v));
    }

    return colors;
  };

  Spectrogram.prototype.getColor = function(index) {
    let color = this._colors[index>>0];

    if (typeof color === 'undefined') {
      color = this._colors[0];
    }

    return color;
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Spectrogram;
    }
    exports.Spectrogram = Spectrogram;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() {
      return Spectrogram;
    });
  } else {
    root.Spectrogram = Spectrogram;
  }
})(this);
