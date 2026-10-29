/**
 * Demo page wiring for "revamped SAM".
 *
 * Requires the UMD library build from dist/samjs.js, which exposes
 * the SamJs constructor as a global.
 */

const opts = {
  debug: 1,
  pitch: 64,
  speed: 72,
  mouth: 128,
  throat: 128,
};

document.addEventListener('DOMContentLoaded', function () {
  // Wire up the sliders so they update both the label and the opts object.
  ['speed', 'pitch', 'mouth', 'throat'].forEach(function (key) {
    const slider = document.getElementById(key);
    const label  = document.getElementById(key + '-lbl');

    slider.onchange = function (event) {
      opts[event.target.id] = event.target.value;
      label.innerText =
        event.target.id.charAt(0).toUpperCase()
        + event.target.id.substr(1)
        + ': '
        + event.target.value;
    };

    slider.value = opts[key];
  });

  // "Preview" button: synthesize the text and play it over the speakers.
  document.getElementById('fmm2').addEventListener('click', function (event) {
    event.preventDefault();
    new SamJs(opts).speak(document.getElementById('speechinput').value);
  });

  // "Download" button: synthesize the text and download it as a .wav file.
  document.getElementById('fmm').addEventListener('click', function (event) {
    event.preventDefault();
    new SamJs(opts).download(document.getElementById('speechinput').value);
  });
});
