import React, { useEffect, useRef, useState } from "react";
import Compressor from 'compressorjs';
import { getAllPhotos, addPhoto, deletePhoto, deleteAllPhotos as dbDeleteAll } from './db';
import IntroCarousel from './IntroCarousel';

// --- Custom Hook for Camera Logic ---
function useCamera(videoRef, facingMode, skip = false) {
  const [brightness, setBrightness] = useState(0.5);

  useEffect(() => {
    let mounted = true;
    let stream = null;

    if (skip) return;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 }, // طلب دقة أقل (720p) لضمان الأداء وفتح الكاميرا
            height: { ideal: 720 }
          },
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
  }, [facingMode, videoRef, skip]);

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

// --- Helper to convert Data URL to File synchronously ---
const dataURLtoFile = (dataurl, filename) => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
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
  onScreenshot,
  isTaking,
  assets,
  isFlashing
}) => {
  const sliderRef = useRef(null);

  const updateFromPointer = (clientX, pointerTarget) => {
    const el = pointerTarget || sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setBrightnessValue(pct);
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromPointer(e.clientX, e.currentTarget);
  };

  const handlePointerMove = (e) => {
    if (e.pressure === 0 && e.buttons === 0) return;
    updateFromPointer(e.clientX, e.currentTarget);
  };

  const handlePointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { }
  };

  return (
    <div className="flex-shrink-0 w-full lg:w-96 flex flex-col items-center px-2 sm:px-0">
      <div ref={cameraWrapRef} className="relative w-full max-w-sm aspect-[9/16] h-auto rounded-3xl overflow-hidden shadow-2xl bg-black/80">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          onClick={handleFocus}
          style={{ filter: `brightness(${0.85 + brightness * 0.3})`, transition: 'filter 160ms linear', transform: isMirrored ? 'scaleX(-1)' : 'none' }}
        />
        {isFlashing && <div className="camera-flash-overlay" />}
        <div className="absolute left-4 top-4" style={{ left: 'auto', right: '6px' }}>
          {assets.logo && <img src={assets.logo} alt="logo" className="w-16 h-16 object-contain rounded-lg" style={{ display: 'block' }} />}
        </div>
        {/* Arabic Text Overlay */}
        <div className="absolute left-1/2 transform -translate-x-1/2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 text-center shadow-lg" style={{ width: '90%', bottom: '24px', padding: '16px' }}>
          <p className="font-bold text-white drop-shadow-md" dir="rtl" style={{ fontFamily: 'Arial, sans-serif', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
            لأَنَّ كُلَّ الَّذِينَ يَنْقَادُونَ بِرُوحِ اللهِ، فَأُولئِكَ هُمْ أَبْنَاءُ اللهِ
          </p>
        </div>
      </div>
      <div className="relative w-full mt-6 flex items-center justify-center">
        <button id="screenshot-btn" onClick={onScreenshot} className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full shadow-lg transition active:scale-95 flex items-center justify-center" title="لقطة للشاشة">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
        </button>
        <button onClick={onFlip} className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full shadow-lg transition active:scale-95 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6m-6 0h16v10H4V10zm16 0v-6h-6" /></svg>
        </button>
        <button onClick={onCapture} disabled={isTaking} className={`group relative flex items-center justify-center w-20 h-20 rounded-full border-[3px] border-white/30 bg-white/10 backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all ${isTaking ? "scale-95 opacity-90" : "hover:bg-white/20 hover:scale-105 hover:border-white/50"}`} aria-label="Capture photo">
          <div className={`w-16 h-16 bg-white rounded-full shadow-inner transition-all duration-200 ${isTaking ? "scale-90" : "group-hover:scale-[0.95]"}`} />
        </button>
      </div>
      {/* --- New Horizontal Brightness Slider --- */}
      <div className="w-full max-w-xs mt-6 px-4 py-3 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10 flex items-center gap-3 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-white/70 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.021 0l-.707-.707M6.343 6.343l-.707-.707" /></svg>
        <div ref={sliderRef} className="relative w-full h-6 flex items-center justify-center slider-container touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onTouchStart={(e) => { e.preventDefault(); updateFromPointer(e.touches[0].clientX, sliderRef.current); }} onTouchMove={(e) => { e.preventDefault(); updateFromPointer(e.touches[0].clientX, sliderRef.current); }} onTouchEnd={() => { }} >
          <div className="relative h-1.5 w-full rounded-full slider-track">
            <div className="absolute slider-thumb" role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(brightness * 100)} style={{ top: '50%', left: `${brightness * 100}%`, transform: 'translate(-50%, -50%)' }} />
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/90 flex-shrink-0"><path d="M12 18a6 6 0 100-12 6 6 0 000 12z" /></svg>
      </div>
    </div>
  );
};

// --- Gallery Component ---
const Gallery = ({ photos, onSelectPhoto, downloadOne, deleteOne, shareOne, isShareSupported }) => {
  if (!photos || photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 rounded-2xl bg-slate-800/30">
        <p className="text-slate-400 text-center">Your gallery is empty!<br />Take a birthday photo to get started.</p>
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
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center gap-3 pb-4 rounded-lg backdrop-blur-[2px]">
            {isShareSupported && (
              <button onClick={(e) => { e.stopPropagation(); shareOne(photo); }} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-transform hover:scale-110 border border-white/10" title="مشاركة">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); downloadOne(photo); }} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-transform hover:scale-110 border border-white/10" title="تحميل">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); deleteOne(photo.id); }} className="p-3 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-full backdrop-blur-md transition-transform hover:scale-110 border border-red-500/20" title="حذف">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Photo Modal ---
const PhotoModal = ({ modalPhoto, onClose, onDownload, onDelete, onShare, isShareSupported }) => {
  if (!modalPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-3xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img src={modalPhoto.photo.originalUrl} alt="preview" className="max-h-[75vh] w-auto rounded-2xl shadow-2xl mb-6" />
        <div className="flex items-center gap-4">
          {isShareSupported && (
            <button onClick={() => onShare(modalPhoto.photo)} className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition group">
              <div className="p-4 bg-white/10 group-hover:bg-white/20 rounded-full backdrop-blur-md transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              </div>
              <span className="text-xs font-medium">مشاركة</span>
            </button>
          )}
          <button onClick={() => onDownload(modalPhoto.photo)} className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition group">
            <div className="p-4 bg-white/10 group-hover:bg-white/20 rounded-full backdrop-blur-md transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </div>
            <span className="text-xs font-medium">تحميل</span>
          </button>
          <button onClick={() => onDelete(modalPhoto.photo.id)} className="flex flex-col items-center gap-1 text-red-400/80 hover:text-red-400 transition group">
            <div className="p-4 bg-red-500/10 group-hover:bg-red-500/20 rounded-full backdrop-blur-md transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <span className="text-xs font-medium">حذف</span>
          </button>
          <button onClick={onClose} className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition group ml-4">
            <div className="p-4 rounded-full hover:bg-white/10 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <span className="text-xs font-medium">إغلاق</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Snowfall Component for background effect ---
const Snowfall = () => {
  const flakes = Array.from({ length: 30 }).map((_, i) => {
    const style = {
      left: `${Math.random() * 100}%`,
      animationDuration: `${Math.random() * 8 + 7}s`, // 7 to 15 seconds
      animationDelay: `${Math.random() * 10}s`,
      opacity: Math.random() * 0.6 + 0.3,
    };
    return <div key={i} className="snowflake" style={style}>❆</div>;
  });
  return <div className="snowfall-container" aria-hidden="true">{flakes}</div>;
};

// --- Simple Confetti Component ---
const SimpleConfetti = () => {
  const particles = Array.from({ length: 50 }).map((_, i) => {
    const isLeft = i % 2 === 0;
    const startX = isLeft ? Math.random() * 30 : 70 + Math.random() * 30;
    const color = ['#ef4444', '#22c55e', '#fbbf24', '#ffffff', '#60a5fa'][Math.floor(Math.random() * 5)];
    return (
      <div
        key={i}
        className="ribbon-particle"
        style={{ '--x': `${(Math.random() - 0.5) * 100}px`, '--y': `-${300 + Math.random() * 200}px`, '--r': `${(Math.random() - 0.5) * 720}deg`, '--c': color, left: `${startX}%`, animationDelay: `${Math.random() * 0.5}s` }}
      />
    );
  });
  return <div className="absolute inset-0 pointer-events-none z-[100] overflow-visible">{particles}</div>;
};

// --- Global Styles ---
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');
    
    .font-playfair { font-family: 'Playfair Display', serif; }
    
    .slider-container { touch-action: none; -webkit-user-select:none; user-select:none; cursor: grab; }
    .slider-track { background: rgba(255,255,255,0.2); box-shadow: inset 0 1px 2px rgba(0,0,0,0.1); border-radius:999px; height:4px; margin:0 auto; width: 100%; }
    .slider-thumb { position: absolute; top:50%; border-radius:50%; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: left 100ms ease, transform 100ms ease; width: 20px; height: 20px; cursor: grab; }
    .slider-thumb:active { transform: translate(-50%, -50%) scale(1.2); cursor: grabbing; }
    .slider-container:active .slider-track { filter: brightness(1.02); }
    /* Text overlay styles are no longer needed */
    .camera-flash-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(255, 255, 255, 0.9); /* White flash */
      opacity: 0;
      animation: cameraFlash 0.2s ease-out forwards; /* Flash animation */
    }
    .gallery-card { border-radius: 14px; padding: 8px; background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); }
    .glass-frame { border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); box-shadow: 0 6px 18px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.02); backdrop-filter: blur(6px) saturate(120%); }
    .gallery-card img { display:block; }
    .gallery-card:hover { transform: translateY(-6px); transition: transform 220ms ease; }
    .gallery-card .group-hover\:opacity-100 { transition: opacity 180ms ease; }
    .modal-glass { background: linear-gradient(180deg, rgba(6,8,23,0.6), rgba(12,14,30,0.8)); border-radius: 14px; box-shadow: 0 18px 40px rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.04); }
    .footer-glass { background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 10px 30px rgba(2,6,23,0.5); backdrop-filter: blur(8px) saturate(120%); }
    .footer-glass a { text-decoration: none; }
    @media (max-width: 640px) { .footer-glass { flex-direction: column; gap: 8px; text-align: center; } }
    @keyframes cameraFlash {
      0% { opacity: 0; }
      50% { opacity: 0.9; }
      100% { opacity: 0; }
    }
    .snowfall-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 0;
    }
    .snowflake {
      position: absolute;
      top: -20px;
      color: white;
      font-size: 1.2rem;
      animation-name: snowfall;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }
    @keyframes snowfall {
      from { transform: translateY(0px) translateX(0px) rotate(0deg); }
      to { transform: translateY(105vh) translateX(15px) rotate(270deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
    .ribbon-particle {
      position: absolute;
      bottom: 0;
      width: 10px;
      height: 25px;
      background-color: var(--c);
      opacity: 0;
      animation: ribbonShoot 2s ease-out forwards;
    }
    @keyframes ribbonShoot {
      0% { transform: translate(0, 0) rotate(0deg) scale(0.5); opacity: 1; }
      80% { opacity: 1; }
      100% { transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(1); opacity: 0; }
    }
    .hint-box { animation: slideUp 0.3s ease-out forwards; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    
    /* إجبار العناصر على الظهور فوراً أثناء السكرين شوت */
    .screenshot-mode .animate-fade-in {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  `}</style>
);

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraWrapRef = useRef(null);

  const [photos, setPhotos] = useState([]);

  const [isTaking, setIsTaking] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // حالة جديدة لتتبع التحميل
  const [isFlashing, setIsFlashing] = useState(false); // حالة جديدة لتأثير الفلاش
  const [modalPhoto, setModalPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const isMirrored = facingMode === 'user';
  const [isShareSupported, setIsShareSupported] = useState(false);
  const [assets, setAssets] = useState({ frame: null, logo: null });

  const { brightness, setBrightnessValue, handleFocus } = useCamera(videoRef, facingMode, showIntro);

  useEffect(() => {
    // Check for Web Share API support
    if (navigator.share && typeof navigator.canShare === "function") {
      // We need to check if it can share files, as some implementations only support text/urls
      // A dummy file check is a good way to be sure.
      if (navigator.canShare({ files: [new File([""], "t.png", { type: "image/png" })] })) {
        setIsShareSupported(true);
      }
    }
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
      setAssets({ frame: null, logo: await imageToDataUrl('/YOUTH  Meeting-19.png') });

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

    setIsFlashing(true); // Start the flash effect
    setIsTaking(true);

    // --- The Manual, Robust, and 100% Accurate Method ---
    try {
      const wrap = cameraWrapRef.current;
      const rect = wrap.getBoundingClientRect();

      // استخدام دقة الفيديو الأصلية بدلاً من دقة الشاشة للحصول على أعلى جودة
      const vW = video.videoWidth;
      const vH = video.videoHeight;

      // حساب نسب الأبعاد
      const rectAspect = rect.width / rect.height;
      const videoAspect = vW / vH;

      let drawW, drawH, startX, startY;

      // محاكاة object-fit: cover بس على دقة الفيديو الأصلية
      if (rectAspect > videoAspect) {
        // الكونتينر أعرض من الفيديو (بالنسبة للطول)
        drawW = vW;
        drawH = vW / rectAspect;
        startX = 0;
        startY = (vH - drawH) / 2;
      } else {
        // الكونتينر أطول من الفيديو
        drawH = vH;
        drawW = vH * rectAspect;
        startX = (vW - drawW) / 2;
        startY = 0;
      }

      // ضبط الكانفاس على الحجم المقصوص عالي الجودة
      canvas.width = Math.round(drawW);
      canvas.height = Math.round(drawH);

      const ctx = canvas.getContext("2d");

      // 1. رسم الفيديو
      ctx.filter = `brightness(${0.85 + brightness * 0.3})`;

      if (isMirrored) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, startX, startY, drawW, drawH, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, startX, startY, drawW, drawH, 0, 0, canvas.width, canvas.height);
      }
      ctx.filter = 'none'; // Reset filter

      // Calculate scale based on the ratio between canvas width (high res) and displayed width (CSS pixels)
      const scale = canvas.width / rect.width;

      // 2. Draw Logo
      if (assets.logo) {
        const logoImg = await loadImage(assets.logo);
        if (logoImg) {
          // CSS: w-16 (64px), right: 6px, top: 16px (top-4)
          const logoWidth = 64 * scale;
          const logoHeight = logoWidth * (logoImg.height / logoImg.width);
          const logoMarginRight = 6 * scale;
          const logoMarginTop = 16 * scale;

          const logoX = canvas.width - logoWidth - logoMarginRight;
          const logoY = logoMarginTop;

          ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
        }
      }

      // 3. Draw Text Overlay
      const overlayText = "لأَنَّ كُلَّ الَّذِينَ يَنْقَادُونَ بِرُوحِ اللهِ، فَأُولئِكَ هُمْ أَبْنَاءُ اللهِ";

      // Font settings
      // Match CSS: 15px fixed, 1.6 line height
      const fontSize = 15 * scale;
      const lineHeight = fontSize * 1.6;
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Constraints
      const boxWidth = canvas.width * 0.9; // Fixed 90% width
      const padding = 16 * scale; // 16px padding
      const maxTextWidth = boxWidth - (padding * 2);

      // Word Wrap Logic
      const words = overlayText.split(' ');
      let lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxTextWidth) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);

      // Calculate Box Dimensions
      // Box width is fixed at 90% of canvas
      const boxHeight = (lines.length * lineHeight) + (padding * 2); // Height based on content

      // Position: Bottom center, margin bottom 24px
      const marginBottom = 24 * scale;
      const boxX = (canvas.width - boxWidth) / 2;
      const boxY = canvas.height - boxHeight - marginBottom;
      const borderRadius = 16 * scale;

      // Define Path for Box
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
      } else {
        ctx.moveTo(boxX + borderRadius, boxY);
        ctx.lineTo(boxX + boxWidth - borderRadius, boxY);
        ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + borderRadius);
        ctx.lineTo(boxX + boxWidth, boxY + boxHeight - borderRadius);
        ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - borderRadius, boxY + boxHeight);
        ctx.lineTo(boxX + borderRadius, boxY + boxHeight);
        ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - borderRadius);
        ctx.lineTo(boxX, boxY + borderRadius);
        ctx.quadraticCurveTo(boxX, boxY, boxX + borderRadius, boxY);
      }
      ctx.closePath();

      // A. Apply Solid Background (Replaces heavy glass effect)
      ctx.save();
      ctx.clip();
      
      // B. Draw Box Background, Border, and Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'; // bg-black/65 for better readability without blur
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // border-white/20
      ctx.lineWidth = 1 * scale;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; // shadow-lg
      ctx.shadowBlur = 15 * scale;
      ctx.shadowOffsetY = 10 * scale;
      ctx.fill();
      ctx.shadowColor = 'transparent'; // Clear shadow for stroke
      ctx.stroke();
      ctx.restore();

      // C. Draw Text
      ctx.save();
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4 * scale;
      ctx.shadowOffsetY = 2 * scale;

      lines.forEach((line, i) => {
        const lineY = boxY + padding + (lineHeight / 2) + (i * lineHeight);
        ctx.fillText(line, canvas.width / 2, lineY);
      });
      ctx.restore();

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

    setTimeout(() => setIsFlashing(false), 200); // End the flash effect after 200ms
    setTimeout(() => setIsTaking(false), 220);
  };

  const sharePhoto = async (photo) => {
    if (!isShareSupported) {
      alert("المشاركة غير مدعومة في هذا المتصفح.");
      return;
    }

    try {
      const response = await fetch(photo.originalUrl);
      const blob = await response.blob();
      const file = new File([blob], `photo-${new Date(photo.createdAt).getTime()}.png`, {
        type: "image/png",
      });

      await navigator.share({
        title: "صورتي من Birthday Booth",
        text: "لقد التقطت صورة رائعة!",
        files: [file],
      });
    } catch (error) {
      // This error is common when the user cancels the share dialog, so we don't need to show an alert.
      if (error.name !== 'AbortError') {
        console.error("Share error:", error);
        alert(`فشلت المشاركة: ${error.message}`);
      }
    }
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

  const shareAll = async () => {
    if (!isShareSupported) {
      alert("المشاركة غير مدعومة في هذا المتصفح.");
      return;
    }
    if (photos.length === 0) return;

    try {
      // تحديد الحد الأقصى للمشاركة لتجنب رفض المتصفح/النظام
      const MAX_FILES = 10;
      let photosToShare = photos;
      if (photos.length > MAX_FILES) {
        alert(`عشان قيود الموبايل، هنشارك أحدث ${MAX_FILES} صور بس.`);
        photosToShare = photos.slice(0, MAX_FILES);
      }

      const files = photosToShare.map((photo) => {
        return dataURLtoFile(photo.originalUrl, `photo-${new Date(photo.createdAt).getTime()}.png`);
      });

      await navigator.share({
        files: files,
        title: "صوري من Birthday Booth",
        text: "شوف الصور اللي صورتها!",
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Share all error:", error);
        alert(`فشلت المشاركة: ${error.message}`);
      }
    }
  };

  const handleScreenshot = async () => {
    const video = videoRef.current;
    const mainContainer = document.getElementById('main-container');
    const wrap = cameraWrapRef.current;
    // حفظ حالة العرض الأصلية للفيديو
    const originalDisplay = video ? video.style.display : '';
    let placeholder = null;

    try {
      // استخدام toPng كما طلبت
      const { toPng } = await import('html-to-image');

      // 1. معالجة الفيديو: تحويل الفريم الحالي لصورة Canvas
      // ده ضروري لأن مكتبات السكرين شوت مش بتشوف الفيديو اللايف
      if (video && video.readyState >= 2 && wrap) {
        // استخدام أبعاد الحاوية (Container) بدلاً من الفيديو لضمان عدم قص الفريم
        const rect = wrap.getBoundingClientRect();
        // تقليل دقة الصورة المؤقتة للايفون لتجنب مشاكل الذاكرة (Max 2x)
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const canvas = document.createElement('canvas');
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');

        // حساب أبعاد الفيديو لتغطية الكانفاس (Object-fit: cover simulation)
        const cw = canvas.width;
        const ch = canvas.height;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const scale = Math.max(cw / vw, ch / vh);
        const scaledW = vw * scale;
        const scaledH = vh * scale;
        const offsetX = (cw - scaledW) / 2;
        const offsetY = (ch - scaledH) / 2;

        ctx.save();
        // تطبيق الفلاتر والقلب (Mirror) يدوياً على الكانفاس لأننا بنبني الصورة من الصفر
        ctx.filter = `brightness(${0.85 + brightness * 0.3})`;
        if (isMirrored) {
          ctx.translate(cw, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, offsetX, offsetY, scaledW, scaledH);
        ctx.restore();

        // تحويل الكانفاس لصورة PNG
        const frameData = canvas.toDataURL('image/png');
        placeholder = document.createElement('img');

        placeholder.src = frameData;

        // انتظار فك تشفير الصورة (أضمن طريقة في المتصفحات الحديثة)
        try {
          await placeholder.decode();
        } catch (e) {
          // Fallback لو المتصفح قديم
          await new Promise(r => setTimeout(r, 200));
        }

        // تعيين التنسيقات الأساسية فقط (بدون نسخ الفلاتر لأننا دمجناها بالفعل)
        placeholder.className = video.className;
        // تأكيد الأبعاد عشان الصورة تملأ المكان صح
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
        placeholder.style.objectFit = 'cover';

        // استبدال الفيديو بالصورة مؤقتاً
        video.parentNode.insertBefore(placeholder, video);
        video.style.display = 'none';
      }

      // تفعيل وضع السكرين شوت (إيقاف الأنيميشن)
      if (mainContainer) mainContainer.classList.add('screenshot-mode');

      // 2. التقاط الصورة
      const cameraColumn = document.getElementById('camera-column');

      let captureHeight = mainContainer.scrollHeight;

      if (cameraColumn && window.innerWidth < 1024) {
        const mainRect = mainContainer.getBoundingClientRect();
        const camRect = cameraColumn.getBoundingClientRect();

        captureHeight = (camRect.bottom - mainRect.top) + 20;
      }

      const dataUrl = await toPng(mainContainer, {
        cacheBust: false, // تجنب مشاكل الروابط
        height: captureHeight,
        pixelRatio: 1, // Fix for iOS: منع تكبير الصورة بشكل مبالغ فيه على شاشات الريتنا
        style: {
          // إجبار النسخة المصورة إنها تبدأ من فوق خالص (0,0) بغض النظر عن السكرول
          position: 'absolute',
          top: '0',
          left: '0',
          width: `${mainContainer.offsetWidth}px`, // Fix for iOS: تحديد العرض بالبكسل بدلاً من النسبة المئوية
          margin: '0',
          transform: 'none',
        },
        filter: (node) => node.id !== 'screenshot-btn' && node.tagName !== 'VIDEO' && node.id !== 'app-footer',
      });

      // إضافة الصورة للمعرض بدلاً من التحميل المباشر
      const newPhoto = { originalUrl: dataUrl, createdAt: new Date().toISOString() };
      const newId = await addPhoto(newPhoto);
      const savedPhoto = { ...newPhoto, id: newId };

      // إنشاء معاينة (Preview)
      const blob = await (await fetch(savedPhoto.originalUrl)).blob();
      const previewUrl = await new Promise((resolve) => {
        new Compressor(blob, { quality: 0.6, width: 400, success: (res) => resolve(URL.createObjectURL(res)), error: () => resolve(savedPhoto.originalUrl) });
      });

      setPhotos(p => [{ ...savedPhoto, previewUrl }, ...p]);

    } catch (error) {
      console.error("Screenshot error:", error);
      let msg = error.message;
      // معالجة خطأ Event الغامض
      if (!msg && error.type === 'error') {
        msg = "فشل معالجة الصورة. حاول مرة أخرى.";
      }
      alert("حدث خطأ أثناء حفظ الصورة: " + (msg || "خطأ غير معروف"));
    } finally {
      // 3. تنظيف وإرجاع الفيديو
      if (placeholder) {
        placeholder.remove();
      }
      if (video) {
        video.style.display = originalDisplay;
      }

      if (mainContainer) {
        mainContainer.classList.remove('screenshot-mode');
      }
    }
  };

  if (showIntro) {
    return <IntroCarousel onComplete={() => setShowIntro(false)} />;
  }

  return (
    <>
      <div id="main-container" className="min-h-screen w-full overflow-x-hidden bg-[#5A0F1B] text-white flex flex-col items-center p-4 sm:p-6 ">
        <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center justify-center gap-4 sm:gap-6 mb-6 sm:mb-8 py-4 sm:py-6 w-full max-w-full px-2">

          {/* Glassy Gradient Text */}
          <div className="relative px-6 py-3 sm:px-10 sm:py-4 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden group hover:bg-white/10 transition-all duration-500 max-w-[95%]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50"></div>
            <h1 className="relative font-playfair text-5xl sm:text-7xl md:text-[7rem] lg:text-[8rem] font-black tracking-normal text-transparent bg-clip-text bg-gradient-to-br from-amber-100 via-yellow-400 to-amber-700 drop-shadow-[0_4px_25px_rgba(251,191,36,0.3)] transition-all duration-700 group-hover:scale-105 group-hover:drop-shadow-[0_8px_35px_rgba(251,191,36,0.6)] py-2" dir="rtl">
              Orchestra
            </h1>
          </div>

        </div>

        <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl relative z-10">
          <div id="camera-column" className="flex flex-col items-center">
            <CameraView
              videoRef={videoRef}
              cameraWrapRef={cameraWrapRef}
              isMirrored={isMirrored}
              brightness={brightness}
              setBrightnessValue={setBrightnessValue}
              handleFocus={handleFocus}
              onFlip={() => setFacingMode(p => (p === "user" ? "environment" : "user"))}
              onCapture={takePhoto}
              onScreenshot={handleScreenshot}
              isTaking={isTaking}
              isFlashing={isFlashing} // Pass the flash state
              assets={assets}
            />
            <div className="flex flex-col items-center gap-3 mt-6 w-full max-w-xs">
              <div className="flex gap-3 w-full">
                <button onClick={downloadAll} disabled={photos.length === 0} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-2xl border border-white/10 text-white transition-all active:scale-95">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="font-medium">تحميل الكل</span>
                </button>
                <button onClick={deleteAll} disabled={photos.length === 0} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 rounded-2xl border border-red-500/20 text-red-200 transition-all active:scale-95">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  <span className="font-medium">حذف الكل</span>
                </button>
              </div>
              {isShareSupported && (
                <button onClick={shareAll} disabled={photos.length === 0} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-40 rounded-2xl border border-sky-500/20 text-sky-200 transition-all active:scale-95">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  <span className="font-medium">مشاركة الكل</span>
                </button>
              )}
            </div>
          </div>

          <section className="flex-1 w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <p className="text-slate-400">جاري تحميل الصور...</p>
              </div>
            ) : (
              <Gallery
                photos={photos}
                onSelectPhoto={(photo, index) => setModalPhoto({ photo, index })}
                downloadOne={downloadOne}
                deleteOne={deleteOne}
                shareOne={sharePhoto}
                isShareSupported={isShareSupported}
              />
            )}
          </section>
        </div>

        <GlobalStyles />
        <canvas ref={canvasRef} className="hidden" />
        <PhotoModal modalPhoto={modalPhoto} onClose={() => setModalPhoto(null)} onDownload={downloadOne} onDelete={() => { if (modalPhoto) deleteOne(modalPhoto.photo.id); setModalPhoto(null); }} onShare={sharePhoto} isShareSupported={isShareSupported}
        />

        <footer id="app-footer" className="w-full mt-8 flex justify-center pb-6">
          <div className="w-full max-w-6xl footer-glass px-6 py-4 rounded-2xl flex flex-col md:flex-row items-center justify-center gap-4">
            <div className="text-sm text-white/80 flex items-center gap-3">
              <span>Developed by</span>
              <a href="https://youssef-portfolio-1.vercel.app" target="_blank" rel="noopener noreferrer" className="group relative px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center gap-2">
                <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300 group-hover:from-white group-hover:to-white transition-all">Youssef Shoukry</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
