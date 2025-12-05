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

const handleBrightnessChange = (e) => {
  const val = parseFloat(e.target.value);
  setBrightness(val);

  const video = videoRef.current;
  if (!video || !video.srcObject) return;
  const [track] = video.srcObject.getVideoTracks();
  if (!track.getCapabilities) return;

  const capabilities = track.getCapabilities();
  if (!capabilities.exposureCompensation) return;

  const min = capabilities.exposureCompensation.min;
  const max = capabilities.exposureCompensation.max;

  track.applyConstraints({
    advanced: [{ exposureCompensation: min + val * (max - min) }]
  }).catch((err) => console.warn("Exposure not supported:", err));
};


  const [isTaking, setIsTaking] = useState(false);
  const [modalPhoto, setModalPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // الخلفية افتراضي

  useEffect(() => {
    try {
      localStorage.setItem("photos", JSON.stringify(photos));
    } catch {}
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
    } catch {}

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
    } catch {}

    const data = canvas.toDataURL("image/png");
    setPhotos((p) => [data, ...p]);

    setTimeout(() => setIsTaking(false), 220);
  };

  const downloadOne = (dataUrl, index) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `photo_${index + 1}.png`;
    a.click();
  };

  const deleteOne = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (modalPhoto && modalPhoto.index === index) setModalPhoto(null);
  };

  const downloadAll = () => {
    photos.forEach((d, i) => {
      const a = document.createElement("a");
      a.href = d;
      a.download = `photo_${i + 1}.png`;
      a.click();
    });
  };

  const deleteAll = () => {
    if (!confirm("متأكد تمسح كل الصور؟")) return;
    setPhotos([]);
    setModalPhoto(null);
    try {
      localStorage.removeItem("photos");
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex flex-col items-center p-6">
      <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
        📸 كاميرا الكنيسة
      </h1>
      <p className="text-sm text-slate-300 mb-8 max-w-xl text-center">
        صور احترافية مع فريم و لوجو — التقط، عاين، نزّل أو امسح. الصور محفوظة محليًا بأمان.
      </p>

<div className="flex flex-col items-center gap-8 w-full max-w-6xl">
  <div className="w-full max-w-xs flex flex-col items-center relative">
    {/* Camera Section */}
    <div className="relative w-72 h-128 rounded-3xl overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        onClick={handleFocus} // لمس للفوكس فقط
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

      {/* Brightness Slider */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={brightness}
        onChange={handleBrightnessChange}
        className="absolute top-1/2 right-[-30px] w-28 h-2 rotate-90 origin-center accent-yellow-400"
      />
    </div>

    {/* Buttons under camera */}
    <div className="flex justify-center mt-4 gap-4">
      <button
        onClick={() =>
          setFacingMode(facingMode === "environment" ? "user" : "environment")
        }
        className="px-4 py-2 bg-blue-500 rounded-lg text-white hover:bg-blue-600"
      >
        🔄 اقلب الكاميرا
      </button>
      <button
        onClick={takePhoto}
        disabled={isTaking}
        className={`relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl transform transition-transform active:scale-95 ${
          isTaking ? "animate-pulse" : "hover:scale-110"
        }`}
      >
        <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center shadow-inner">
          <span className="text-2xl">📸</span>
        </div>
      </button>
    </div>
  </div>
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
