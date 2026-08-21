// Author: Gemini
// OS support: Web/Node
// Description: Modal hỗ trợ cắt và xoay ảnh từ phía client

'use client';
import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface CropperModalProps {
  imageSrc: string;
  onCropComplete: (base64: string) => void;
  onCancel: () => void;
}

export default function CropperModal({ imageSrc, onCropComplete, onCancel }: CropperModalProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    x: 10,
    y: 10,
    width: 80,
    height: 80
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [rotation, setRotation] = useState(0);
  const [rotatedSrc, setRotatedSrc] = useState(imageSrc);
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate rotated image
  useEffect(() => {
    if (rotation === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRotatedSrc(imageSrc);
      return;
    }
    const timeout = setTimeout(() => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rotRad = (rotation * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rotRad));
        const cos = Math.abs(Math.cos(rotRad));
        canvas.width = image.width * cos + image.height * sin;
        canvas.height = image.height * cos + image.width * sin;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotRad);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
        setRotatedSrc(canvas.toDataURL('image/jpeg'));
      };
    }, 100); // debounce
    return () => clearTimeout(timeout);
  }, [rotation, imageSrc]);

  const getCroppedImg = () => {
    if (!completedCrop || !imgRef.current) {
        onCancel();
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    onCropComplete(canvas.toDataURL('image/jpeg'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl w-full flex flex-col min-h-0 max-h-[calc(100dvh-1rem)]">
        <h3 className="font-bold text-lg mb-4">Cắt và Xoay Ảnh</h3>
        
        <div className="flex-1 overflow-auto relative bg-slate-100 p-2 rounded min-h-[400px] flex items-center justify-center">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              ref={imgRef}
              src={rotatedSrc} 
              alt="Crop preview" 
              style={{ maxHeight: '60vh', objectFit: 'contain' }}
            />
          </ReactCrop>
        </div>

        <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <label className="text-xs">Xoay:</label>
                <input 
                    type="range" 
                    value={rotation} 
                    min={0} 
                    max={360} 
                    onChange={(e) => setRotation(Number(e.target.value))} 
                    className="w-full" 
                />
                <span className="text-xs">{rotation}°</span>
            </div>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button className="px-4 py-2 bg-slate-200 rounded text-sm" onClick={onCancel}>Hủy</button>
          <button className="px-4 py-2 bg-green-600 text-white rounded text-sm" onClick={getCroppedImg}>Xác Nhận Cắt</button>
        </div>
      </div>
    </div>
  );
}
// --- End of components/CropperModal.tsx ---
