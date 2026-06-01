const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const upload = document.getElementById("upload");
const cropWarning = document.getElementById("cropWarning");
const canvasContainer = document.getElementById("canvasContainer");

const brightnessSlider = document.getElementById("brightness");
const contrastSlider   = document.getElementById("contrast");
const saturationSlider = document.getElementById("saturation");
const noiseSlider      = document.getElementById("noise");
const shadowSlider     = document.getElementById("shadow");

const brightnessValue  = document.getElementById("brightnessValue");
const contrastValue    = document.getElementById("contrastValue");
const saturationValue  = document.getElementById("saturationValue");
const noiseValue       = document.getElementById("noiseValue");
const shadowValue      = document.getElementById("shadowValue");

let img = new Image();
let originalImage = "";
let firstUploadedImage = "";
let scale    = 1;
let rotation = 0;
let flip     = 1;
let cropMode = false;
let isDragging = false;
let cropStartX = 0, cropStartY = 0;
let cropEndX   = 0, cropEndY   = 0;

let panMode = false;
let isPanning = false;
let panOffsetX = 0, panOffsetY = 0;
let panStartX  = 0, panStartY  = 0;

const filterList = [
  { key: "grayscale", name: "Grayscale" },
  { key: "blur",      name: "Blur"      },
  { key: "sepia",     name: "Sepia"     },
  { key: "invert",    name: "Invert"    },
  { key: "contrast",  name: "Contrast"  },
  { key: "bright",    name: "Bright"    },
  { key: "cool",      name: "Cool"      },
  { key: "warm",      name: "Warm"      },
  { key: "vintage",   name: "Vintage"   },
  { key: "fade",      name: "Fade"      }
];

let filters = {};
filterList.forEach(f => { filters[f.key] = { active: false, intensity: 0 }; });

let adjustments = {
  brightness: 100,
  contrast:   100,
  saturation: 100,
  noise:      0,
  shadow:     0
};

/* Bangun UI kartu filter secara dinamis */
const filterGrid = document.getElementById("filterGrid");
filterList.forEach(filter => {
  filterGrid.innerHTML += `
    <div class="filter-card" onclick="toggleFilter('${filter.key}',this,event)">
      <div class="filter-preview">
        <canvas id="preview-${filter.key}" width="120" height="120"></canvas>
      </div>
      <div class="filter-name">${filter.name}</div>
      <div class="filter-slider" id="slider-${filter.key}">
        <div class="filter-intensity">
          <span>Intensity</span>
          <span id="value-${filter.key}">0%</span>
        </div>
        <input type="range" min="0" max="100" value="0"
          onclick="event.stopPropagation()"
          oninput="updateFilter('${filter.key}', this.value)">
      </div>
    </div>`;
});

upload.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    img.onload = () => {
      fitPhotoBox(img.width, img.height);
      setTimeout(() => {
        resizeCanvas();
        drawImage();
        generateFilterPreviews();
      }, 50);
    };
    img.src             = event.target.result;
    originalImage       = event.target.result;
    firstUploadedImage  = event.target.result;
  };
  reader.readAsDataURL(file);
});

function resizeCanvas() {
  canvas.width  = canvasContainer.clientWidth  - 40;
  canvas.height = canvasContainer.clientHeight - 40;
}

/* photo-box selalu fixed, tidak berubah ukuran mengikuti rasio gambar */
function fitPhotoBox(imgWidth, imgHeight) {
  canvasContainer.style.flex   = "1";
  canvasContainer.style.width  = "";
  canvasContainer.style.height = "";
}

/* Bangun CSS filter string dari semua adjustment dan filter aktif (kecuali blur) */
function getFilterString() {
  let s = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
  if (filters.grayscale.active) s += ` grayscale(${filters.grayscale.intensity}%)`;
  if (filters.sepia.active)     s += ` sepia(${filters.sepia.intensity}%)`;
  if (filters.invert.active)    s += ` invert(${filters.invert.intensity}%)`;
  if (filters.contrast.active)  s += ` contrast(${100 + filters.contrast.intensity}%)`;
  if (filters.bright.active)    s += ` brightness(${100 + filters.bright.intensity}%)`;
  if (filters.cool.active)      s += ` hue-rotate(${filters.cool.intensity * 2}deg)`;
  if (filters.warm.active)      s += ` sepia(${filters.warm.intensity * 0.6}%) saturate(${100 + filters.warm.intensity}%) hue-rotate(-${filters.warm.intensity / 3}deg)`;
  if (filters.vintage.active)   s += ` sepia(${filters.vintage.intensity * 0.7}%) contrast(${100 + filters.vintage.intensity / 2}%) brightness(${100 - filters.vintage.intensity / 5}%)`;
  if (filters.fade.active) {
    const fv = 100 - (filters.fade.intensity / 2);
    s += ` contrast(${fv}%) saturate(${fv}%) brightness(${100 + filters.fade.intensity / 8}%)`;
  }
  return s;
}

function drawImage() {
  if (!img.src) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const imageAspect  = img.width / img.height;
  const canvasAspect = canvas.width / canvas.height;
  let renderWidth, renderHeight;

  if (imageAspect > canvasAspect) {
    renderWidth  = canvas.width * scale;
    renderHeight = renderWidth / imageAspect;
  } else {
    renderHeight = canvas.height * scale;
    renderWidth  = renderHeight * imageAspect;
  }

  const imgX = canvas.width  / 2 - renderWidth  / 2;
  const imgY = canvas.height / 2 - renderHeight / 2;

  /*
   * Render gambar ke offscreen canvas berukuran TEPAT sama dengan gambar.
   * Blur dimasukkan di sini sehingga tidak bisa bocor keluar batas foto.
   */
  const imgCanvas = document.createElement("canvas");
  imgCanvas.width  = Math.ceil(renderWidth);
  imgCanvas.height = Math.ceil(renderHeight);
  const ictx = imgCanvas.getContext("2d");

  let filterStr = getFilterString();
  if (filters.blur.active && filters.blur.intensity > 0) {
    filterStr += ` blur(${(filters.blur.intensity / 100) * 20}px)`;
  }
  ictx.filter = filterStr;
  ictx.save();
  ictx.scale(flip, 1);
  if (flip === -1) ictx.translate(-imgCanvas.width, 0);
  ictx.drawImage(img, 0, 0, imgCanvas.width, imgCanvas.height);
  ictx.restore();
  ictx.filter = "none";

  /* Shadow/Highlight vignette — source-atop agar hanya mengenai piksel foto */
  if (adjustments.shadow !== 0) {
    const absVal = Math.abs(adjustments.shadow);
    const alpha  = Math.min((absVal / 100) * 0.85, 0.85);
    const scx    = imgCanvas.width  / 2;
    const scy    = imgCanvas.height / 2;
    const r0     = Math.min(imgCanvas.width, imgCanvas.height) * 0.15;
    const r1     = Math.max(imgCanvas.width, imgCanvas.height) * 0.80;
    const grad   = ictx.createRadialGradient(scx, scy, r0, scx, scy, r1);
    if (adjustments.shadow > 0) {
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
    } else {
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, `rgba(255,255,255,${alpha})`);
    }
    ictx.save();
    ictx.globalCompositeOperation = "source-atop";
    ictx.fillStyle = grad;
    ictx.fillRect(0, 0, imgCanvas.width, imgCanvas.height);
    ictx.restore();
  }

  ctx.save();
  ctx.translate(canvas.width / 2 + panOffsetX, canvas.height / 2 + panOffsetY);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(imgCanvas, -imgCanvas.width / 2, -imgCanvas.height / 2);
  ctx.restore();
  ctx.filter = "none";

  /* Noise/Smooth langsung pada pixel data di area gambar */
  if (adjustments.noise !== 0) {
    const nx = Math.max(0, Math.floor(imgX));
    const ny = Math.max(0, Math.floor(imgY));
    const nw = Math.min(canvas.width  - nx, Math.ceil(renderWidth));
    const nh = Math.min(canvas.height - ny, Math.ceil(renderHeight));
    if (nw > 0 && nh > 0) {
      const imageData = ctx.getImageData(nx, ny, nw, nh);
      const data = imageData.data;
      if (adjustments.noise > 0) {
        const amt = adjustments.noise * 1.5;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          const r = (Math.random() - 0.5) * amt;
          data[i]     = Math.max(0, Math.min(255, data[i]     + r));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + r));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + r));
        }
      } else {
        const strength = Math.abs(adjustments.noise) / 100;
        const copy = new Uint8ClampedArray(data);
        for (let y = 1; y < nh - 1; y++) {
          for (let x = 1; x < nw - 1; x++) {
            const i = (y * nw + x) * 4;
            if (copy[i + 3] === 0) continue;
            for (let c = 0; c < 3; c++) {
              const avg = (copy[i - 4 + c] + copy[i + 4 + c] + copy[i - nw * 4 + c] + copy[i + nw * 4 + c] + copy[i + c]) / 5;
              data[i + c] = Math.round(copy[i + c] * (1 - strength) + avg * strength);
            }
          }
        }
      }
      ctx.putImageData(imageData, nx, ny);
    }
  }

  if (cropMode && isDragging) {
    const x = Math.min(cropStartX, cropEndX);
    const y = Math.min(cropStartY, cropEndY);
    const w = Math.abs(cropEndX - cropStartX);
    const h = Math.abs(cropEndY - cropStartY);
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.setLineDash([8]);
    ctx.strokeRect(x, y, w, h);
  }
}

/* Render preview thumbnail tiap filter dengan aspect ratio cover */
function generateFilterPreviews() {
  if (!img.src) return;
  filterList.forEach(filter => {
    const preview = document.getElementById(`preview-${filter.key}`);
    const pctx    = preview.getContext("2d");
    pctx.clearRect(0, 0, preview.width, preview.height);

    const previewFilters = {
      grayscale: "grayscale(100%)",
      blur:      "blur(2px)",
      sepia:     "sepia(100%)",
      invert:    "invert(100%)",
      contrast:  "contrast(180%)",
      bright:    "brightness(160%)",
      cool:      "hue-rotate(180deg)",
      warm:      "sepia(60%) saturate(140%)",
      vintage:   "sepia(40%) contrast(120%)",
      fade:      "opacity(70%)"
    };
    pctx.filter = previewFilters[filter.key] || "none";

    const pw = preview.width, ph = preview.height;
    const ir = img.width / img.height;
    const pr = pw / ph;
    let sx, sy, sw, sh;
    if (ir > pr) {
      sw = img.height * pr; sh = img.height;
      sx = (img.width - sw) / 2; sy = 0;
    } else {
      sw = img.width; sh = img.width / pr;
      sx = 0; sy = (img.height - sh) / 2;
    }
    pctx.drawImage(img, sx, sy, sw, sh, 0, 0, pw, ph);
  });
}

brightnessSlider.addEventListener("input", () => {
  adjustments.brightness = Number(brightnessSlider.value) + 100;
  brightnessValue.innerText = brightnessSlider.value + "%";
  drawImage();
});
contrastSlider.addEventListener("input", () => {
  adjustments.contrast = Number(contrastSlider.value) + 100;
  contrastValue.innerText = contrastSlider.value + "%";
  drawImage();
});
saturationSlider.addEventListener("input", () => {
  adjustments.saturation = Number(saturationSlider.value) + 100;
  saturationValue.innerText = saturationSlider.value + "%";
  drawImage();
});
noiseSlider.addEventListener("input", () => {
  adjustments.noise = Number(noiseSlider.value);
  noiseValue.innerText = noiseSlider.value + "%";
  drawImage();
});
shadowSlider.addEventListener("input", () => {
  adjustments.shadow = Number(shadowSlider.value);
  shadowValue.innerText = shadowSlider.value + "%";
  drawImage();
});

function toggleFilter(name, card, event) {
  if (event.target.closest(".filter-slider")) return;
  filters[name].active = !filters[name].active;
  const slider = document.getElementById(`slider-${name}`);
  if (filters[name].active) {
    card.classList.add("active");
    slider.classList.add("active");
  } else {
    card.classList.remove("active");
    slider.classList.remove("active");
    filters[name].intensity = 0;
    slider.querySelector("input").value = 0;
    document.getElementById(`value-${name}`).innerText = "0%";
  }
  drawImage();
}

function updateFilter(name, value) {
  filters[name].intensity = Number(value);
  document.getElementById(`value-${name}`).innerText = value + "%";
  drawImage();
}

function activateTool(button) {
  if (button.classList.contains("active")) {
    button.classList.remove("active");
    return;
  }
  document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
  button.classList.add("active");
}

function toggleRotateTool(button) {
  const wrap = document.getElementById("rotateSliderWrap");
  if (wrap.style.display === "none") {
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";
    button.classList.add("active");
  } else {
    wrap.style.display = "none";
    button.classList.remove("active");
  }
}

function onRotationSlider(val) {
  rotation = Number(val);
  document.getElementById("rotationDeg").innerText = val + "°";
  drawImage();
}

function flipImage() {
  flip *= -1;
  drawImage();
}

function zoomIn()  { scale += 0.1; drawImage(); }
function zoomOut() { scale = Math.max(0.2, scale - 0.1); drawImage(); }

function resetImage() {
  if (!firstUploadedImage) return;
  scale = 1; rotation = 0; flip = 1;
  cropMode = false; isDragging = false;
  panMode = false; panOffsetX = 0; panOffsetY = 0;
  canvas.classList.remove("pan-mode", "panning");
  adjustments = { brightness: 100, contrast: 100, saturation: 100, noise: 0, shadow: 0 };

  brightnessSlider.value = 0; contrastSlider.value = 0;
  saturationSlider.value = 0; noiseSlider.value = 0; shadowSlider.value = 0;
  brightnessValue.innerText = "0%"; contrastValue.innerText = "0%";
  saturationValue.innerText = "0%"; noiseValue.innerText = "0%"; shadowValue.innerText = "0%";

  const rotSlider = document.getElementById("rotationSlider");
  if (rotSlider) rotSlider.value = 0;
  const rotDeg = document.getElementById("rotationDeg");
  if (rotDeg) rotDeg.innerText = "0°";

  filterList.forEach(f => {
    filters[f.key].active    = false;
    filters[f.key].intensity = 0;
    const box = document.getElementById(`slider-${f.key}`);
    box.classList.remove("active");
    box.querySelector("input").value = 0;
    document.getElementById(`value-${f.key}`).innerText = "0%";
  });
  document.querySelectorAll(".filter-card").forEach(c => c.classList.remove("active"));
  document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));

  const resetImg = new Image();
  resetImg.onload = () => {
    img = resetImg;
    originalImage = firstUploadedImage;
    fitPhotoBox(img.width, img.height);
    setTimeout(() => { drawImage(); generateFilterPreviews(); }, 50);
  };
  resetImg.src = firstUploadedImage;
}

function downloadImage() {
  const link = document.createElement("a");
  link.download = "edited-image.png";
  link.href = canvas.toDataURL();
  link.click();
}

function activateCrop(button) {
  cropMode = !cropMode;
  if (cropMode) {
    panMode = false;
    canvas.classList.remove("pan-mode");
    activateTool(button);
    cropWarning.style.display = "block";
    setTimeout(() => { cropWarning.style.display = "none"; }, 3000);
  } else {
    button.classList.remove("active");
  }
}

function activatePan(button) {
  panMode = !panMode;
  if (panMode) {
    cropMode = false;
    canvas.classList.remove("crop-mode");
    activateTool(button);
    canvas.classList.add("pan-mode");
  } else {
    button.classList.remove("active");
    canvas.classList.remove("pan-mode");
  }
}

canvas.addEventListener("mousedown", e => {
  if (!cropMode) return;
  isDragging = true;
  const rect = canvas.getBoundingClientRect();
  cropStartX = e.clientX - rect.left;
  cropStartY = e.clientY - rect.top;
  cropEndX = cropStartX; cropEndY = cropStartY;
});

canvas.addEventListener("mousemove", e => {
  if (!cropMode || !isDragging) return;
  const rect = canvas.getBoundingClientRect();
  cropEndX = e.clientX - rect.left;
  cropEndY = e.clientY - rect.top;
  drawImage();
});

canvas.addEventListener("mouseup", () => {
  if (!cropMode || !isDragging) return;
  isDragging = false;
  applyCrop();
});

/* Pan events */
canvas.addEventListener("mousedown", e => {
  if (!panMode) return;
  isPanning = true;
  panStartX = e.clientX - panOffsetX;
  panStartY = e.clientY - panOffsetY;
  canvas.classList.add("panning");
});
canvas.addEventListener("mousemove", e => {
  if (!panMode || !isPanning) return;
  panOffsetX = e.clientX - panStartX;
  panOffsetY = e.clientY - panStartY;
  drawImage();
});
canvas.addEventListener("mouseup", () => {
  if (!panMode) return;
  isPanning = false;
  canvas.classList.remove("panning");
});
canvas.addEventListener("mouseleave", () => {
  if (panMode) { isPanning = false; canvas.classList.remove("panning"); }
});

function applyCrop() {
  const x = Math.min(cropStartX, cropEndX);
  const y = Math.min(cropStartY, cropEndY);
  const w = Math.abs(cropEndX - cropStartX);
  const h = Math.abs(cropEndY - cropStartY);
  if (w < 20 || h < 20) { drawImage(); return; }

  const tmp    = document.createElement("canvas");
  const tmpCtx = tmp.getContext("2d");
  tmp.width = w; tmp.height = h;
  tmpCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  const cropped = tmp.toDataURL();
  img.onload = () => { drawImage(); generateFilterPreviews(); };
  img.src = cropped;
  originalImage = cropped;
  cropMode = false;
  document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
}

window.addEventListener("resize", () => {
  if (img.src && img.width) {
    fitPhotoBox(img.width, img.height);
    setTimeout(() => { resizeCanvas(); drawImage(); }, 50);
  } else {
    resizeCanvas(); drawImage();
  }
});

resizeCanvas();
