"use client";

import { useEffect } from "react";

import { ensureActiveFieldVisible } from "@/lib/panel/focus-field";

/** Measure env(safe-area-inset-bottom) in px (0 when unavailable). */
function readSafeAreaBottomPx(): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:0;bottom:0;visibility:hidden;pointer-events:none;" +
    "padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  const value = Number.parseFloat(getComputedStyle(probe).paddingBottom);
  probe.remove();
  return Number.isFinite(value) ? value : 0;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target.getAttribute("type") ?? "text").toLowerCase();
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

/**
 * Keep the panel shell sized to the *visible* viewport.
 *
 * - Idle: size to layout height (+ safe-area on iOS PWA when needed).
 * - Keyboard open: shrink height to visualViewport.height and keep top at 0.
 *   Do NOT apply visualViewport.offsetTop as CSS `top` — that double-shifts
 *   with Safari’s own scroll and pushes the focused field off-screen.
 * - After shrink, scroll the focused field within the panel’s overflow main.
 */
export function PanelViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    let keyboardOpen = false;

    const lockWindowScroll = () => {
      window.scrollTo(0, 0);
      if (document.body.scrollTop) document.body.scrollTop = 0;
      if (root.scrollTop) root.scrollTop = 0;
    };

    const sync = (opts?: { fromFocus?: boolean }) => {
      const inset = readSafeAreaBottomPx();
      const vv = window.visualViewport;
      const layoutHeight = window.innerHeight + inset;

      if (vv) {
        // Covered portion of the layout viewport (keyboard / browser chrome).
        const obscured = Math.max(0, window.innerHeight - vv.height);
        const open = obscured > 80;

        if (open) {
          keyboardOpen = true;
          // Pin shell to the top of the layout viewport; only shrink height.
          root.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
          root.style.setProperty("--app-offset-top", "0px");
          root.style.setProperty("--safe-area-bottom", "0px");
          root.dataset.keyboard = "open";
          lockWindowScroll();
          window.requestAnimationFrame(() => {
            ensureActiveFieldVisible();
            window.setTimeout(ensureActiveFieldVisible, 120);
            window.setTimeout(ensureActiveFieldVisible, 350);
          });
        } else {
          const wasOpen = keyboardOpen;
          keyboardOpen = false;
          root.style.setProperty("--app-height", `${layoutHeight}px`);
          root.style.setProperty("--app-offset-top", "0px");
          root.style.setProperty("--safe-area-bottom", `${inset}px`);
          root.dataset.keyboard = "closed";
          if (wasOpen) lockWindowScroll();
        }
      } else {
        root.style.setProperty("--app-height", `${layoutHeight}px`);
        root.style.setProperty("--app-offset-top", "0px");
        root.style.setProperty("--safe-area-bottom", `${inset}px`);
        root.dataset.keyboard = "closed";
      }

      if (opts?.fromFocus) {
        window.requestAnimationFrame(() => {
          ensureActiveFieldVisible();
          window.setTimeout(ensureActiveFieldVisible, 280);
        });
      }
    };

    const onResize = () => sync();
    const onVvScroll = () => {
      if (keyboardOpen) lockWindowScroll();
      sync();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!isEditableTarget(event.target)) return;
      sync({ fromFocus: true });
    };
    const onFocusOut = () => {
      window.setTimeout(() => sync(), 150);
    };
    const onOrientation = () => {
      window.setTimeout(() => sync(), 250);
    };

    sync();
    const raf = window.requestAnimationFrame(() => sync());
    const t1 = window.setTimeout(() => sync(), 100);
    const t2 = window.setTimeout(() => sync(), 500);

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onVvScroll);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("orientationchange", onOrientation);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onVvScroll);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("orientationchange", onOrientation);
      delete root.dataset.keyboard;
    };
  }, []);

  return null;
}
