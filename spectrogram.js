(function(root) {
  'use strict';

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

    const baseCanvasOptions = options.canvas || {};
    const scaledCanvasOptions = options.scaledCanvas || {};
    
    this._baseCanvas = canvas;
    this._baseCanvasContext = this._baseCanvas.getContext('2d');

    this._baseCanvas.width = _result(baseCanvasOptions.width) || this._baseCanvas.width;
    this._baseCanvas.height = _result(baseCanvasOptions.height) || this._baseCanvas.height;

    this._scaledCanvas = scaledCanvas;

    this._scaledCanvasContext = this._scaledCanvas.getContext('2d');
    
    this._scaledCanvas.width = _result(scaledCanvasOptions.width) || this._scaledCanvas.width;
    this._scaledCanvas.height = _result(scaledCanvasOptions.height) || this._scaledCanvas.height;

    window.onresize = function() {
      this._baseCanvas.width = _result(baseCanvasOptions.width) || this._baseCanvas.width;
      this._baseCanvas.height = _result(baseCanvasOptions.height) || this._baseCanvas.height;

      this._scaledCanvas.width = _result(scaledCanvasOptions.width) || this._scaledCanvas.width;
      this._scaledCanvas.height = _result(scaledCanvasOptions.height) || this._scaledCanvas.height;
    }.bind(this);


    let colors = [];

    if (typeof options.colors === 'function') {
      colors = options.colors(options.colorSpectrumSteps);
    } else {
      colors = this.generateDefaultColors(options.colorSpectrumSteps);
    }

    this._colors = colors;
    this._gfccInterval = options.interval;
    
    this._gfccSignals = this.parseGFCC(options.source.gfcc);

    this._normGfcc = this.normalizeValues(this._gfccSignals, this.getMinValue(this._gfccSignals), this.getMaxValue(this._gfccSignals), options.colorSpectrumSteps);

    this._baseCanvasContext.fillStyle = this.getColor(0);
    this._baseCanvasContext.fillRect(0, 0, this._baseCanvas.width, this._baseCanvas.height);

    this._scaledCanvasContext.fillStyle = this.getColor(0);
    this._scaledCanvasContext.fillRect(0, 0, this._scaledCanvas.width, this._scaledCanvas.height);
  }

  Spectrogram.prototype.drawGfccSpectrogram = function(gfccSignals, baseCanvasCtx, scaledCanvasCtx) {
    gfccSignals.forEach( signalsVector => {
      this.draw(signalsVector, baseCanvasCtx, scaledCanvasCtx);
    });
  };

  Spectrogram.prototype.draw = function(array, baseCanvasCtx, scaledCanvasCtx) {
      const baseCanvas = baseCanvasCtx.canvas;
      const baseWidth = baseCanvas.width;
      const baseHeight = baseCanvas.height;

      const scaledCanvas = scaledCanvasCtx.canvas;
      const scaledWidth = scaledCanvas.width;
      const scaledHeight = scaledCanvas.height;

      const tempCanvasContext = baseCanvasCtx._tempContext;
      const tempCanvas = tempCanvasContext.canvas;
      tempCanvasContext.drawImage(baseCanvas, 0, 0, baseWidth, baseHeight);

      const tempScaledCanvasContext = scaledCanvasCtx._tempContext;
      const tempScaledCanvas = tempScaledCanvasContext.canvas;
      tempScaledCanvasContext.drawImage(scaledCanvas, 0, 0, scaledWidth, scaledHeight);

      const intervalLength = this._gfccInterval[1] - this._gfccInterval[0]
      const pixels =  baseHeight/intervalLength;

      for (let i = 0; i < array.length; i++) {
        const value = array[i];
        baseCanvasCtx.fillStyle = this.getColor(value);
        scaledCanvasCtx.fillStyle = this.getColor(value);
        if (this._audioEnded) {
          baseCanvasCtx.fillStyle = this.getColor(0);
          scaledCanvasCtx.fillStyle = this.getColor(0);
        }
        baseCanvasCtx.fillRect(0, baseHeight - (i * pixels), 1, pixels);
        scaledCanvasCtx.fillRect(0, scaledHeight - (i * pixels * 2), 2, pixels * 2);
      }

      baseCanvasCtx.translate(1, 0);
      scaledCanvasCtx.translate(2, 0);
      // draw prev canvas before translation
      baseCanvasCtx.drawImage(tempCanvas, 0, 0, baseWidth, baseHeight, 0, 0, baseWidth, baseHeight);
      scaledCanvasCtx.drawImage(tempScaledCanvas, 0, 0, scaledWidth, scaledHeight, 0, 0, scaledWidth, scaledHeight);
      // reset transformation matrix
      baseCanvasCtx.setTransform(1, 0, 0, 1, 0, 0);
      scaledCanvasCtx.setTransform(1, 0, 0, 1, 0, 0);

      this._baseCanvasContext.drawImage(baseCanvas, 0, 0, baseWidth, baseHeight);
      this._scaledCanvasContext.drawImage(scaledCanvas, 0, 0, scaledWidth, scaledHeight);
  };

  Spectrogram.prototype.drawScaled = function (sX, sY, sWidth, sHeight, dX, dY, dWidth, dHeight) {
    this._scaledCanvasContext.drawImage(this._baseCanvas, sX, sY, sWidth, sHeight, dX, dY, dWidth, dHeight);
  };

  Spectrogram.prototype.createCanvases = function() {
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = this._baseCanvas.width;
    baseCanvas.height = this._baseCanvas.height;
    const baseCanvasContext = baseCanvas.getContext('2d');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = baseCanvas.width;
    tempCanvas.height = baseCanvas.height;

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = this._scaledCanvas.width;
    scaledCanvas.height = this._scaledCanvas.height;
    const scaledCanvasContext = scaledCanvas.getContext('2d');

    const scaledTempCanvas = document.createElement('canvas');
    scaledTempCanvas.width = scaledCanvas.width;
    scaledTempCanvas.height = scaledCanvas.height;

    baseCanvasContext._tempContext = tempCanvas.getContext('2d');
    scaledCanvasContext._tempContext = scaledTempCanvas.getContext('2d');

    this.drawGfccSpectrogram(this._normGfcc, baseCanvasContext, scaledCanvasContext);
  };

  Spectrogram.prototype.clear = function() {
    let baseCanvasContext, scaledCanvasContext, baseCanvas, scaledCanvas;

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

  Spectrogram.prototype.parseGFCC = function(gfccSource) {
    const parsedValues = [];

    gfccSource.forEach((vector)=>{
      const gfccVector = [];
      vector.forEach((el, i) => {
        // using just coefficiets that are defined in options
        if (i >= this._gfccInterval[0] && i <= this._gfccInterval[1]) {
          const parsed = parseFloat(el);
          gfccVector.push(parsed);
        }
      });
      parsedValues.push(gfccVector);
    });
    return parsedValues;
  };

  Spectrogram.prototype.getMaxValue = function(source) {
    let max = Math.max(...source[0]);
    source.forEach(vector =>{
      const actualMax = Math.max(...vector);
      max = (actualMax > max) ? actualMax : max;
    })
    return max;
  };

  Spectrogram.prototype.getMinValue = function(source) {
    let min = Math.min(...source[0]);
    source.forEach(vector=>{
      const actualMin = Math.min(...vector);
      min = (actualMin < min) ? actualMin : min;
    })
    return min;
  };

  Spectrogram.prototype.normalizeValues = function(source, minValue, maxValue, colorsCount) {
    const valuesRange = maxValue - minValue;
    const oneColorRange = valuesRange / colorsCount;

    const normMin = Math.floor(minValue / oneColorRange);
    const normMax = Math.floor(maxValue / oneColorRange);

    const normalizationArray = [];

    for (let i = normMin; i <= normMax; i++) {
      normalizationArray.push(i);
    }

    const normalizedVectros = [];
    source.forEach(vector => {
      const normalizedValues = [];
      vector.forEach( value => {
        const normValue = Math.floor(value / oneColorRange);
        normalizedValues.push(normalizationArray.indexOf(normValue));
      });
      normalizedVectros.push(normalizedValues);
    });
    return normalizedVectros;
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
