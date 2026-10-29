import BuildWav from './wav.js';

/**
 *
 * @param {AudioContext} context
 * @param audiobuffer
 *
 * @return {Promise}
 */
function Play(context, audiobuffer) {
  return new Promise((resolve) => {
    let source = context.createBufferSource();
    let soundBuffer = context.createBuffer(1, audiobuffer.length, 22050);
    let buffer = soundBuffer.getChannelData(0);
    for(let i=0; i<audiobuffer.length; i++) {
      buffer[i] = audiobuffer[i];
    }
    source.buffer = soundBuffer;
    source.connect(context.destination);
    source.onended = () => {
      resolve(true);
    };
    source.start(0);
  });
}

let context = null;

/**
 * Play an audio buffer.
 *
 * @param {Float32Array} audiobuffer
 *
 * @return {Promise}
 */
export function PlayBuffer(audiobuffer) {
  if (null === context) {
    if (typeof AudioContext === 'undefined') {
      throw new Error('No player available: this environment has no Web Audio support (AudioContext).');
    }
    context = new AudioContext();
  }

  // Browsers create an AudioContext in the "suspended" state if it was not
  // established in response to a user gesture. Try to resume it before
  // playing, otherwise the buffer plays silently.
  if (context.state === 'suspended' && typeof context.resume === 'function') {
    context.resume();
  }

  return Play(context, audiobuffer);
}

/**
 * Convert a Uint8Array wave buffer to a Float32Array WaveBuffer
 *
 * @param {Uint8Array} buffer
 *
 * @return {Float32Array}
 */
export function UInt8ArrayToFloat32Array (buffer) {
  const audio = new Float32Array(buffer.length);
  for(let i=0; i < buffer.length; i++) {
    audio[i] = (buffer[i] - 128) / 256;
  }

  return audio
}

/**
 * Create a downloadable .wav file image from the buffer and trigger the
 * download in the browser.
 *
 * @param {Uint8Array} audiobuffer Raw unsigned 8-bit PCM samples.
 * @param {String}     [filename]  Download file name, defaults to 'sam.wav'.
 * @param {Number}     [bits]      Container precision passed through to the
 *                                 wav builder, 8 (default) or 16.
 *
 * @return void
 */
export function RenderBuffer (audiobuffer, filename = 'sam.wav', bits = 8) {
  const realbuffer = BuildWav(audiobuffer, bits);

  const blob = new Blob([realbuffer], {type: 'audio/vnd.wave'});

  const url     = (window.URL || window.webkitURL);
  const fileURL = url.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = fileURL;
  a.target      = '_blank';
  a.download    = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  url.revokeObjectURL(fileURL);
}
