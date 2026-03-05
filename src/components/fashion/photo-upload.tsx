"use client";

import { useState, useRef, useCallback } from "react";

interface PhotoUploadProps {
  onUpload: (url: string) => void;
  value?: string;
}

export function PhotoUpload({ onUpload, value }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB.");
      return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch("/api/upload-photo", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setPreview(data.url);
      onUpload(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRemove = () => {
    setPreview(null);
    onUpload("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      {preview ? (
        <div className="relative w-full aspect-square max-w-[200px] rounded-xl overflow-hidden border border-[var(--surface-border)] bg-[var(--surface-hover)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your photo" className="w-full h-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs cursor-pointer border-none hover:bg-black/80"
          >
            x
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`w-full max-w-[200px] aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
            dragOver
              ? "border-[#22c55e] bg-[rgba(34,197,94,0.06)]"
              : "border-[var(--surface-border)] bg-[var(--surface-hover)] hover:border-[var(--text-muted)]"
          }`}
        >
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" className="text-[var(--text-muted)]">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-[0.7rem] text-[var(--text-muted)] text-center px-2">
            Drop photo here or click to browse
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error && (
        <p className="text-[0.7rem] text-[var(--error)]">{error}</p>
      )}
    </div>
  );
}
