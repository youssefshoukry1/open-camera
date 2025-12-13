import React, { useEffect, useRef, useState } from "react";
import Compressor from 'compressorjs';
import { getAllPhotos, addPhoto, deletePhoto, deleteAllPhotos as dbDeleteAll } from './db';

// --- Custom Hook for Camera Logic ---
function useCamera(videoRef, facingMode) {
  const [brightness, setBrightness] = useState(0.5);

  useEffect(() => {
    let mounted = true;
    let stream = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (mounted && videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        alert("مفيش إذن للكاميرا أو الكاميرا مش متاحة: " + err.message);
      }
    }
    start();

    return () => {
      mounted = false;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [facingMode, videoRef]);

  const setBrightnessValue = (val) => {
    const v = Math.max(0, Math.min(1, val));
    setBrightness(v);

    const video = videoRef.current;
    const stream = video?.srcObject;
    if (!stream) return;

    const [track] = stream.getVideoTracks();
    if (!track?.getCapabilities) return;

    const capabilities = track.getCapabilities();
    if (!capabilities.exposureCompensation) return;

    const { min, max } = capabilities.exposureCompensation;
    track.applyConstraints({
      advanced: [{ exposureCompensation: min + v * (max - min) }]
    }).catch((err) => console.warn("Exposure not supported:", err));
  };

  const handleFocus = async (e) => {
    const video = videoRef.current;
    const stream = video?.srcObject;
    if (!stream) return;

    const [track] = stream.getVideoTracks();
    if (!track?.getCapabilities) return;

    const capabilities = track.getCapabilities();
    if (capabilities.focusMode && capabilities.focusDistance) {
      try {
        await track.applyConstraints({
          advanced: [{
            focusMode: "manual",
            focusDistance: capabilities.focusDistance.max * 0.5,
          }],
        });
      } catch (err) {
        console.warn("Focus constraint not supported:", err);
      }
    }
  };

  return { brightness, setBrightnessValue, handleFocus };
}

// --- Helper function to load an image ---
const loadImage = (src) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // Resolve with null if image fails to load
    img.src = src;
  });
};

// --- UI Components ---
const CameraView = ({
  videoRef,
  cameraWrapRef,
  isMirrored,
  brightness,
  setBrightnessValue,
  handleFocus,
  onFlip,
  onCapture,
  isTaking,
  assets
}) => {
  const sliderRef = useRef(null);

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

  return (
    <div className="flex-shrink-0 w-full lg:w-80 flex flex-col items-center">
      <div ref={cameraWrapRef} className="relative w-72 h-128 rounded-3xl overflow-hidden shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          onClick={handleFocus}
          style={{ filter: `brightness(${0.85 + brightness * 0.3})`, transition: 'filter 160ms linear', transform: isMirrored ? 'scaleX(-1)' : 'none' }}
        />
        {assets.frame && <img src={assets.frame} alt="frame overlay" className="pointer-events-none absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute left-4 top-4" style={{ left: 16, right: 'auto' }}>
          {assets.logo && <img src={assets.logo} alt="logo" className="w-14 h-14 object-contain rounded-lg" style={{ display: 'block' }} />}
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-40">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-white"><circle cx="12" cy="12" r="3.5" strokeWidth="1.5" /><path strokeWidth="1.2" d="M12 2v1.5M12 20.5V22M4.2 4.2l1.06 1.06M18.74 18.74l1.06 1.06M2 12h1.5M20.5 12H22M4.2 19.8l1.06-1.06M18.74 5.26l1.06-1.06" /></svg>
          <div ref={sliderRef} className="w-10 h-40 bg-transparent flex items-center justify-center slider-container" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onTouchStart={(e) => { e.preventDefault(); updateFromPointer(e.touches[0].clientY, sliderRef.current); }} onTouchMove={(e) => { e.preventDefault(); updateFromPointer(e.touches[0].clientY, sliderRef.current); }} onTouchEnd={() => { }} >
            <div className="relative w-1.5 h-full rounded-full slider-track">
              <div className="absolute slider-thumb" role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(brightness * 100)} style={{ left: '50%', top: `${(1 - brightness) * 100}%`, transform: 'translate(-50%, -50%)', width: 14, height: 14 }} />
            </div>
          </div>
        </div>
      </div>
      <div className="relative w-full mt-4">
        <button onClick={onFlip} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-xl shadow-md transition flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M4 20h16M4 4h16" /></svg>
        </button>
        <div className="flex justify-center">
          <button onClick={onCapture} disabled={isTaking} className={`relative flex items-center justify-center w-18 h-18 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl transform transition-all active:scale-95 ${isTaking ? "animate-pulse" : "hover:scale-105"}`} aria-label="Capture photo">
            <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-inner" style={{ width: 64, height: 64 }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3" strokeWidth="1.6" /><path strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Gallery Component ---
const Gallery = ({ photos, onSelectPhoto, downloadOne, deleteOne }) => {
  if (!photos || photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 rounded-2xl bg-slate-800/30">
        <p className="text-slate-400 text-center">لسه مفيش صور اتصورت<br /> ! يلا اتصور عشان ماتضربش </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
      {photos.map((photo, idx) => (
        <div key={photo.id} className="relative cursor-pointer group gallery-card" onClick={() => onSelectPhoto(photo, idx)}>
          <div className="glass-frame">
            <img src={photo.previewUrl || photo.originalUrl} alt={`photo-${idx}`} className="w-full aspect-[9/16] object-cover rounded-lg transition-transform duration-300 group-hover:scale-105" />
          </div>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2 gap-2">
            <button onClick={(e) => { e.stopPropagation(); downloadOne(photo); }} className="px-2 py-1 bg-emerald-500 rounded text-white text-sm font-semibold hover:bg-emerald-600">⬇️ تحميل</button>
            <button onClick={(e) => { e.stopPropagation(); deleteOne(photo.id); }} className="px-2 py-1 bg-red-600 rounded text-white text-sm font-semibold hover:bg-red-700">🗑 حذف</button>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Photo Modal ---
const PhotoModal = ({ modalPhoto, onClose, onDownload, onDelete }) => {
  if (!modalPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl overflow-hidden max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 flex justify-between items-center bg-slate-800">
          <h3 className="text-white font-bold">معاينة الصورة</h3>
          <button onClick={onClose} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white">✕ إغلاق</button>
        </div>
        <div className="p-4 bg-black flex justify-center">
          <img src={modalPhoto.photo.originalUrl} alt="preview" className="max-h-[80vh] w-auto rounded-lg" />
        </div>
        <div className="p-4 flex gap-3">
          <button onClick={() => onDownload(modalPhoto.photo)} className="flex-1 px-4 py-2 bg-green-500 rounded-lg text-white font-semibold hover:opacity-90">⬇️ تحميل</button>
          <button onClick={() => onDelete(modalPhoto.photo.id)} className="flex-1 px-4 py-2 bg-red-500 rounded-lg text-white font-semibold hover:opacity-90">🗑 حذف</button>
        </div>
      </div>
    </div>
  );
};

// --- Global Styles ---
const GlobalStyles = () => (
  <style>{`
    .slider-container { touch-action: none; -webkit-user-select:none; user-select:none; }
    .slider-track { background: linear-gradient(to top, #06b6d4 0%, #6366f1 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); border-radius:999px; width:6px; margin:0 auto; }
    .slider-thumb { position: absolute; left:50%; border-radius:50%; background: linear-gradient(180deg,#ffffff,#eef2ff); box-shadow: 0 6px 14px rgba(0,0,0,0.35); transition: top 130ms cubic-bezier(.2,.9,.3,1), transform 110ms ease; border: 2px solid rgba(99,102,241,0.12); }
    .slider-thumb:active { transform: translate(-50%, -50%) scale(1.08); box-shadow: 0 10px 22px rgba(99,102,241,0.18); }
    .slider-container:active .slider-track { filter: brightness(1.02); }
    @media (max-width:640px) { .slider-container { width: 12px; } .slider-track { height: 160px; } }
    .text-overlay { max-width: 640px; margin: 0 auto; background: linear-gradient(180deg, rgba(6,6,23,0.42), rgba(6,6,23,0.6)); padding: 10px 14px; border-radius: 12px; box-shadow: 0 8px 30px rgba(2,6,23,0.6); border: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(6px); }
    .text-overlay p { margin: 0; font-family: 'Segoe UI', Tahoma, Arial, 'Noto Naskh Arabic', sans-serif; font-weight: 600; }
    .gallery-card { border-radius: 14px; padding: 8px; background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); }
    .glass-frame { border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); box-shadow: 0 6px 18px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.02); backdrop-filter: blur(6px) saturate(120%); }
    .gallery-card img { display:block; }
    .gallery-card:hover { transform: translateY(-6px); transition: transform 220ms ease; }
    .gallery-card .group-hover\:opacity-100 { transition: opacity 180ms ease; }
    .modal-glass { background: linear-gradient(180deg, rgba(6,8,23,0.6), rgba(12,14,30,0.8)); border-radius: 14px; box-shadow: 0 18px 40px rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.04); }
    .footer-glass { background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 10px 30px rgba(2,6,23,0.5); backdrop-filter: blur(8px) saturate(120%); }
    .footer-glass a { text-decoration: none; }
    @media (max-width: 640px) { .footer-glass { flex-direction: column; gap: 8px; text-align: center; } }
  `}</style>
);

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraWrapRef = useRef(null);

  const [photos, setPhotos] = useState([]);

  const [isTaking, setIsTaking] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // حالة جديدة لتتبع التحميل
  const [modalPhoto, setModalPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const isMirrored = facingMode === 'user';
  const [assets, setAssets] = useState({ frame: null, logo: null });

  const { brightness, setBrightnessValue, handleFocus } = useCamera(videoRef, facingMode);

  useEffect(() => {
    // جلب الصور عند تحميل المكون لأول مرة
    async function loadPhotosFromDB() {
      // Pre-load assets and convert to data URLs
      const imageToDataUrl = async (url) => {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error(`Failed to load asset: ${url}`, e);
          return null;
        }
      };
      setAssets({ frame: await imageToDataUrl('/frame.png'), logo: await imageToDataUrl('/logo.jpg') });

      try {
        const dbPhotos = await getAllPhotos();
        // Generate preview URLs for faster rendering
        const photosWithPreviews = await Promise.all(dbPhotos.map(async (p) => {
          const blob = await (await fetch(p.originalUrl)).blob();
          const previewUrl = await new Promise((resolve, reject) => {
            new Compressor(blob, {
              quality: 0.6,
              width: 400, // Compress for thumbnail view
              success: (compressedResult) => {
                resolve(URL.createObjectURL(compressedResult));
              },
              error: (err) => {
                console.error('Compression error:', err.message);
                resolve(p.originalUrl); // Fallback to original if compression fails
              },
            });
          });
          return { ...p, previewUrl };
        }));
        setPhotos(photosWithPreviews);
      } catch (error) {
        console.error("Failed to fetch initial photos:", error);
        alert("فشل تحميل الصور المحفوظة من قاعدة البيانات المحلية.");
      } finally {
        setIsLoading(false);
      }
    }
    loadPhotosFromDB();
  }, []); // المصفوفة الفارغة تضمن تشغيل هذا التأثير مرة واحدة فقط

  const takePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) {
      alert("الكاميرا لسه بتجهز، استنى ثواني.");
      return;
    }

    setIsTaking(true);

    // --- The Manual, Robust, and 100% Accurate Method ---
    try {
      const wrap = cameraWrapRef.current;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);

      // 1. Draw Video with correct aspect ratio and brightness
      ctx.filter = `brightness(${0.85 + brightness * 0.3})`;
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const scale = Math.max(rect.width / vW, rect.height / vH);
      const renderedW = vW * scale;
      const renderedH = vH * scale;
      const offsetX = (renderedW - rect.width) / 2;
      const offsetY = (renderedH - rect.height) / 2;
      const sx = offsetX / scale;
      const sy = offsetY / scale;
      const sWidth = rect.width / scale;
      const sHeight = rect.height / scale;

      if (isMirrored) {
        ctx.save();
        ctx.translate(rect.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, rect.width, rect.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, rect.width, rect.height);
      }
      ctx.filter = 'none'; // Reset filter

      // 2. Draw Frame
      const frameImg = await loadImage(assets.frame);
      if (frameImg) {
        ctx.drawImage(frameImg, 0, 0, rect.width, rect.height);
      }

      // 3. Draw Logo
      const logoImg = await loadImage(assets.logo);
      if (logoImg) {
        const logoWidth = Math.round(rect.width * 0.18);
        const logoHeight = Math.round(logoWidth * (logoImg.height / logoImg.width));
        ctx.drawImage(logoImg, 16, 16, logoWidth, logoHeight);
      }

      const dataUrl = canvas.toDataURL("image/png", 0.95);

      const newPhoto = { originalUrl: dataUrl, createdAt: new Date().toISOString() };
      const newId = await addPhoto(newPhoto);
      const savedPhoto = { ...newPhoto, id: newId };

      // Create a preview for immediate display
      const blob = await (await fetch(savedPhoto.originalUrl)).blob();
      const previewUrl = await new Promise((resolve) => {
        new Compressor(blob, { quality: 0.6, width: 400, success: (res) => resolve(URL.createObjectURL(res)), error: () => resolve(savedPhoto.originalUrl) });
      });

      setPhotos(p => [{ ...savedPhoto, previewUrl }, ...p]);
    } catch (err) {
      console.error("Could not capture image from HTML:", err);
      alert("حدث خطأ أثناء التقاط الصورة.");
    }

    setTimeout(() => setIsTaking(false), 220);
  };

  const downloadOne = (photo) => {
    const a = document.createElement("a");
    a.href = photo.originalUrl;
    a.download = `photo-${new Date(photo.createdAt).getTime()}.png`;
    a.click();
  };

  const deleteOne = async (photoId) => {
    if (!confirm("متأكد من حذف الصورة دي؟")) return;

    try {
      await deletePhoto(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (modalPhoto && modalPhoto.photo.id === photoId) {
        setModalPhoto(null);
      }
    } catch (error) {
      console.error("Deletion error:", error);
      alert(`فشل حذف الصورة: ${error.message}`);
    }
  };

  const downloadAll = () => {
    photos.forEach((photo, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = photo.originalUrl;
        a.download = `photo-${new Date(photo.createdAt).getTime()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 180);
    });
  };

  const deleteAll = async () => {
    if (!confirm("متأكد تمسح كل الصور؟")) return;

    try {
      await dbDeleteAll();
      setPhotos([]);
      setModalPhoto(null);
    } catch (error) {
      console.error("Delete all error:", error);
      alert(`فشل حذف الصور: ${error.message}`);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex flex-col items-center p-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent py-6">
          ♟️ مسرحية اللعبة
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl">
          <div className="flex flex-col items-center">
            <CameraView
              videoRef={videoRef}
              cameraWrapRef={cameraWrapRef}
              isMirrored={isMirrored}
              brightness={brightness}
              setBrightnessValue={setBrightnessValue}
              handleFocus={handleFocus}
              onFlip={() => setFacingMode(p => (p === "user" ? "environment" : "user"))}
              onCapture={takePhoto}
              isTaking={isTaking}
              assets={assets}
            />
            <div className="flex flex-col items-center gap-2 mt-3">
              <button onClick={downloadAll} disabled={photos.length === 0} className="w-40 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-lg border border-white/6 text-sm text-white transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                <span className="text-sm">تحميل الكل</span>
              </button>
              <button onClick={deleteAll} disabled={photos.length === 0} className="w-40 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-lg text-sm text-white transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 11v6m4-6v6M9 7l1-3h4l1 3" /></svg>
                <span className="text-sm">حذف الكل</span>
              </button>
            </div>
          </div>

          <section className="flex-1 w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <p className="text-slate-400">جاري تحميل الصور...</p>
              </div>
            ) : (
              <Gallery photos={photos} onSelectPhoto={(photo, index) => setModalPhoto({ photo, index })} downloadOne={downloadOne} deleteOne={deleteOne} />
            )}
          </section>
        </div>

        <GlobalStyles />
        <canvas ref={canvasRef} className="hidden" />
        <PhotoModal modalPhoto={modalPhoto} onClose={() => setModalPhoto(null)} onDownload={downloadOne} onDelete={() => { if (modalPhoto) deleteOne(modalPhoto.photo.id); setModalPhoto(null); }} />

        <footer className="w-full mt-8 flex justify-center">
          <div className="w-full max-w-6xl footer-glass p-4 rounded-xl flex items-center justify-between gap-4">
            <div className="text-sm text-white/90">Developed by <span className="font-semibold">Youssef Shoukry</span></div>
            <div className="text-sm">
              <a href="tel:01204470794" className="inline-block px-3 py-1 rounded-md bg-white/5 hover:bg-white/8 text-white/95 font-mono">01204470794</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
