import React, { useState, useEffect } from 'react';
import './IntroCarousel.css';

const NUM_IMAGES = 20;
const images = Array.from({ length: NUM_IMAGES }, (_, i) => `/images/${i + 1}.webp`);

export default function IntroCarousel({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('flow'); // 'flow' | 'spin'

  useEffect(() => {
    let timer;

    if (phase === 'flow') {
      // Flow smoothly through the cards
      timer = setTimeout(() => {
        if (currentIndex < NUM_IMAGES - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          // After finishing all cards, switch to the fast spin mode
          setPhase('spin');
        }
      }, 800); // 0.8 seconds per card
    } else if (phase === 'spin') {
      // Spin quickly for 1 second before disappearing
      timer = setTimeout(() => {
        setPhase('disappear');
      }, 1000);
    } else if (phase === 'disappear') {
      // Staggered drop effect before transitioning to App
      timer = setTimeout(() => {
        onComplete();
      }, 2500);
    }

    return () => clearTimeout(timer);
  }, [currentIndex, phase, onComplete]);

  // Calculate rotation for flow phase
  const rotationY = -(360 / NUM_IMAGES) * currentIndex;

  return (
    <div className={`intro-carousel-wrapper ${phase}`}>
      <button
        type="button"
        className="intro-skip-btn"
        onClick={onComplete}
        aria-label="Skip intro"
      >
        <span>Skip</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="13 17 18 12 13 7" />
          <polyline points="6 17 11 12 6 7" />
        </svg>
      </button>
      <div
        className="inner"
        style={{
          '--quantity': NUM_IMAGES,
          // Only apply inline transform during flow so CSS animation takes over during spin
          ...(phase === 'flow' ? { transform: `perspective(1200px) rotateX(-10deg) rotateY(${rotationY}deg)` } : {})
        }}
      >
        <div className="center-number">20</div>
        {images.map((src, idx) => {
          const isActive = phase === 'flow' && idx === currentIndex;
          return (
            <div
              key={idx}
              className={`card ${isActive ? 'active' : ''}`}
              style={{ '--index': idx }}
            >
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
