import * as THREE from "three";

export const KREMLIN_DISPLAY_FONT =
  '"Kremlin", "VT323", "Courier Prime", monospace';

type CanvasRedrawEntry = {
  canvasRef: WeakRef<HTMLCanvasElement>;
  texRef: WeakRef<THREE.CanvasTexture>;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  postDraw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
};

const pendingCanvasEntries: CanvasRedrawEntry[] = [];
const pendingCallbacks = new Set<() => void>();
let fontPromise: Promise<void> | null = null;
let fontsResolved = false;

function ensureKremlinFontsLoaded(): Promise<void> {
  if (fontsResolved) return Promise.resolve();
  if (fontPromise) return fontPromise;

  if (typeof document === "undefined" || !("fonts" in document)) {
    fontsResolved = true;
    return Promise.resolve();
  }

  fontPromise = Promise.allSettled([
    document.fonts.load('400 24px "Kremlin"'),
    document.fonts.load('700 24px "Kremlin"'),
    document.fonts.load('900 32px "Kremlin"'),
    document.fonts.load('700 24px "VT323"'),
    document.fonts.load('700 20px "Courier Prime"'),
  ])
    .then(() => document.fonts.ready)
    .then(() => {
      fontsResolved = true;
      const entries = pendingCanvasEntries.splice(0, pendingCanvasEntries.length);
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const canvas = entry.canvasRef.deref();
        const tex = entry.texRef.deref();
        if (!canvas || !tex) continue;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        entry.draw(ctx, canvas.width, canvas.height);
        entry.postDraw?.(ctx, canvas.width, canvas.height);
        ctx.restore();
        tex.needsUpdate = true;
      }

      const callbacks = Array.from(pendingCallbacks);
      pendingCallbacks.clear();
      for (let i = 0; i < callbacks.length; i++) {
        callbacks[i]();
      }
    });

  return fontPromise;
}

export function registerKremlinCanvasRedraw(
  canvas: HTMLCanvasElement,
  tex: THREE.CanvasTexture,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  postDraw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): void {
  if (fontsResolved) return;
  pendingCanvasEntries.push({
    canvasRef: new WeakRef(canvas),
    texRef: new WeakRef(tex),
    draw,
    postDraw,
  });
  void ensureKremlinFontsLoaded();
}

export function onKremlinFontReady(cb: () => void): () => void {
  if (fontsResolved) {
    let active = true;
    queueMicrotask(() => {
      if (active) cb();
    });
    return () => {
      active = false;
    };
  }
  pendingCallbacks.add(cb);
  void ensureKremlinFontsLoaded();
  return () => {
    pendingCallbacks.delete(cb);
  };
}
