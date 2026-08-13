import Image from "next/image";

const Logo = () => {
  return (
    <div className="flex items-center gap-1">
      <Image
        src="/Orin-logo.svg"
        alt="Orin logo"
        width={40}
        height={40}
        className="h-10 w-10"
        priority
      />
      <span className="text-2xl font-semibold text-foreground">Orin</span>
    </div>
  );
};

export default Logo;
