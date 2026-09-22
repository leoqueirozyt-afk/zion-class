import Image from "next/image";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Zion Class"
      width={48}
      height={48}
      priority
      className={`object-cover ${className}`}
    />
  );
}
