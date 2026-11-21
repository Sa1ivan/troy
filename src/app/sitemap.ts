import type { MetadataRoute } from "next";
import { indexedPaths, site } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexedPaths.map((path) => ({ url: site.url + encodeURI(path) }));
}
