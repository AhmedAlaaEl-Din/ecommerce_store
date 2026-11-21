// Invented demo catalog for the fictional brand "Nile Goods".
// All names, copy and prices are made up for this portfolio project.

export type SeedCategory = {
  slug: string;
  name: string;
  description: string;
  accentColor: string;
};

export type SeedProduct = {
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  compareAtCents?: number;
  stock: number;
  isFeatured?: boolean;
  /** Days before the fixed seed epoch; smaller = newer. */
  ageDays: number;
};

export const SEED_EPOCH = new Date("2026-11-01T09:00:00.000Z");

export const categories: SeedCategory[] = [
  {
    slug: "home",
    name: "Home",
    description: "Quiet pieces that make a room feel lived in: ceramics, linen and warm light.",
    accentColor: "#E8D9C4",
  },
  {
    slug: "kitchen",
    name: "Kitchen",
    description: "Everyday tools for slow mornings and long dinners, made to be used daily.",
    accentColor: "#D9E4D6",
  },
  {
    slug: "stationery",
    name: "Stationery",
    description: "Paper, pens and desk companions for lists, letters and good ideas.",
    accentColor: "#E4DCEB",
  },
  {
    slug: "bags",
    name: "Bags",
    description: "Hard-wearing canvas and leather bags for markets, commutes and weekends away.",
    accentColor: "#F1D9C9",
  },
];

export const products: SeedProduct[] = [
  // Home
  {
    slug: "dune-ceramic-vase",
    name: "Dune Ceramic Vase",
    category: "home",
    shortDescription: "A hand-thrown stoneware vase with a soft clay glaze.",
    description:
      "Thrown on the wheel and finished in a matte clay glaze that pools slightly at the shoulder, the Dune vase holds a few dried stems or a single fresh branch. Each one varies a little in tone.",
    priceCents: 4800,
    stock: 14,
    isFeatured: true,
    ageDays: 3,
  },
  {
    slug: "lumen-table-lamp",
    name: "Lumen Table Lamp",
    category: "home",
    shortDescription: "A slim brass-stem lamp with a green linen shade.",
    description:
      "A compact table lamp with a weighted base, a slim stem and a tapered linen shade that throws a warm, even glow. Sized for bedside tables and reading corners.",
    priceCents: 12900,
    stock: 0,
    isFeatured: true,
    ageDays: 12,
  },
  {
    slug: "reed-linen-cushion",
    name: "Reed Linen Cushion",
    category: "home",
    shortDescription: "Stonewashed linen cushion with woven clay stripes.",
    description:
      "Heavyweight stonewashed linen with a woven stripe, a hidden zip and a feather-blend insert. Softens with every wash.",
    priceCents: 5400,
    stock: 22,
    ageDays: 20,
  },
  {
    slug: "ember-soy-candle",
    name: "Ember Soy Candle",
    category: "home",
    shortDescription: "Fig, cedar and smoke in a reusable green glass jar.",
    description:
      "A slow-burning soy wax candle with a cotton wick and notes of fig leaf, cedar and a little woodsmoke. Around 45 hours of burn time; the jar makes a good pen pot afterwards.",
    priceCents: 3200,
    stock: 40,
    isFeatured: true,
    ageDays: 6,
  },
  {
    slug: "oasis-stoneware-planter",
    name: "Oasis Stoneware Planter",
    category: "home",
    shortDescription: "A terracotta-toned planter with a deep drainage tray.",
    description:
      "A tapered stoneware planter with a matching rim tray and drainage hole, sized for a medium houseplant. Unglazed outside, sealed inside.",
    priceCents: 3800,
    stock: 18,
    ageDays: 28,
  },
  {
    slug: "tide-wool-throw",
    name: "Tide Wool Throw",
    category: "home",
    shortDescription: "A soft lambswool throw in river green with fringed ends.",
    description:
      "Woven from soft lambswool in a twill pattern with a hand-knotted fringe. Generous enough for a sofa or the end of a bed.",
    priceCents: 9600,
    compareAtCents: 12800,
    stock: 9,
    isFeatured: true,
    ageDays: 15,
  },
  // Kitchen
  {
    slug: "delta-pour-over-kettle",
    name: "Delta Pour-Over Kettle",
    category: "kitchen",
    shortDescription: "A gooseneck kettle for a slow, steady pour.",
    description:
      "A stovetop gooseneck kettle with a narrow spout for precise pour-over brewing, a heat-safe handle and a 1-litre capacity.",
    priceCents: 7200,
    stock: 2,
    isFeatured: true,
    ageDays: 2,
  },
  {
    slug: "basalt-stoneware-mug",
    name: "Basalt Stoneware Mug",
    category: "kitchen",
    shortDescription: "A speckled cream mug with a dark dipped rim.",
    description:
      "A generous 350 ml mug in speckled stoneware with a dark dipped rim and a thumb-friendly handle. Dishwasher and microwave safe.",
    priceCents: 1900,
    compareAtCents: 2600,
    stock: 60,
    ageDays: 8,
  },
  {
    slug: "grove-olive-wood-board",
    name: "Grove Olive Wood Board",
    category: "kitchen",
    shortDescription: "A solid olive wood board with a rounded handle.",
    description:
      "Cut from a single piece of olive wood with a natural, swirling grain. For chopping, serving bread or a board of cheese. Oil it now and then and it will last for years.",
    priceCents: 5800,
    stock: 12,
    ageDays: 30,
  },
  {
    slug: "sahel-salad-bowl",
    name: "Sahel Salad Bowl",
    category: "kitchen",
    shortDescription: "A wide sand-glazed bowl for salads and sharing.",
    description:
      "A wide, shallow serving bowl in sand-glazed stoneware with a painted green band, made for salads, grains and fruit on the table.",
    priceCents: 4400,
    stock: 16,
    isFeatured: true,
    ageDays: 10,
  },
  {
    slug: "ibis-enamel-teapot",
    name: "Ibis Enamel Teapot",
    category: "kitchen",
    shortDescription: "A cream enamel teapot with a clay lid and stainless infuser.",
    description:
      "A 900 ml enamel-coated teapot with a removable stainless infuser for loose leaf tea, a clay-coloured lid and a heat-safe handle.",
    priceCents: 6200,
    stock: 1,
    ageDays: 18,
  },
  {
    slug: "market-glass-carafe",
    name: "Market Glass Carafe",
    category: "kitchen",
    shortDescription: "A mouth-blown carafe with a matching tumbler.",
    description:
      "A one-litre carafe in light, mouth-blown glass, with a tumbler that doubles as a lid. For water by the bed or on the dinner table.",
    priceCents: 3600,
    stock: 25,
    ageDays: 24,
  },
  // Stationery
  {
    slug: "scribe-linen-notebook",
    name: "Scribe Linen Notebook",
    category: "stationery",
    shortDescription: "A lay-flat A5 notebook with a linen cover and dotted pages.",
    description:
      "160 pages of 100 gsm dotted paper in a cloth-bound linen cover with an elastic closure and a ribbon marker. Lays flat for writing and sketching.",
    priceCents: 1800,
    compareAtCents: 2400,
    stock: 80,
    isFeatured: true,
    ageDays: 5,
  },
  {
    slug: "atlas-fountain-pen",
    name: "Atlas Fountain Pen",
    category: "stationery",
    shortDescription: "A balanced fountain pen with a medium steel nib.",
    description:
      "A resin-bodied fountain pen with a smooth medium steel nib, a sprung clip and a converter for bottled ink. Writes from the first stroke.",
    priceCents: 6800,
    stock: 1,
    ageDays: 4,
  },
  {
    slug: "ledger-desk-planner",
    name: "Ledger Desk Planner",
    category: "stationery",
    shortDescription: "An undated weekly planner on a sturdy spiral binding.",
    description:
      "An undated weekly planner with 60 spreads, a monthly overview and a heavy board back so it stands up on the desk.",
    priceCents: 2600,
    stock: 35,
    ageDays: 22,
  },
  {
    slug: "meridian-desk-tray",
    name: "Meridian Desk Tray",
    category: "stationery",
    shortDescription: "A powder-coated tray to keep pens and clips in one place.",
    description:
      "A low powder-coated steel tray with rounded corners, sized for pens, clips and the small things that drift across a desk.",
    priceCents: 2900,
    stock: 20,
    ageDays: 26,
  },
  {
    slug: "inkwell-ink-bottle",
    name: "Inkwell Ink Bottle",
    category: "stationery",
    shortDescription: "50 ml of deep violet fountain pen ink.",
    description:
      "A free-flowing, quick-drying fountain pen ink in a deep violet that shades beautifully. 50 ml in a heavy glass bottle with a wide base.",
    priceCents: 1600,
    stock: 45,
    ageDays: 14,
  },
  {
    slug: "sketch-pencil-cup",
    name: "Sketch Pencil Cup Set",
    category: "stationery",
    shortDescription: "Four graphite pencils in a glazed ceramic cup.",
    description:
      "A glazed ceramic cup with four cedar pencils in mixed grades, from hard to soft. A tidy start for a new desk.",
    priceCents: 2400,
    stock: 30,
    ageDays: 9,
  },
  // Bags
  {
    slug: "caravan-canvas-tote",
    name: "Caravan Canvas Tote",
    category: "bags",
    shortDescription: "A heavy canvas tote with an inside pocket.",
    description:
      "Made from 16 oz cotton canvas with leather-wrapped handles, a woven stripe and an inside pocket for keys. Big enough for the market run.",
    priceCents: 3900,
    compareAtCents: 5200,
    stock: 28,
    isFeatured: true,
    ageDays: 7,
  },
  {
    slug: "nomad-roll-top-backpack",
    name: "Nomad Roll-Top Backpack",
    category: "bags",
    shortDescription: "A weather-resistant roll-top pack with a laptop sleeve.",
    description:
      "A waxed canvas roll-top backpack with a padded 15-inch laptop sleeve, a quick-access front pocket and adjustable straps with brass buckles.",
    priceCents: 14800,
    stock: 11,
    isFeatured: true,
    ageDays: 1,
  },
  {
    slug: "felucca-weekender-duffel",
    name: "Felucca Weekender Duffel",
    category: "bags",
    shortDescription: "A roomy duffel for two nights away.",
    description:
      "A 40-litre duffel in clay-coloured waxed canvas with leather straps, a full-length zip and a detachable shoulder strap.",
    priceCents: 16500,
    stock: 7,
    ageDays: 19,
  },
  {
    slug: "courier-leather-crossbody",
    name: "Courier Leather Crossbody",
    category: "bags",
    shortDescription: "A compact vegetable-tanned leather crossbody bag.",
    description:
      "A small crossbody bag in vegetable-tanned leather with a magnetic flap, an adjustable strap and room for a phone, wallet and keys.",
    priceCents: 11800,
    stock: 0,
    ageDays: 11,
  },
  {
    slug: "papyrus-zip-pouch",
    name: "Papyrus Zip Pouch",
    category: "bags",
    shortDescription: "A padded canvas pouch for chargers and small things.",
    description:
      "A lightly padded canvas pouch with a sturdy metal zip and a leather pull. Keeps cables, pens or travel bits together.",
    priceCents: 2200,
    stock: 50,
    ageDays: 16,
  },
  {
    slug: "bazaar-woven-market-bag",
    name: "Bazaar Woven Market Bag",
    category: "bags",
    shortDescription: "A hand-woven palm leaf basket bag with leather handles.",
    description:
      "Hand-woven from palm leaf with sturdy leather handles. Light, strong and roomy: for the market, the beach or the back of a bike.",
    priceCents: 4600,
    stock: 15,
    ageDays: 21,
  },
];
