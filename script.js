let isRunning = false;
let lightTimer = null;
let stepIndex = 0;

let audioCtx = null;
let analyser = null;
let micStream = null;
let animId = null;

// 9 Preset Color Palettes for Sound Reactive Mode
const palettes = {
  cyberpunk: ["#ff007f", "#00f5d4", "#7b2cbf"],
  fire: ["#ff0000", "#ff6600", "#ffcc00"],
  ocean: ["#001219", "#0077b6", "#90e0ef"],
  matrix: ["#003300", "#00cc00", "#66ff66"],
  sunset: ["#d00000", "#ff4800", "#ffb703"],
  party: ["#7209b7", "#f72585", "#4cc9f0"],
  policeStyle: ["#ff0000", "#0022ff", "#ffffff"],
  gold: ["#583101", "#ffb703", "#ffe6a7"],
  toxic: ["#38b000", "#70e000", "#ccff00"]
};

const discoColors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff"];

function updateSpeedText() {
  const rawVal = parseInt(document.getElementById('speedSlider').value);
  const speedTxt = document.getElementById('speedVal');
  
  if (rawVal <= 150) speedTxt.innerText = "Very Slow";
  else if (rawVal <= 300) speedTxt.innerText = "Slow";
  else if (rawVal <= 500) speedTxt.innerText = "Medium";
  else if (rawVal <= 700) speedTxt.innerText = "Fast";
  else speedTxt.innerText = "Ultra Fast";

  if (isRunning && !isAudioMode()) { stopLights(); startLights(); }
}

function updateMasterSensText() {
  const val = parseFloat(document.getElementById('masterSensSlider').value).toFixed(1);
  document.getElementById('masterSensVal').innerText = val + "x";
}

function updateFreqText() {
  document.getElementById('bassVal').innerText = parseFloat(document.getElementById('bassSens').value).toFixed(1) + "x";
  document.getElementById('midVal').innerText = parseFloat(document.getElementById('midSens').value).toFixed(1) + "x";
  document.getElementById('trebleVal').innerText = parseFloat(document.getElementById('trebleSens').value).toFixed(1) + "x";
}

function updateBrightness() {
  const val = document.getElementById('brightSlider').value;
  const brightTxt = document.getElementById('brightVal');
  
  if (val == 100) brightTxt.innerText = "100% (Full)";
  else if (val <= 30) brightTxt.innerText = val + "% (Dim)";
  else brightTxt.innerText = val + "%";

  document.getElementById('lightDisplay').style.opacity = val / 100;
}

function updateShape() {
  const shape = document.getElementById('shapePattern').value;
  const overlay = document.getElementById('shapeOverlay');
  overlay.className = "shape-overlay";
  if (shape !== 'none') {
    overlay.classList.add('shape-' + shape);
    overlay.style.display = 'block';
  } else {
    overlay.style.display = 'none';
  }
}

function toggleSoundColorType() {
  const type = document.getElementById('soundColorType').value;
  document.getElementById('paletteBlock').style.display = (type === 'palette') ? 'block' : 'none';
}

function changeMode() {
  const mode = document.getElementById('lightMode').value;
  
  document.getElementById('soundColorBlock').style.display = (mode === 'sound') ? 'block' : 'none';
  document.getElementById('paletteBlock').style.display = (mode === 'sound' && document.getElementById('soundColorType').value === 'palette') ? 'block' : 'none';
  document.getElementById('freqColorBlock').style.display = (mode === 'freq') ? 'block' : 'none';
  document.getElementById('customColorBlock').style.display = (mode === 'custom') ? 'block' : 'none';
  
  if (isAudioMode()) {
    document.getElementById('masterSensBlock').style.display = 'block';
    document.getElementById('speedControlBlock').style.display = 'none';
  } else {
    document.getElementById('masterSensBlock').style.display = 'none';
    document.getElementById('speedControlBlock').style.display = 'block';
  }

  if (isRunning) { stopLights(); startLights(); }
}

function isAudioMode() {
  const mode = document.getElementById('lightMode').value;
  return mode === 'freq' || mode === 'sound' || mode === 'beat';
}

function toggleLights() {
  if (isRunning) stopLights();
  else startLights();
}

async function startLights() {
  isRunning = true;
  document.getElementById('startBtn').innerText = "Stop DJ Lights";
  document.getElementById('startBtn').style.backgroundColor = "#d32f2f";
  document.getElementById('lightText').style.display = "none";

  if (isAudioMode()) {
    await initAudio();
  } else {
    runLightEffect();
  }
}

function stopLights() {
  isRunning = false;
  clearTimeout(lightTimer);
  if (animId) cancelAnimationFrame(animId);

  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }

  document.getElementById('startBtn').innerText = "Start DJ Lights";
  document.getElementById('startBtn').style.backgroundColor = "#1565c0";
  document.getElementById('lightText').style.display = "block";
  document.getElementById('lightDisplay').style.backgroundColor = "#0d47a1";
}

async function initAudio() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, 
      video: false 
    });
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512; 
    analyser.smoothingTimeConstant = 0.2; 

    const source = audioCtx.createMediaStreamSource(micStream);
    source.connect(analyser);

    processAudio();
  } catch (err) {
    alert("Microphone Access Required for Sound & Frequency Modes!");
    stopLights();
  }
}

function processAudio() {
  if (!isRunning || !analyser) return;

  const display = document.getElementById('lightDisplay');
  const mode = document.getElementById('lightMode').value;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  const masterSens = parseFloat(document.getElementById('masterSensSlider').value);

  if (mode === 'sound') {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    let average = (sum / dataArray.length) * masterSens;

    const soundType = document.getElementById('soundColorType').value;

    if (soundType === 'hsl') {
      const hue = Math.floor((average * 5) % 360);
      const lightness = Math.min(85, Math.max(5, average * 1.5));
      display.style.backgroundColor = `hsl(${hue}, 100%, ${lightness}%)`;
    } else {
      const selectedPaletteKey = document.getElementById('colorPaletteSelect').value;
      const currentPalette = palettes[selectedPaletteKey] || palettes.cyberpunk;

      if (average < 5) {
        display.style.backgroundColor = "#000000";
      } else if (average < 25) {
        display.style.backgroundColor = currentPalette[0];
      } else if (average < 55) {
        display.style.backgroundColor = currentPalette[1];
      } else {
        display.style.backgroundColor = currentPalette[2];
      }
    }
  }
  else if (mode === 'freq') {
    let bass = 0, mid = 0, treble = 0;
    
    for (let i = 0; i < 8; i++) bass += dataArray[i];             
    for (let i = 8; i < 60; i++) mid += dataArray[i];             
    for (let i = 60; i < bufferLength; i++) treble += dataArray[i]; 

    const bassSensVal = parseFloat(document.getElementById('bassSens').value) * masterSens;
    const midSensVal = parseFloat(document.getElementById('midSens').value) * masterSens;
    const trebleSensVal = parseFloat(document.getElementById('trebleSens').value) * masterSens;

    bass = (bass / 8) * bassSensVal;
    mid = (mid / 52) * midSensVal;
    treble = (treble / (bufferLength - 60)) * trebleSensVal;

    const cBass = document.getElementById('bassColor').value;
    const cMid = document.getElementById('midColor').value;
    const cTreble = document.getElementById('trebleColor').value;

    let maxVal = Math.max(bass, mid, treble);

    if (maxVal > 3) { 
      if (maxVal === bass) display.style.backgroundColor = cBass;
      else if (maxVal === mid) display.style.backgroundColor = cMid;
      else display.style.backgroundColor = cTreble;
    } else {
      display.style.backgroundColor = "#000000"; 
    }
  }
  else if (mode === 'beat') {
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += dataArray[i];
    let bassAverage = (sum / 8) * masterSens;

    if (bassAverage > 12) {
      stepIndex = (stepIndex + 1) % discoColors.length;
      display.style.backgroundColor = discoColors[stepIndex];
    } else {
      display.style.backgroundColor = "#000000";
    }
  }

  animId = requestAnimationFrame(processAudio);
}

function runLightEffect() {
  if (!isRunning) return;

  const display = document.getElementById('lightDisplay');
  const mode = document.getElementById('lightMode').value;
  const rawVal = parseInt(document.getElementById('speedSlider').value);
  const delay = 850 - rawVal; 

  if (mode === 'strobe') {
    stepIndex = (stepIndex + 1) % 2;
    display.style.backgroundColor = stepIndex === 0 ? "#ffffff" : "#000000";
  } 
  else if (mode === 'disco') {
    stepIndex = (stepIndex + 1) % discoColors.length;
    display.style.backgroundColor = discoColors[stepIndex];
  } 
  else if (mode === 'heartbeat') {
    stepIndex = (stepIndex + 1) % 4;
    const reds = ["#ff0000", "#990000", "#ff3333", "#330000"];
    display.style.backgroundColor = reds[stepIndex];
  } 
  else if (mode === 'emergency' || mode === 'police') {
    stepIndex = (stepIndex + 1) % 2;
    display.style.backgroundColor = stepIndex === 0 ? "#ff0000" : "#0022ff";
  } 
  else if (mode === 'rainbow') {
    const hue = (stepIndex * 25) % 360;
    display.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
    stepIndex++;
  } 
  else if (mode === 'custom') {
    const c1 = document.getElementById('color1').value;
    const c2 = document.getElementById('color2').value;
    const c3 = document.getElementById('color3').value;
    const userColors = [c1, c2, c3];
    stepIndex = (stepIndex + 1) % userColors.length;
    display.style.backgroundColor = userColors[stepIndex];
  }

  lightTimer = setTimeout(runLightEffect, delay);
}

function goFullscreen() {
  const display = document.getElementById('lightDisplay');
  if (!isRunning) startLights();
  
  if (display.requestFullscreen) display.requestFullscreen();
  else if (display.webkitRequestFullscreen) display.webkitRequestFullscreen();
  else if (display.msRequestFullscreen) display.msRequestFullscreen();
}

// Initial Setup
changeMode();
