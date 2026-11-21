import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = {
  title: "Help & about",
  description:
    "Shipping, returns and contact details for Nile Goods, plus a note about this demo store. All of it is demo copy.",
};

const sections = [
  {
    id: "shipping",
    title: "Shipping",
    body: "Orders over $50 ship free; below that, shipping is a flat $6. Most orders would leave our studio within two working days.",
  },
  {
    id: "returns",
    title: "Returns",
    body: "If something isn’t right, you would have 30 days to send it back unused for a full refund.",
  },
  {
    id: "contact",
    title: "Contact",
    body: "There is no real inbox for this shop. In a live store this is where the support email and opening hours would go.",
  },
  {
    id: "about",
    title: "Our story",
    body: "Nile Goods is an invented brand: a small shop of well-made everyday objects for the home, kitchen, desk and bag, named after a river that has carried trade for thousands of years.",
  },
  {
    id: "makers",
    title: "Makers",
    body: "The products, workshops and people behind them are fictional. Every illustration was drawn for this project as a hand-made SVG.",
  },
  {
    id: "demo",
    title: "About this demo",
    body: "This is a portfolio project. There are no real payments, no real orders and no accounts. Your cart is stored on a local server using a random id in a cookie, and nothing is sent anywhere else.",
  },
];

export default function InfoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 lg:pt-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Help & about" }]} />
      <h1 className="mt-6 text-2xl sm:text-3xl">Help &amp; about</h1>
      <p className="mt-3 text-lg text-muted">
        Everything on this page is demo copy for a fictional shop.
      </p>
      <div className="mt-10 divide-y divide-line rounded-xl border border-line bg-surface">
        {sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="p-6 sm:p-8">
            <h2 id={`${s.id}-heading`} className="text-xl">
              {s.title}
            </h2>
            <p className="mt-2 text-muted">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
