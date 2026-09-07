/** Size a textarea to its content, up to `maxPx`, after which it scrolls. */
export function fitHeight(el: HTMLTextAreaElement, maxPx: number): void {
  el.style.height = "auto";
  const overflowing = el.scrollHeight > maxPx;
  el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  el.style.overflowY = overflowing ? "auto" : "hidden";
}
