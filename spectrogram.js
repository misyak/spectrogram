(function(root) {
  'use strict';

  function _isFunction(v) {
    return typeof v === 'function';
  }

  function _result(v) {
    return _isFunction(v) ? v() : v;
  }

  var toString = Object.prototype.toString;

  function Spectrogram(canvas, scaledCanvas, options) {
    if (!(this instanceof Spectrogram)) {
      return new Spectrogram(canvas, scaledCanvas, options);
    }

    var baseCanvasOptions = options.canvas || {};
    var scaledCanvasOptions = options.scaledCanvas || {};
    
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

    var audioOptions = options.audio || {};
    this.audio = audioOptions;

    var colors = [];

    if (typeof options.colors === 'function') {
      colors = options.colors(275);
    } else {
      colors = this._generateDefaultColors(275);
    }

    this._colors = colors;

    this._baseCanvasContext.fillStyle = this._getColor(0);
    this._baseCanvasContext.fillRect(0, 0, this._baseCanvas.width, this._baseCanvas.height);

    this._scaledCanvasContext.fillStyle = this._getColor(0);
    this._scaledCanvasContext.fillRect(0, 0, this._scaledCanvas.width, this._scaledCanvas.height);
  }

  Spectrogram.prototype._init = function() {
    var source = this._sources.audioBufferStream;
    source.scriptNode = source.audioContext.createScriptProcessor(2048, 1, 1);
    source.scriptNode.connect(source.audioContext.destination);
    source.scriptNode.onaudioprocess = function(event) {
      var array = new Uint8Array(source.analyser.frequencyBinCount);
      source.analyser.getByteFrequencyData(array);

      this._draw(array, source.baseCanvasContext, source.scaledCanvasContext);
    }.bind(this);

    source.sourceNode.onended = function() {
      this.stop();
    }.bind(this);

    source.analyser = source.audioContext.createAnalyser();
    source.analyser.smoothingTimeConstant = 0;
    source.analyser.fftSize = 1024;

    source.analyser.connect(source.scriptNode);
    source.sourceNode.connect(source.analyser);
    if (this.audio.enable) {
      source.sourceNode.connect(source.audioContext.destination);
    }
  };

  Spectrogram.prototype._draw = function(array, baseCanvasCtx, scaledCanvasCtx) {
      if (this._paused) {
        return false;
      }

      var baseCanvas = baseCanvasCtx.canvas;
      var baseWidth = baseCanvas.width;
      var baseHeight = baseCanvas.height;

      var scaledCanvas = scaledCanvasCtx.canvas;
      var scaledWidth = scaledCanvas.width;
      var scaledHeight = scaledCanvas.height;

      var tempCanvasContext = baseCanvasCtx._tempContext;
      var tempCanvas = tempCanvasContext.canvas;
      tempCanvasContext.drawImage(baseCanvas, 0, 0, baseWidth, baseHeight);

      var tempScaledCanvasContext = scaledCanvasCtx._tempContext;
      var tempScaledCanvas = tempScaledCanvasContext.canvas;
      tempScaledCanvasContext.drawImage(scaledCanvas, 0, 0, scaledWidth, scaledHeight);

      for (var i = 0; i < array.length; i++) {
        var value = array[i];
        baseCanvasCtx.fillStyle = this._getColor(value);
        scaledCanvasCtx.fillStyle = this._getColor(value);
        if (this._audioEnded) {
          baseCanvasCtx.fillStyle = this._getColor(0);
          scaledCanvasCtx.fillStyle = this._getColor(0);
        }
        baseCanvasCtx.fillRect(0, baseHeight - i, 1, 1);
        scaledCanvasCtx.fillRect(0, scaledHeight - i, 2, 1);
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

  Spectrogram.prototype._startMediaStreamDraw = function(analyser, baseCanvasContext, scaledCanvasContext) {
    window.requestAnimationFrame(this._startMediaStreamDraw.bind(this, analyser, baseCanvasContext, scaledCanvasContext));
    var audioData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(audioData);
    this._draw(audioData, baseCanvasContext, scaledCanvasContext);
  };

  Spectrogram.prototype.drawScaled = function (sX, sY, sWidth, sHeight, dX, dY, dWidth, dHeight) {
    this._scaledCanvasContext.drawImage(this._baseCanvas, sX, sY, sWidth, sHeight, dX, dY, dWidth, dHeight);
  };

  Spectrogram.prototype.connectSource = function(audioBuffer, audioContext) {
    var source = this._sources.audioBufferStream || {};

    // clear current audio process
    if (toString.call(source.scriptNode) === '[object ScriptProcessorNode]') {
      source.scriptNode.onaudioprocess = null;
    }

    if (toString.call(audioBuffer) === '[object AudioBuffer]') {
      audioContext = (!audioContext && source.audioBuffer.context) || (!audioContext && source.audioContext) || audioContext;

      var sourceNode = audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;

      var baseCanvasContext = source.baseCanvasContext;
      var scaledCanvasContext = source.scaledCanvasContext

      if (!source.baseCanvasContext || !source.scaledCanvasContext) {
        var baseCanvas = document.createElement('canvas');
        baseCanvas.width = this._baseCanvas.width;
        baseCanvas.height = this._baseCanvas.height;
        baseCanvasContext = baseCanvas.getContext('2d');

        var scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = this._scaledCanvas.width;
        scaledCanvas.height = this._scaledCanvas.height;
        scaledCanvasContext = scaledCanvas.getContext('2d');

        var tempCanvas = document.createElement('canvas');
        tempCanvas.width = baseCanvas.width;
        tempCanvas.height = baseCanvas.height; 

        var tempScaledCanvas = document.createElement('canvas');
        tempScaledCanvas.width = scaledCanvas.width;
        tempScaledCanvas.height = scaledCanvas.height;

        baseCanvasContext._tempContext = tempCanvas.getContext('2d');
        scaledCanvasContext._tempContext = tempScaledCanvas.getContext('2d');
      }

      source = {
        audioBuffer: audioBuffer,
        audioContext: audioContext,
        sourceNode: sourceNode,
        analyser: null,
        scriptNode: null,
        baseCanvasContext: baseCanvasContext,
        scaledCanvasContext: scaledCanvasContext,
      };

      this._sources.audioBufferStream = source;
      this._init();
    }

    if (toString.call(audioBuffer) === '[object AnalyserNode]') {
      source = this._sources.userMediaStream || {};
      source.analyser = audioBuffer;
      this._sources.userMediaStream = source;
    }
  };

  Spectrogram.prototype.start = function(offset) {
    var source = this._sources.audioBufferStream;
    var sourceMedia = this._sources.userMediaStream;

    if (source && source.sourceNode) {
      source.sourceNode.start(0, offset||0);
      this._audioEnded = false;
      this._paused = false;
      this._startedAt = Date.now();
    }

    // media stream uses an analyser for audio data
    if (sourceMedia && sourceMedia.analyser) {
      source = sourceMedia;

      var baseCanvas = document.createElement('canvas');
      baseCanvas.width = this._baseCanvas.width;
      baseCanvas.height = this._baseCanvas.height;
      var baseCanvasContext = baseCanvas.getContext('2d');

      var tempCanvas = document.createElement('canvas');
      tempCanvas.width = baseCanvas.width;
      tempCanvas.height = baseCanvas.height;

      var scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = this._scaledCanvas.width;
      scaledCanvas.height = this._scaledCanvas.height;
      var scaledCanvasContext = scaledCanvas.getContext('2d');

      var scaledTempCanvas = document.createElement('canvas');
      scaledTempCanvas.width = scaledCanvas.width;
      scaledTempCanvas.height = scaledCanvas.height;

      baseCanvasContext._tempContext = tempCanvas.getContext('2d');
      scaledCanvasContext._tempContext = scaledTempCanvas.getContext('2d');

      this._startMediaStreamDraw(source.analyser, baseCanvasContext, scaledCanvasContext);
    }
  };

  Spectrogram.prototype.stop = function() {
    var source = this._sources[Object.keys(this._sources)[0]];
    if (source && source.sourceNode) {
      source.sourceNode.stop();
    }
    this._audioEnded = true;
  };

  Spectrogram.prototype.pause = function() {
    this.stop();
    this._paused = true;
    this._pausedAt += Date.now() - this._startedAt;
  };

  Spectrogram.prototype.resume = function(offset) {
    var source = this._sources[Object.keys(this._sources)[0]];
    this._paused = false;
    if (this._pausedAt) {
      this.connectSource(source.audioBuffer, source.audioContext);
      this.start(offset || (this._pausedAt / 1000));
    }
  };

  Spectrogram.prototype.clear = function() {
    var source = this._sources[Object.keys(this._sources)[0]];

    this.stop();

    if (toString.call(source.scriptNode) === '[object ScriptProcessorNode]') {
      source.scriptNode.onaudioprocess = null;
    }

    const baseCanvasContext = source.baseCanvasContext;
    const scaledCanvasContext = source.scaledCanvasContext;
    const baseCanvas = baseCanvasContext.canvas;
    const scaledCanvas = scaledCanvasContext.canvas;

    baseCanvasContext.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    baseCanvasContext._tempContext.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    this._baseCanvasContext.clearRect(0, 0, baseCanvas.width, baseCanvas.height);

    scaledCanvasContext.clearRect(0, 0, scaledCanvas.width, scaledCanvas.height);
    scaledCanvasContext._tempContext.clearRect(0, 0, scaledCanvas.width, scaledCanvas.height);
    this._scaledCanvasContext.clearRect(0, 0, scaledCanvas.width, scaledCanvas.height);
  };

  Spectrogram.prototype._generateDefaultColors = function(steps) {
    var frequency = Math.PI / steps;
    var amplitude = 127;
    var center = 128;
    var slice = (Math.PI / 2) * 3.1;
    var colors = [];

    function toRGBString(v) {
      return 'rgba(' + [v,v,v,1].toString() + ')';
    }

    for (var i = 0; i < steps; i++) {
      var v = (Math.sin((frequency * i) + slice) * amplitude + center) >> 0;

      colors.push(toRGBString(v));
    }

    return colors;
  };

  Spectrogram.prototype._getColor = function(index) {
    var color = this._colors[index>>0];

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
