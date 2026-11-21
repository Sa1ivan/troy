import type { NextConfig } from "next";

const config: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  devIndicators: false,
  images: { unoptimized: true },
  async rewrites() {
    // Keep the original public URLs with ASCII segments in the App Router's cache.
    return { beforeFiles: [
      { source: encodeURI("/номера/бронирование/"), destination: "/rooms/booking/" },
      { source: encodeURI("/номера/") + ":category/", destination: "/rooms/:category/" },
      { source: encodeURI("/номера/"), destination: "/rooms/" },
      { source: encodeURI("/цены/"), destination: "/prices/" },
      { source: encodeURI("/фото/"), destination: "/photos/" },
      { source: encodeURI("/контакт/"), destination: "/contacts/" },
      { source: encodeURI("/отзывы/"), destination: "/reviews/" },
    ], afterFiles: [], fallback: [] };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default config;
