"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ComponentProps } from "react";
import { stayError } from "@/lib/dates";
import { readStay, stayHref } from "@/lib/site";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

function LinkWithStay({ href, ...props }: Props) {
  const stay = readStay(useSearchParams());
  return <Link {...props} href={stayError(stay) ? href : stayHref(href, stay)} />;
}

export function StayLink(props: Props) {
  return <Suspense fallback={<Link {...props} />}><LinkWithStay {...props} /></Suspense>;
}
