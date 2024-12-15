export function fadeScale(
  node: Element, { delay = 0, duration = 200, easing = (x: any) => x, baseScale = 0 }: any
) {
  const o = +getComputedStyle(node).opacity;
  const m = getComputedStyle(node).transform.match(/scale\(([0-9.]+)\)/);
  const s = (m ? m[1] : 1) as number;
  const is = 1 - baseScale;

  return {
    delay,
    duration,
    css: (t: any) => {
      const eased = easing(t);
      return `opacity: ${eased * o}; transform: scale(${(eased * s * is) + baseScale})`;
    }
  };
}