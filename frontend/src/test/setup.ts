import "@testing-library/jest-dom/vitest";

import { createElement } from "react";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// ── Polyfills que jsdom no trae y Radix UI / ECharts necesitan ────────────────

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

globalThis.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof matchMedia;

// Radix usa estas APIs de puntero, que jsdom no implementa.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// ── ECharts ───────────────────────────────────────────────────────────────────
// ECharts pinta sobre <canvas>, que jsdom no implementa. Se sustituye el wrapper
// por un div con `data-testid="echart"` que expone la opción serializada, de
// modo que los tests puedan comprobar QUÉ se le pasa al gráfico sin renderizarlo.
vi.mock("@/components/charts/EChart", () => ({
  EChart: ({ option, className }: { option: unknown; className?: string }) =>
    createElement("div", {
      "data-testid": "echart",
      "data-option": JSON.stringify(option),
      className,
    }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
