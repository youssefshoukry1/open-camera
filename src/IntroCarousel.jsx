import React, { useState, useEffect } from 'react';
import './IntroCarousel.css';

const NUM_IMAGES = 20;
const FLOW_DURATION = 16; // 16s total smooth rotation
const images = Array.from({ length: NUM_IMAGES }, (_, i) => `/images/${i + 1}.webp`);

export default function IntroCarousel({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('flow');

  useEffect(() => {
    if (phase === 'flow') {
      const startTime = Date.now();
      const HIGHLIGHT_OFFSET = 0.55; // Higher offset for mobile compensation
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const adjusted = elapsed + HIGHLIGHT_OFFSET;
        const idx = Math.max(0, Math.min(Math.floor((adjusted / FLOW_DURATION) * NUM_IMAGES), NUM_IMAGES - 1));
        setCurrentIndex(idx);

        if (elapsed >= FLOW_DURATION) {
          clearInterval(interval);
          setPhase('spin');
        }
      }, 100);
      return () => clearInterval(interval);
    }

    if (phase === 'spin') {
      const timer = setTimeout(() => setPhase('disappear'), 1200);
      return () => clearTimeout(timer);
    }

    if (phase === 'disappear') {
      // 20 cards × 0.1s stagger + 1s animation + center number drop
      const timer = setTimeout(onComplete, 3200);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  return (
    <div className={`intro-carousel-wrapper ${phase}`}>
      <button type="button" className="intro-skip-btn" onClick={onComplete} aria-label="Skip intro">
        <span>Skip</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="13 17 18 12 13 7" />
          <polyline points="6 17 11 12 6 7" />
        </svg>
      </button>
      <div className="inner" style={{ '--quantity': NUM_IMAGES }}>
        <div className="center-number">20</div>
        {images.map((src, idx) => {
          const isActive = phase === 'flow' && idx === currentIndex;
          return (
            <div key={idx} className={`card ${isActive ? 'active' : ''}`} style={{ '--index': idx }}>
              <span className="card-number">{idx + 1}</span>
              <img src={src} alt={`carousel-img-${idx}`} />
              <div className="blackshadow-overlay"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
