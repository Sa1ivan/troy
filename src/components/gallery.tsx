"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { Gallery as GalleryData } from "@/lib/catalog";
import { SelectField } from "./controls";
import { Dialog } from "./dialog";

export function Gallery({ galleries }: { galleries: GalleryData[] }) {
  const [group, setGroup] = useState(0);
  const [slide, setSlide] = useState<{ index: number; previous?: string; direction: number }>({ index: 0, direction: 0 });
  const [expanded, setExpanded] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipedAt = useRef(0);
  const current = galleries[group];
  const total = current.photos.length;
  const photo = slide.index;
  const nextPhoto = (step: number) => {
    setSlide(({ index }) => ({
      index: (index + step + total) % total,
      previous: current.photos[index],
      direction: step,
    }));
  };
  const choosePhoto = (index: number) => {
    if (index !== photo) {
      setSlide({ index, previous: current.photos[photo], direction: Math.sign(index - photo) });
    }
  };
  const description = current.title + " — фото " + (photo + 1);
  useEffect(() => {
    if (total < 2) return;
    for (const step of [-1, 1]) {
      const preload = new window.Image();
      preload.src = current.photos[(photo + step + total) % total];
    }
  }, [current, photo, total]);

  function onTouchStart(event: TouchEvent) {
    const touch = event.changedTouches[0];
    touchStart.current = touch && event.touches.length < 2 ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch || total < 2) return;
    const horizontal = touch.clientX - start.x;
    const vertical = touch.clientY - start.y;
    if (Math.abs(horizontal) >= 38 && Math.abs(horizontal) > Math.abs(vertical) * 1.2) {
      swipedAt.current = performance.now();
      nextPhoto(horizontal < 0 ? 1 : -1);
    }
  }

  const navigation = total > 1 && (
    <div className="gallery-navigation">
      <button className="icon-button" type="button" aria-label="Предыдущее фото" onClick={() => nextPhoto(-1)}><ChevronLeft size={21} aria-hidden="true" /></button>
      <span aria-live="polite">{photo + 1} / {total}</span>
      <button className="icon-button" type="button" aria-label="Следующее фото" onClick={() => nextPhoto(1)}><ChevronRight size={21} aria-hidden="true" /></button>
    </div>
  );
  return (
    <div className="gallery">
      {galleries.length > 1 && (
        <SelectField label="Подборка" className="gallery-picker" value={String(group)}
          options={galleries.map((item, index) => ({ value: String(index), label: item.title }))}
          onChange={(value) => {
            if (Number(value) === group) return;
            setGroup(Number(value));
            setSlide({ index: 0, previous: current.photos[photo], direction: 0 });
          }} />
      )}
      {current.note && <p className="gallery-note">{current.note}</p>}
      <div className="gallery-main">
        <button type="button" className="gallery-cover" aria-label={"Увеличить фото. " + description}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { touchStart.current = null; }}
          onClick={() => {
            if (swipedAt.current && performance.now() - swipedAt.current <= 330) return;
            setSlide({ index: photo, direction: 0 });
            setExpanded(true);
          }}>
          <GalleryImage key={current.photos[photo]} src={current.photos[photo]} previous={slide.previous} direction={slide.direction}
            description={description} sizes="(min-width: 1000px) 780px, 100vw" />
          <span className="gallery-expand"><Expand size={19} aria-hidden="true" /></span>
        </button>
        {navigation}
      </div>
      <div className="gallery-thumbnails" aria-label="Фотографии подборки">
        {current.photos.map((src, index) => (
          <button key={src} className="gallery-thumbnail" type="button" onClick={() => choosePhoto(index)}
            aria-label={"Показать фото " + (index + 1)} aria-pressed={photo === index}>
            <Image src={src} alt="" fill sizes="96px" />
          </button>
        ))}
      </div>
      {expanded && (
        <Dialog title={current.title} onClose={() => setExpanded(false)} variant="fullscreen" onKeyDown={(event) => {
          if (total < 2) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            nextPhoto(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}>
          <div className="gallery-lightbox" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
            onTouchCancel={() => { touchStart.current = null; }}>
            <GalleryImage key={current.photos[photo]} src={current.photos[photo]} previous={slide.previous} direction={slide.direction}
              description={description} sizes="100vw" eager />
            {navigation}
          </div>
        </Dialog>
      )}
    </div>
  );
}

function GalleryImage({ src, previous, direction, description, sizes, eager }: {
  src: string; previous?: string; direction: number; description: string; sizes: string; eager?: boolean;
}) {
  const [settled, setSettled] = useState(false);
  const transitioning = !!previous && previous !== src;
  return (
    <>
      {transitioning && !settled && <Image src={previous} className="photo-previous" alt="" aria-hidden="true" fill sizes={sizes} />}
      <Image className="photo-enter" data-transition={transitioning} data-direction={direction}
        src={src} alt={description} fill sizes={sizes} loading={eager || transitioning ? "eager" : undefined}
        onLoad={(event) => { if (transitioning) event.currentTarget.dataset.loaded = "true"; }}
        onAnimationEnd={(event) => { if (event.animationName === "photo-in") setSettled(true); }} />
    </>
  );
}
