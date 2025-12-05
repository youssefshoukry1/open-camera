import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [photos, setPhotos] = useState(() => {
    try {
      const saved = localStorage.getItem("photos");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [brightness, setBrightness] = useState(0.5);
  const sliderRef = useRef(null);

  const setBrightnessValue = (val) => {
    const v = Math.max(0, Math.min(1, val));
    setBrightness(v);

    const video = videoRef.current;
    if (!video || !video.srcObject) return;
    const [track] = video.srcObject.getVideoTracks();
    if (!track || !track.getCapabilities) return;

    const capabilities = track.getCapabilities();
    if (!capabilities.exposureCompensation) return;

    const min = capabilities.exposureCompensation.min;
    const max = capabilities.exposureCompensation.max;

    track.applyConstraints({
      advanced: [{ exposureCompensation: min + v * (max - min) }]
    }).catch((err) => console.warn("Exposure not supported:", err));
  };

  const handleBrightnessChange = (e) => {
    const val = parseFloat(e.target.value);
    setBrightnessValue(val);
  };

  const updateFromPointer = (clientY, pointerTarget) => {
    const el = sliderRef.current || pointerTarget;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    const pct = 1 - y / rect.height;
    setBrightnessValue(pct);
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromPointer(e.clientY, e.currentTarget);
  };

  const handlePointerMove = (e) => {
    if (e.pressure === 0 && e.buttons === 0) return;
    updateFromPointer(e.clientY, e.currentTarget);
  };

  const handlePointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { }
  };


  const [isTaking, setIsTaking] = useState(false);
  const [modalPhoto, setModalPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // الخلفية افتراضي

  useEffect(() => {
    try {
      localStorage.setItem("photos", JSON.stringify(photos));
    } catch { }
  }, [photos]);

  // تشغيل الكاميرا
  useEffect(() => {
    let mounted = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (!mounted) return;
        videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera error:", err);
        alert("مفيش إذن للكاميرا أو الكاميرا مش متاحة: " + err.message);
      }
    }
    start();

    return () => {
      mounted = false;
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  // لمس الفيديو لتفعيل الفوكس حسب مكان اللمس
  const handleFocus = async (e) => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;

    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const [track] = video.srcObject.getVideoTracks();
    if (!track.getCapabilities) return;

    const capabilities = track.getCapabilities();

    const constraints = { advanced: [] };

    // الفوكس بس
    if (capabilities.focusMode && capabilities.focusDistance) {
      constraints.advanced.push({
        focusMode: "manual",
        focusDistance: capabilities.focusDistance.max * 0.5, // نص المدى أو ممكن تخليه حسب y
      });
    }

    // **شيلنا الـ exposure والـ torch التلقائي**
    if (constraints.advanced.length > 0) {
      try {
        await track.applyConstraints(constraints);
      } catch (err) {
        console.warn("Constraints not supported:", err);
      }
    }
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) {
      alert("استنى ثواني لحد ما الكاميرا تجهز.");
      return;
    }

    setIsTaking(true);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const frameImg = new Image();
      frameImg.src = "/frame.png";
      await new Promise((res) => {
        frameImg.onload = () => res(true);
        frameImg.onerror = () => res(false);
      });
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    } catch { }

    try {
      const logoImg = new Image();
      logoImg.src = "/logo.jpg";
      await new Promise((res) => {
        logoImg.onload = () => res(true);
        logoImg.onerror = () => res(false);
      });
      const logoWidth = canvas.width * 0.18;
      const logoHeight = logoWidth * (logoImg.height / logoImg.width);
      ctx.drawImage(logoImg, 10, 10, logoWidth, logoHeight);
    } catch { }

    const data = canvas.toDataURL("image/png");
    setPhotos((p) => [data, ...p]);

    setTimeout(() => setIsTaking(false), 220);
  };

  const downloadOne = (dataUrl, index) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `مسرحية-${index + 1}.png`;
    a.click();
  };

  const deleteOne = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (modalPhoto && modalPhoto.index === index) setModalPhoto(null);
  };

  const downloadAll = () => {
    // Stagger downloads slightly and append anchors to DOM to improve reliability
    photos.forEach((d, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = d;
        a.download = `مسرحية-${i + 1}.png`;
        // append so some browsers accept the click
        document.body.appendChild(a);
        a.click();
        // cleanup
        a.remove();
      }, i * 180);
    });
  };

  const deleteAll = () => {
    if (!confirm("متأكد تمسح كل الصور؟")) return;
    setPhotos([]);
    setModalPhoto(null);
    try {
      localStorage.removeItem("photos");
    } catch { }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex flex-col items-center p-6">
      <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent py-6">
        ♟️ مسرحية اللعبة
      </h1>


      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl">
        {/* Camera + Buttons */}
        <div className="flex-shrink-0 w-full lg:w-80 flex flex-col items-center">
          <div className="relative w-72 h-128 rounded-3xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onClick={handleFocus}
              style={{ filter: `brightness(${0.85 + brightness * 0.3})`, transition: 'filter 160ms linear' }}
            />
            <img
              src="/frame.png"
              alt="frame overlay"
              className="pointer-events-none absolute inset-0 w-full h-full object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <img
              src="/logo.jpg"
              alt="logo"
              className="absolute left-4 top-4 w-20 h-20 object-contain rounded-lg"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            {/* Small brightness control inside the frame (no rotation) */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-40">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-white">
                <circle cx="12" cy="12" r="3.5" strokeWidth="1.5" />
                <path strokeWidth="1.2" d="M12 2v1.5M12 20.5V22M4.2 4.2l1.06 1.06M18.74 18.74l1.06 1.06M2 12h1.5M20.5 12H22M4.2 19.8l1.06-1.06M18.74 5.26l1.06-1.06" />
              </svg>

              {/* Custom vertical slider: small modern track + larger invisible hit area for touch */}
              <div
                ref={sliderRef}
                className="w-10 h-40 bg-transparent flex items-center justify-center slider-container"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onTouchStart={(e) => { e.preventDefault(); updateFromPointer(e.touches[0].clientY, sliderRef.current); }}
                onTouchMove={(e) => { e.preventDefault(); updateFromPointer(e.touches[0].clientY, sliderRef.current); }}
                onTouchEnd={(e) => { /* noop - pointer handlers handle release */ }}
              >
                <div className="relative w-1.5 h-full rounded-full slider-track">
                  <div
                    className="absolute slider-thumb"
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(brightness * 100)}
                    style={{ left: '50%', top: `${(1 - brightness) * 100}%`, transform: 'translate(-50%, -50%)', width: 14, height: 14 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Controls: Flip + Capture (primary) */}
          <div className="relative w-full mt-4">
            <button
              onClick={() => setFacingMode(facingMode === "environment" ? "user" : "environment")}
              className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              aria-label="Flip camera"
            >
              {/* clearer swap icon: arrows left/right with camera center */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l-1.5-1.5M21 12h-4l1.5 1.5" />
                <rect x="8.5" y="7.5" width="7" height="5" rx="1" strokeWidth="1.4" />
                <circle cx="12" cy="10" r="1.4" strokeWidth="1.2" />
              </svg>
            </button>

            <div className="flex justify-center">
              <button
                onClick={takePhoto}
                disabled={isTaking}
                className={`relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl transform transition-all active:scale-95 ${isTaking ? "animate-pulse" : "hover:scale-105"}`}
                aria-label="Capture photo"
              >
                <div className="bg-white w-18 h-18 rounded-full flex items-center justify-center shadow-inner" style={{ width: 64, height: 64 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="3" strokeWidth="1.6" />
                    <path strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </button>
            </div>
          </div>

          {/* Secondary actions under the capture button */}
          <div className="flex flex-col items-center gap-2 mt-3">
            <button
              onClick={downloadAll}
              disabled={photos.length === 0}
              className="w-40 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-lg border border-white/6 text-sm text-white transition"
              aria-disabled={photos.length === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span className="text-sm">تحميل الكل</span>
            </button>

            <button
              onClick={deleteAll}
              disabled={photos.length === 0}
              className="w-40 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-lg text-sm text-white transition"
              aria-disabled={photos.length === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 11v6m4-6v6M9 7l1-3h4l1 3" />
              </svg>
              <span className="text-sm">حذف الكل</span>
            </button>
          </div>
        </div>

        {/* Gallery */}
        <section className="flex-1 w-full">
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 rounded-2xl bg-slate-800/30">
              <span className="text-5xl mb-3">📷</span>
              <p className="text-slate-400 text-center">ماعندكش صور بعد — ابدأ الآن!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
              {photos.map((src, idx) => (
                <div
                  key={idx}
                  className="relative cursor-pointer group"
                  onClick={() => setModalPhoto({ src, index: idx })}
                >
                  <img
                    src={src}
                    alt={`photo-${idx}`}
                    className="w-full aspect-[9/16] object-cover rounded-lg shadow-lg transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2 gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadOne(src, idx); }}
                      className="px-2 py-1 bg-green-500 rounded text-white text-sm font-semibold hover:bg-green-600"
                    >
                      ⬇️ تحميل
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteOne(idx); }}
                      className="px-2 py-1 bg-red-500 rounded text-white text-sm font-semibold hover:bg-red-600"
                    >
                      🗑 حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* brightness control replaced: modern compact slider styles */}
        <style>{`
    .slider-container { touch-action: none; -webkit-user-select:none; user-select:none; }
    .slider-track { background: linear-gradient(to top, #06b6d4 0%, #6366f1 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); border-radius:999px; width:6px; margin:0 auto; }
    .slider-thumb { position: absolute; left:50%; border-radius:50%; background: linear-gradient(180deg,#ffffff,#eef2ff); box-shadow: 0 6px 14px rgba(0,0,0,0.35); transition: top 130ms cubic-bezier(.2,.9,.3,1), transform 110ms ease; border: 2px solid rgba(99,102,241,0.12); }
    .slider-thumb:active { transform: translate(-50%, -50%) scale(1.08); box-shadow: 0 10px 22px rgba(99,102,241,0.18); }
    .slider-container:active .slider-track { filter: brightness(1.02); }
    @media (max-width:640px) { .slider-container { width: 12px; } .slider-track { height: 160px; } }
  `}</style>
      </div>


      <canvas ref={canvasRef} className="hidden" />

      {modalPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setModalPhoto(null)}
        >
          <div
            className="bg-slate-900 rounded-2xl overflow-hidden max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex justify-between items-center bg-slate-800">
              <h3 className="text-white font-bold">معاينة الصورة</h3>
              <button
                onClick={() => setModalPhoto(null)}
                className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
              >
                ✕ إغلاق
              </button>
            </div>
            <div className="p-4 bg-black flex justify-center">
              <img src={modalPhoto.src} alt="preview" className="max-h-[80vh] w-auto rounded-lg" />
            </div>
            <div className="p-4 flex gap-3">
              <button
                onClick={() => downloadOne(modalPhoto.src, modalPhoto.index)}
                className="flex-1 px-4 py-2 bg-green-500 rounded-lg text-white font-semibold hover:opacity-90"
              >
                ⬇️ تحميل
              </button>
              <button
                onClick={() => {
                  deleteOne(modalPhoto.index);
                  setModalPhoto(null);
                }}
                className="flex-1 px-4 py-2 bg-red-500 rounded-lg text-white font-semibold hover:opacity-90"
              >
                🗑 حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
