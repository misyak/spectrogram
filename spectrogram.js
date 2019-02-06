(function(root) {
  'use strict';
  var orderBy = require('lodash/orderBy');

  function _isFunction(v) {
    return typeof v === 'function';
  }

  function _result(v) {
    return _isFunction(v) ? v() : v;
  }

  const toString = Object.prototype.toString;

  function Spectrogram(canvas, scaledCanvas, options) {
    if (!(this instanceof Spectrogram)) {
      return new Spectrogram(canvas, scaledCanvas, options);
    }

    if (scaledCanvas) {
      const scaledCanvasOptions = options.scaledCanvas || {};
      this._scaledCanvas = scaledCanvas;

      this._scaledCanvasContext = this._scaledCanvas.getContext('2d');
    
      this._scaledCanvas.width = _result(scaledCanvasOptions.width) || this._scaledCanvas.width;
      this._scaledCanvas.height = _result(scaledCanvasOptions.height) || this._scaledCanvas.height;
    }

    const baseCanvasOptions = options.canvas || {};
    
    this._baseCanvas = canvas;
    this._baseCanvasContext = this._baseCanvas.getContext('2d');

    this._baseCanvas.width = _result(baseCanvasOptions.width) || this._baseCanvas.width;
    this._baseCanvas.height = _result(baseCanvasOptions.height) || this._baseCanvas.height;

    window.onresize = function() {
      this._baseCanvas.width = _result(baseCanvasOptions.width) || this._baseCanvas.width;
      this._baseCanvas.height = _result(baseCanvasOptions.height) || this._baseCanvas.height;

      if (scaledCanvas) {
        this._scaledCanvas.width = _result(scaledCanvasOptions.width) || this._scaledCanvas.width;
        this._scaledCanvas.height = _result(scaledCanvasOptions.height) || this._scaledCanvas.height;
      }
    }.bind(this);


    let colors = [];

    if (typeof options.colors === 'function') {
      colors = options.colors(options.colorSpectrumSteps);
    } else {
      colors = this.generateDefaultColors(options.colorSpectrumSteps);
    }

    this._colors = colors;
    
    this._baseCanvasContext.fillStyle = 'black';
    this._baseCanvasContext.fillRect(0, 0, this._baseCanvas.width, this._baseCanvas.height);

    if (scaledCanvas) {
      this._scaledCanvasContext.fillStyle = 'black';
      this._scaledCanvasContext.fillRect(0, 0, this._scaledCanvas.width, this._scaledCanvas.height);
    }
  }

  Spectrogram.prototype.drawGfccSpectrogram = function(gfccSignals, baseCanvasCtx) {
    gfccSignals.forEach( segmentGfccs => {
      segmentGfccs.forEach( signalsVector => {
        this.draw(signalsVector, baseCanvasCtx);
      });
    });
  };

  Spectrogram.prototype.draw = function(array, baseCanvasCtx) {
      const baseCanvas = baseCanvasCtx.canvas;
      const baseWidth = baseCanvas.width;
      const baseHeight = baseCanvas.height;

      const tempCanvasContext = baseCanvasCtx._tempContext;
      const tempCanvas = tempCanvasContext.canvas;
      tempCanvasContext.drawImage(baseCanvas, 0, 0, baseWidth, baseHeight);

      for (let i = 0; i < array.length; i++) {
        const value = array[i];
        baseCanvasCtx.fillStyle = this.getColor(value);
        baseCanvasCtx.fillRect(baseWidth - 2, baseHeight - (i * 2), 2, 2);
      }

      baseCanvasCtx.translate(-2, 0);
      // draw prev canvas before translation
      baseCanvasCtx.drawImage(tempCanvas, 0, 0, baseWidth, baseHeight, 0, 0, baseWidth, baseHeight);
      // reset transformation matrix
      baseCanvasCtx.setTransform(1, 0, 0, 1, 0, 0);

      this._baseCanvasContext.drawImage(baseCanvas, 0, 0, baseWidth, baseHeight);
  };

  Spectrogram.prototype.drawScaled = function (sX, sY, sWidth, sHeight, dX, dY, dWidth, dHeight) {
    this._scaledCanvasContext.drawImage(this._baseCanvas, sX, sY, sWidth, sHeight, dX, dY, dWidth, dHeight);
  };

  Spectrogram.prototype.createCanvases = function(segments) {
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = this._baseCanvas.width;
    baseCanvas.height = this._baseCanvas.height;
    const baseCanvasContext = baseCanvas.getContext('2d');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = baseCanvas.width;
    tempCanvas.height = baseCanvas.height;

    baseCanvasContext._tempContext = tempCanvas.getContext('2d');  
    
    const allGfccs = [];
    segments.forEach((segment)=>{
      const gfccs = [];
      segment.gfccs.forEach((vector)=>{
        gfccs.push(vector);
      });
      allGfccs.push(gfccs);
    });
    this.drawGfccSpectrogram(allGfccs, baseCanvasContext);
  };

  Spectrogram.prototype.clear = function() {
    let baseCanvas, scaledCanvas;

    baseCanvas = this._baseCanvasContext.canvas;
    scaledCanvas = this._scaledCanvasContext.canvas;

    this._baseCanvasContext.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    this._scaledCanvasContext.clearRect(0, 0, scaledCanvas.width, scaledCanvas.height);
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
