import { useEffect, useRef } from 'react';

interface Props {
  active: boolean;
  getLevel: () => number;
  className?: string;
  /** Bar colors left to right (gradient stops). */
  colors?: string[];
}

const BAR_COUNT = 36;
const SAKI_GRADIENT: string[] = ['#38c8f0', '#3b82f6', '#6366f1', '#a855f7'];

/** Scrolling live input-level bars drawn on a canvas (no React re-renders per frame). */
export function Waveform({ active, getLevel, className, colors = SAKI_GRADIENT }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const history = new Array<number>(BAR_COUNT).fill(0);
    let frame = 0;
    let raf = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      if (frame++ % 2 === 0) {
        history.shift();
        // Speech RMS is usually 0.01–0.3; compress it into a visible 0–1 range.
        history.push(active ? Math.min(1, Math.sqrt(getLevel()) * 2.2) : 0);
      }

      const gap = 3;
      const barWidth = Math.max(2, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);
      const gradient = context.createLinearGradient(0, 0, width, 0);
      colors.forEach((color, i) => gradient.addColorStop(i / Math.max(1, colors.length - 1), color));
      context.fillStyle = gradient;
      history.forEach((level, i) => {
        const barHeight = Math.max(3, level * height);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        context.beginPath();
        context.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        context.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, getLevel, colors]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
