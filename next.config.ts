import type { NextConfig } from "next";

const pagesBasePath = process.env.NEXT_PUBLIC_TROY_BASE_PATH;

const config: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  devIndicators: false,
  images: { unoptimized: true },
};

const serverRoutes: NextConfig = {
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

export default pagesBasePath
  // The JavaScript hotel route requires the Node.js server.
  ? { ...config, basePath: pagesBasePath, output: "export", pageExtensions: ["ts", "tsx"] }
  : { ...config, ...serverRoutes };
