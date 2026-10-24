/** The design canvas's outer box: the 780×360 grid area plus 8px padding on each side. */
export const DESIGN_H = 376;
export const MIN_W = 716;

/** Scale the fixed-height design canvas to the viewport; width grows to fill. */
export function fitTable(viewportW: number, viewportH: number): { scale: number; width: number; height: number } {
  const scale = Math.min(viewportH / DESIGN_H, viewportW / MIN_W);
  return { scale, width: viewportW / scale, height: DESIGN_H };
}
