"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Bookmark, Compass, MoonStar, Orbit } from "lucide-react";
import { useObservations } from "@/components/observations";

const lightPreference = "nocturna:red-light";
let inMemoryLight = false;

function subscribeToLight(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(lightPreference, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(lightPreference, onChange);
  };
}

function readLight() {
  try {
    return window.localStorage.getItem(lightPreference) === "on";
  } catch {
    return inMemoryLight;
  }
}

function writeLight(enabled: boolean) {
  inMemoryLight = enabled;
  try {
    window.localStorage.setItem(lightPreference, enabled ? "on" : "off");
  } catch {
    // The switch still works for this visit when browser storage is disabled.
  }
  window.dispatchEvent(new Event(lightPreference));
}

function RedLightToggle() {
  const enabled = useSyncExternalStore(subscribeToLight, readLight, () => false);

  useEffect(() => {
    if (enabled) document.documentElement.dataset.light = "red";
    else delete document.documentElement.dataset.light;
  }, [enabled]);

  return (
    <button className="light-toggle" type="button" aria-label="Luz roja" aria-pressed={enabled} title="Luz roja" onClick={() => writeLight(!enabled)}>
      <MoonStar size={17} aria-hidden="true" />
      <span>Luz roja</span>
    </button>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { objectIds } = useObservations();
  const listActive = pathname === "/mi-lista";

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="wordmark" aria-label="Nocturna, inicio">
          <span className="brand-icon"><Orbit size={21} strokeWidth={1.65} aria-hidden="true" /></span>
          <span>Nocturna<span className="wordmark-period">.</span></span>
        </Link>
        <nav className="main-nav" aria-label="Principal">
          <Link href="/" className="nav-link" aria-current={listActive ? undefined : "page"}>
            <Compass size={16} aria-hidden="true" />Atlas
          </Link>
          <Link href="/mi-lista" className="nav-link" aria-current={listActive ? "page" : undefined}>
            <Bookmark size={16} aria-hidden="true" />Mi lista
            {objectIds.length > 0 && <span aria-hidden="true" className="nav-count">{objectIds.length}</span>}
          </Link>
          <RedLightToggle />
        </nav>
      </div>
    </header>
  );
}
