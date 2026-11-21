import Link from "next/link";
import type { NavCategory } from "./SiteHeader";
import { Wordmark } from "./Wordmark";

export function SiteFooter({ categories }: { categories: NavCategory[] }) {
  const linkClass =
    "inline-flex min-h-11 items-center text-ink/80 underline-offset-4 hover:text-ink hover:underline sm:min-h-8";
  return (
    <footer className="border-line bg-surface mt-24 border-t">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <div className="col-span-2 max-w-xs md:col-span-1">
          <Wordmark />
          <p className="text-muted mt-3 text-sm">
            Well-made everyday objects for the home, kitchen, desk and bag. An invented brand for a
            portfolio project.
          </p>
        </div>
        <FooterColumn title="Shop">
          <li>
            <Link href="/products" className={linkClass}>
              All products
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/products?category=${c.slug}`} className={linkClass}>
                {c.name}
              </Link>
            </li>
          ))}
        </FooterColumn>
        <FooterColumn title="Help">
          <li>
            <Link href="/info#shipping" className={linkClass}>
              Shipping
            </Link>
          </li>
          <li>
            <Link href="/info#returns" className={linkClass}>
              Returns
            </Link>
          </li>
          <li>
            <Link href="/info#contact" className={linkClass}>
              Contact
            </Link>
          </li>
          <li>
            <Link href="/cart" className={linkClass}>
              Your cart
            </Link>
          </li>
        </FooterColumn>
        <FooterColumn title="About">
          <li>
            <Link href="/info#about" className={linkClass}>
              Our story
            </Link>
          </li>
          <li>
            <Link href="/info#makers" className={linkClass}>
              Makers
            </Link>
          </li>
          <li>
            <Link href="/info#demo" className={linkClass}>
              About this demo
            </Link>
          </li>
        </FooterColumn>
      </div>
      <div className="border-line border-t">
        <div className="text-muted mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <p className="text-ink font-medium">Demo store, portfolio project, no real orders.</p>
          <p>
            Shipping, returns and checkout promises on this site are demo copy. All products, prices
            and names are invented.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-muted font-sans text-xs font-semibold tracking-[0.08em] uppercase">
        {title}
      </h2>
      <ul className="mt-3 flex flex-col sm:gap-1">{children}</ul>
    </div>
  );
}
