/**
 * Focus an input and keep it visible above the mobile keyboard.
 * Scrolls within the nearest overflow container (panel main), not the window.
 * iOS often needs delayed retries after the keyboard animation.
 */
export function focusFieldIntoView(
  element: HTMLElement | null | undefined,
): void {
  if (!element) return;
  element.focus({ preventScroll: true });
  scheduleScrollFieldIntoView(element);
}

/** Scroll the currently focused field into view (after keyboard resize). */
export function ensureActiveFieldVisible(): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (!isEditableField(active)) return;
  scheduleScrollFieldIntoView(active);
}

function isEditableField(element: HTMLElement): boolean {
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (element.getAttribute("type") ?? "text").toLowerCase();
  return ![
    "button",
    "submit",
    "reset",
    "checkbox",
    "radio",
    "file",
    "image",
    "range",
    "hidden",
    "color",
  ].includes(type);
}

function findScrollParent(element: HTMLElement): HTMLElement | null {
  const marked = element.closest("[data-panel-scroll]");
  if (marked instanceof HTMLElement) return marked;

  let node: HTMLElement | null = element.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1;
    if (canScroll) return node;
    node = node.parentElement;
  }
  return null;
}

function scrollFieldIntoView(element: HTMLElement): void {
  const parent = findScrollParent(element);
  if (!parent) {
    element.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
    return;
  }

  const parentRect = parent.getBoundingClientRect();
  const fieldRect = element.getBoundingClientRect();
  const padding = 24;
  const fieldTop = fieldRect.top - parentRect.top + parent.scrollTop;
  const fieldBottom = fieldTop + fieldRect.height;
  const visibleTop = parent.scrollTop + padding;
  const visibleBottom = parent.scrollTop + parent.clientHeight - padding;

  if (fieldTop < visibleTop) {
    parent.scrollTo({ top: Math.max(0, fieldTop - padding), behavior: "auto" });
    return;
  }
  if (fieldBottom > visibleBottom) {
    parent.scrollTo({
      top: Math.max(0, fieldBottom - parent.clientHeight + padding),
      behavior: "auto",
    });
  }
}

function scheduleScrollFieldIntoView(element: HTMLElement): void {
  const run = () => {
    if (
      document.activeElement !== element &&
      !(
        document.activeElement instanceof Node &&
        element.contains(document.activeElement)
      )
    ) {
      return;
    }
    scrollFieldIntoView(element);
  };

  requestAnimationFrame(() => {
    run();
    window.setTimeout(run, 100);
    window.setTimeout(run, 280);
    window.setTimeout(run, 500);
  });
}
