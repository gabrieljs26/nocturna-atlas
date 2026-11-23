import Link from "next/link";
import { ArrowUpRight, Orbit } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <Link href="/" className="footer-brand" aria-label="Nocturna, inicio">
          <Orbit size={20} aria-hidden="true" />
          <span>Nocturna.</span>
        </Link>
        <span className="footer-copy">Atlas de observación astronómica</span>
        <a href="https://github.com/gabrieljs26/nocturna-atlas#referencias-y-cr%C3%A9ditos" target="_blank" rel="noreferrer" className="footer-source">
          Fuentes y créditos <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
