import Link from "next/link";
import { PageIntro } from "@/components/site-shell";
import { routes } from "@/lib/site";

export default function NotFound() {
  return (
    <>
      <PageIntro title="Страница не найдена" />
      <div className="container section"><Link className="button button-primary" href={routes.rooms}>К каталогу номеров</Link></div>
    </>
  );
}
