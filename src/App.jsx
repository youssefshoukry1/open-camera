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

  const [isTaking, setIsTaking] = useState(false);
  const [modalPhoto, setModalPhoto] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem("photos", JSON.stringify(photos));
    } catch {}
  }, [photos]);

  useEffect(() => {
    let mounted = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
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
  }, []);

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

    // draw video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // draw frame
    try {
      const frameImg = new Image();
      frameImg.src = "/frame.png";
      await new Promise((res) => {
        frameImg.onload = () => res(true);
        frameImg.onerror = () => res(false);
      });
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    } catch {}

    // draw logo
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

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl items-start">
        {/* Camera Section */}
        <div className="flex-shrink-0 w-full lg:w-80">
          <div className="relative w-full aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
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
          </div>

          <div className="flex justify-center mt-6">
            <button
              onClick={takePhoto}
              disabled={isTaking}
              className={`relative flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl transform transition-transform active:scale-95 ${isTaking ? "animate-pulse" : "hover:scale-110"}`}
            >
              <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center shadow-inner">
                <span className="text-3xl">📸</span>
              </div>
            </button>
          </div>

          <div className="w-full mt-6 flex gap-3 justify-center">
            <button
              onClick={downloadAll}
              disabled={photos.length === 0}
              className="flex-1 px-4 py-2 bg-green-500 rounded-xl text-white font-semibold hover:opacity-90 disabled:opacity-40"
            >
              ⬇️ تحميل الكل
            </button>
            <button
              onClick={deleteAll}
              disabled={photos.length === 0}
              className="flex-1 px-4 py-2 bg-red-500 rounded-xl text-white font-semibold hover:opacity-90 disabled:opacity-40"
            >
              🗑 حذف الكل
            </button>
          </div>
        </div>

        {/* Gallery Section */}
        <section className="flex-1 w-full">
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 rounded-2xl bg-slate-800/30">
              <span className="text-5xl mb-3">📷</span>
              <p className="text-slate-400 text-center">ماعندكش صور بعد — ابدأ الآن!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
              {photos.map((src, idx) => (
                <div key={idx} className="relative cursor-pointer group" onClick={() => setModalPhoto({ src, index: idx })}>
                  <img
                    src={src}
                    alt={`photo-${idx}`}
                    className="w-full aspect-[9/16] object-cover rounded-lg shadow-lg transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Hover Buttons */}
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
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Modal */}
      {modalPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setModalPhoto(null)}>
          <div className="bg-slate-900 rounded-2xl overflow-hidden max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 flex justify-between items-center bg-slate-800">
              <h3 className="text-white font-bold">معاينة الصورة</h3>
              <button onClick={() => setModalPhoto(null)} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white">✕ إغلاق</button>
            </div>
            <div className="p-4 bg-black flex justify-center">
              <img src={modalPhoto.src} alt="preview" className="max-h-[80vh] w-auto rounded-lg" />
            </div>
            <div className="p-4 flex gap-3">
              <button onClick={() => downloadOne(modalPhoto.src, modalPhoto.index)} className="flex-1 px-4 py-2 bg-green-500 rounded-lg text-white font-semibold hover:opacity-90">
                ⬇️ تحميل
              </button>
              <button onClick={() => { deleteOne(modalPhoto.index); setModalPhoto(null); }} className="flex-1 px-4 py-2 bg-red-500 rounded-lg text-white font-semibold hover:opacity-90">
                🗑 حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
