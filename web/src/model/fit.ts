export const DESIGN_H = 360;
export const MIN_W = 700;

/** Scale the fixed-height design canvas to the viewport; width grows to fill. */
export function fitTable(viewportW: number, viewportH: number): { scale: number; width: number; height: number } {
  const scale = Math.min(viewportH / DESIGN_H, viewportW / MIN_W);
  return { scale, width: viewportW / scale, height: DESIGN_H };
}
