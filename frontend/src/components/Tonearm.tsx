import React, { useId } from 'react';

export function Tonearm({ angle }: { angle: number }) {
  const id = useId();
  const metal = `url(#${id}-metal)`;
  const cap = `url(#${id}-cap)`;
  const base = `url(#${id}-base)`;

  return (
    <svg className="vw-tonearm" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-metal`}>
          <stop stopColor="#332c23" />
          <stop offset=".23" stopColor="#716653" />
          <stop offset=".42" stopColor="#e2dbc9" />
          <stop offset=".59" stopColor="#ada28f" />
          <stop offset=".78" stopColor="#f6ecce" />
          <stop offset="1" stopColor="#51493b" />
        </linearGradient>
        <radialGradient id={`${id}-cap`} cx=".3" cy=".24" r=".88">
          <stop stopColor="#f1e8d5" />
          <stop offset=".58" stopColor="#a2937a" />
          <stop offset="1" stopColor="#4d4232" />
        </radialGradient>
        <radialGradient id={`${id}-base`} cx=".35" cy=".3">
          <stop stopColor="#68706a" />
          <stop offset="1" stopColor="#171917" />
        </radialGradient>
      </defs>
      <g transform="translate(94 11)" data-testid="tonearm-pivot">
        <path d="M2 4 7 14M3 2l5 2" stroke="#5b5447" strokeWidth="1.1" strokeLinecap="round" />
        <circle r="8" fill="#0e0e0c" />
        <circle r="7.4" fill={base} stroke="#47453d" strokeWidth=".3" />
        <circle r="5.4" fill="#121211" stroke={metal} strokeWidth=".95" />
        <g data-testid="tonearm" className="vw-tonearm__moving" style={{ transform: `rotate(${angle}deg)` }}>
          <path d="M0-12v14C0 7-3 11-3 17S1 36 1 46c0 5-2 8-4 12l-3 6"
            fill="none" stroke="#261f16" strokeWidth="2.45" strokeLinecap="round" />
          <path d="M0-12v14C0 7-3 11-3 17S1 36 1 46c0 5-2 8-4 12l-3 6"
            fill="none" stroke={metal} strokeWidth="1.65" strokeLinecap="round" />
          <path d="M-.45 3C-.7 8-3.5 13-3.5 17c0 6 4.1 19 4.1 29 0 4-1.4 7-3.6 11"
            fill="none" stroke="#fff1cf" strokeOpacity=".62" strokeWidth=".38" strokeLinecap="round" />
          <rect x="-1.25" y="-16" width="2.5" height="2.8" rx=".5" fill={metal} />
          <rect x="-3.55" y="-14.5" width="7.1" height="6.7" rx=".85" fill={metal} stroke="#625341" strokeWidth=".28" />
          <path d="M-3.3-9h6.6" stroke="#28271e" strokeWidth="1" strokeDasharray=".42 .29" />
          <g transform="translate(-3 57) rotate(24)" data-testid="tonearm-head">
            <path d="M2.2 5h3.9l1.1 1.1" fill="none" stroke={metal} strokeWidth=".7" />
            <rect x="-2.45" y="-1" width="4.9" height="9" rx=".9" fill={metal} stroke="#746958" strokeWidth=".35" />
            <path d="M-1.15 1v1.5m2.25-1.5v1.5M-1.15 4v1.5m2.25-1.5v1.5"
              stroke="#302a21" strokeWidth=".9" strokeLinecap="round" />
            <path d="M0 8v1.9" stroke="#d8c09c" strokeWidth=".6" strokeLinecap="round" />
          </g>
          <circle r="3.3" fill={cap} stroke="#4e4539" strokeWidth=".36" />
          <path d="M-2.2-1.6A2.7 2.7 0 0 1 1.5-2.3" fill="none" stroke="#ffefc7" strokeWidth=".34" />
        </g>
      </g>
    </svg>
  );
}
