import React, { useState, useRef } from "react";
import {
  CloudUpload,
  FileUp,
  Camera,
  Trash2,
  RefreshCw,
  Pencil,
  TriangleAlert,
  LoaderCircle,
  CircleCheck,
  Copy,
} from "lucide-react";
import { ContactRecord, QueueItem } from "../types";
import { scanCard } from "../lib/api";

interface ScanCardsProps {
  queue: QueueItem[];
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  records: ContactRecord[];
  onSaveRecord: (item: QueueItem, fields: Partial<ContactRecord>) => Promise<ContactRecord>;
  onOpenRecord: (recordId: string) => void;
  toast: (msg: string, type?: "ok" | "warn" | "err") => void;
}

/* ------------------------------------------------------------------
   PHOTO CLEAN-UP (har tarah ki photo ke liye)
   - Mobile ki EXIF rotation sahi karta hai (tedhi / ulti photo)
   - Badi photo ko 2200px tak rakhta hai (chhota text bhi saaf)
   - Andheri / fiki photo ka contrast + brightness auto-fix
   ------------------------------------------------------------------ */
const MAX_DIM = 2200;

const readAsDataURL = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("File read nahi hui."));
    reader.readAsDataURL(file);
  });

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" } as any);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error("decode failed"));
        img.src = url;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }
}

function autoEnhance(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  const step = Math.max(1, Math.floor((w * h) / 200000));
  let n = 0;
  for (let i = 0; i < d.length; i += 4 * step) {
    hist[(d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0]++;
    n++;
  }
  const pct = (p: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v; }
    return 255;
  };
  const lo = pct(0.01), hi = pct(0.99);
  const range = hi - lo;
  if (range >= 200 || range < 20) return; // photo pehle se theek hai / khali hai
  const scale = 255 / range;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = (v - lo) * scale;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(img, 0, 0);
}

async function prepareFile(file: File): Promise<{ dataUrl: string; mime: string }> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > 3 * 1024 * 1024) throw new Error("PDF 3 MB se badi hai. Card ki photo ya chhoti PDF upload karein.");
    return { dataUrl: await readAsDataURL(file), mime: "application/pdf" };
  }
  try {
    const src = await decodeImage(file);
    const sw = (src as any).width, sh = (src as any).height;
    const scale = Math.min(1, MAX_DIM / Math.max(sw, sh));
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src as any, 0, 0, w, h);
    autoEnhance(ctx, w, h);
    // Vercel upload limit (~4.5 MB) ke andar rakho
    let q = 0.92;
    let out = canvas.toDataURL("image/jpeg", q);
    while (out.length > 3_500_000 && q > 0.6) { q -= 0.08; out = canvas.toDataURL("image/jpeg", q); }
    return { dataUrl: out, mime: "image/jpeg" };
  } catch {
    // e.g. iPhone HEIC on Windows Chrome — original hi bhej do, AI padh lega
    return { dataUrl: await readAsDataURL(file), mime: file.type || "image/jpeg" };
  }
}

const generateLocalId = () =>
  "WC-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const last10 = (val: string) => (val || "").replace(/\D/g, "").slice(-10);

export default function ScanCards({ queue, setQueue, records, onSaveRecord, onOpenRecord, toast }: ScanCardsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mimeById = useRef<Record<string, string>>({});
  const recordsRef = useRef(records);
  recordsRef.current = records;

  const update = (id: string, patch: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const findDuplicate = (f: Partial<ContactRecord>, skipId: string) =>
    recordsRef.current.find((r) => {
      if (r.recordId === skipId) return false;
      const p = last10(f.mobile || "");
      const phone = p.length >= 10 && last10(r.mobile) === p;
      const email = f.email && r.email && r.email.trim().toLowerCase() === f.email.trim().toLowerCase();
      return phone || email;
    });

  // Scan -> clean -> AUTO SAVE (koi button nahi)
  const processItem = async (item: QueueItem) => {
    update(item.id, { status: "processing", error: undefined });
    try {
      const mime = mimeById.current[item.id] || "image/jpeg";
      const fields = await scanCard(item.id, item.dataUrl, mime);
      const dup = findDuplicate(fields, item.id);
      const saved = await onSaveRecord(item, fields);
      update(item.id, {
        status: "ready",
        fields: saved,
        suggestions: [fields.suggestions, dup ? `Ye contact pehle se hai: ${dup.name || dup.company}` : ""].filter(Boolean).join(" • "),
      });
      toast(`Saved — ${saved.name || saved.company || item.fileName}`, dup ? "warn" : "ok");
    } catch (err: any) {
      update(item.id, { status: "error", error: err?.message || "Failed" });
      toast(`Scan nahi hua: ${item.fileName}`, "err");
    }
  };

  const handleFilesUpload = async (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf" || /\.(pdf|heic|heif)$/i.test(f.name)
    );
    if (!valid.length) {
      toast("Photo (JPG, PNG, WEBP, HEIC) ya PDF upload karein.", "warn");
      return;
    }
    // 3-3 cards ek saath (fast but safe)
    const items: QueueItem[] = [];
    for (const f of valid) {
      const id = generateLocalId();
      let prepared;
      try { prepared = await prepareFile(f); }
      catch (e: any) { toast(e?.message || "File nahi khuli.", "err"); continue; }
      const { dataUrl, mime } = prepared;
      mimeById.current[id] = mime;
      const item: QueueItem = { id, fileName: f.name, dataUrl, status: "processing", fields: null };
      items.push(item);
      setQueue((prev) => [item, ...prev]);
    }
    let idx = 0;
    const worker = async () => {
      while (idx < items.length) await processItem(items[idx++]);
    };
    await Promise.all([worker(), worker(), worker()]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesUpload(e.dataTransfer.files);
  };

  const processing = queue.filter((q) => q.status === "processing").length;

  return (
    <div className="content">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="h1 text-2xl font-extrabold tracking-tight">Scan Cards</h1>
          <p className="sub text-sm text-[var(--muted)]">
            Photo lo ya upload karo — AI padhega aur card <b>apne aap cloud me save</b> ho jayega. Badlav karna ho to "Edit" dabao.
          </p>
        </div>
      </div>

      <div
        className={`dropzone text-center p-12 border-2 border-dashed rounded-2xl transition ${
          isDragging ? "drag border-[var(--blue)] bg-[var(--blue)]/5" : "border-[var(--border2)]"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <CloudUpload size={42} className="mx-auto text-[var(--blue)] mb-3" />
        <div className="font-extrabold text-base text-[var(--text)]">Drag & drop visiting cards here</div>
        <div className="sub text-xs text-[var(--muted)] mb-5">
          JPG • PNG • WEBP • HEIC • PDF — ek saath bahut saare cards bhi chalenge
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn bg-[var(--blue)] hover:bg-[var(--blue2)] text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 border-none cursor-pointer"
          >
            <FileUp size={16} /> Upload Files
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="btn bg-[var(--panel)] border border-[var(--border2)] font-bold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer text-[var(--text)] hover:border-[var(--blue)]"
          >
            <Camera size={16} /> Capture with Camera
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.heic,.heif" multiple hidden
          onChange={(e) => { handleFilesUpload(e.target.files); e.target.value = ""; }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { handleFilesUpload(e.target.files); e.target.value = ""; }} />
        <div className="text-[11px] text-[var(--faint)] mt-5">
          Tip: card ko poora frame me rakhein, flash ki chamak (glare) se bachein. Tedhi / andheri photo bhi chalegi.
        </div>
      </div>

      {queue.length > 0 && (
        <div className="card pad p-6 bg-[var(--panel)] border border-[var(--border)] rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="h2 text-base font-bold text-[var(--text)]">
              Scanned in this session ({queue.length}){processing > 0 && <span className="text-[var(--muted)] text-xs font-semibold"> — {processing} padh raha hai…</span>}
            </h2>
            {queue.some((q) => q.status === "ready") && (
              <button
                onClick={() => setQueue((prev) => prev.filter((q) => q.status !== "ready"))}
                className="text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                Clear saved from list
              </button>
            )}
          </div>
          <div className="space-y-3">
            {queue.map((item) => {
              const isPdf = mimeById.current[item.id] === "application/pdf" || /\.pdf$/i.test(item.fileName);
              return (
                <div key={item.id} className="queue-item flex gap-4 items-center p-4 border border-[var(--border)] rounded-xl bg-[var(--panel)]">
                  {isPdf ? (
                    <div className="w-16 h-10 rounded bg-[var(--bg2)] flex items-center justify-center border border-[var(--border)]">
                      <FileUp size={16} className="text-[var(--faint)]" />
                    </div>
                  ) : (
                    <img src={item.dataUrl} alt="Preview" className="w-16 h-10 object-cover rounded border border-[var(--border)]" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-[var(--text)] truncate">
                      {item.fields?.name || item.fields?.company || item.fileName}
                    </div>
                    {item.status === "processing" && (
                      <div className="sub text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                        <LoaderCircle size={12} className="spin text-[var(--blue)]" /> AI card padh raha hai…
                      </div>
                    )}
                    {item.status === "ready" && (
                      <>
                        <div className="sub text-xs flex items-center gap-1.5 mt-0.5" style={{ color: "var(--ok, #2fa262)" }}>
                          <CircleCheck size={12} />
                          <span className="truncate">
                            Saved • {[item.fields?.company, item.fields?.mobile, item.fields?.category].filter(Boolean).join(" • ")}
                          </span>
                        </div>
                        {item.suggestions && (
                          <div className="text-[11px] mt-1 flex items-start gap-1 text-[var(--warn)]">
                            {item.suggestions.includes("pehle se") ? <Copy size={12} className="shrink-0 mt-0.5" /> : <TriangleAlert size={12} className="shrink-0 mt-0.5" />}
                            <span>{item.suggestions}</span>
                          </div>
                        )}
                      </>
                    )}
                    {item.status === "error" && (
                      <div className="mt-1 text-xs text-[var(--err)] font-medium break-words whitespace-normal leading-relaxed">
                        {item.error || "Extraction failed."}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {item.status === "ready" && (
                      <button
                        onClick={() => onOpenRecord(item.id)}
                        className="btn sm bg-[var(--blue)] text-white hover:bg-[var(--blue2)] px-3 py-1.5 rounded-lg text-xs font-bold border-none flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    )}
                    {item.status === "error" && (
                      <button
                        onClick={() => processItem(item)}
                        className="btn sm bg-[var(--panel)] text-[var(--text)] hover:border-[var(--blue)] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={13} /> Retry
                      </button>
                    )}
                    {item.status !== "processing" && (
                      <button
                        onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                        className="iconbtn w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border border-[var(--border2)] text-[var(--muted)] hover:text-[var(--err)] hover:border-[var(--err)] bg-[var(--panel)]"
                        title={item.status === "ready" ? "List se hatao (record cloud me rahega)" : "Remove"}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
