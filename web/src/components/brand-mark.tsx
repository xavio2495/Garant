import Image from "next/image";

// The Garant logo, in the aurora gradient, teal through ice to violet
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return <Image src="/brand/garant-logo.svg" alt="" width={64} height={64} unoptimized aria-hidden className={className} />;
}
