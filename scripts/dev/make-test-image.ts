/** Writes tests/fixtures/sample-photo.jpg: a 900x700 JPEG with EXIF (incl. fake GPS) to prove uploads strip metadata. */
import sharp from "sharp";

async function main() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700">
    <rect width="900" height="700" fill="#D9E4D6"/>
    <circle cx="450" cy="360" r="210" fill="#2F5D50"/>
    <rect x="330" y="250" width="240" height="220" rx="28" fill="#F3E1D5"/>
    <text x="450" y="380" font-size="54" text-anchor="middle" font-family="Georgia" fill="#9A4A24">Demo</text>
  </svg>`;
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 85 })
    .withExif({
      IFD0: { Make: "DemoCam", Model: "Example 1", Copyright: "Invented test image" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "30/1 2/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "31/1 14/1 0/1",
      },
    })
    .toFile("tests/fixtures/sample-photo.jpg");
  const meta = await sharp("tests/fixtures/sample-photo.jpg").metadata();
  console.log("fixture written; has exif:", !!meta.exif);
}
main();
