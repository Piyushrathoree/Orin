import Image from "next/image"

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features-section" },
      { label: "Workflow", href: "#workflow-section" },
      { label: "FAQ", href: "#faq-section" },
    ],
  },
  {
    title: "Workspace",
    links: [
      { label: "Open workspace", href: "/main" },
      { label: "AI provider settings", href: "/main/settings" },
      { label: "Create with a prompt", href: "/main" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Code editor", href: "#workflow-section" },
      { label: "Live preview", href: "#workflow-section" },
      { label: "GitHub export", href: "#faq-section" },
    ],
  },
]

export function FooterSection() {
  return (
    <footer className="mx-auto flex w-full max-w-[1320px] flex-col items-start justify-between gap-8 px-5 py-10 md:flex-row md:gap-0 md:py-[70px]">
      <div className="flex flex-col items-start gap-8 p-4 md:p-8">
        <div className="flex items-stretch justify-center gap-1">
          <Image src="/Orin-logo.svg" alt="Orin logo" width={32} height={32} />
          <div className="self-center text-center text-xl font-semibold leading-4 text-foreground">Orin</div>
        </div>
        <p className="text-left text-sm font-medium leading-[18px] text-foreground/90">
          A browser workspace for building React apps with AI.
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-8 p-4 md:w-auto md:grid-cols-3 md:gap-12 md:p-8">
        {footerColumns.map((column) => (
          <div key={column.title} className="flex flex-col items-start gap-3">
            <h3 className="text-sm font-medium leading-5 text-muted-foreground">{column.title}</h3>
            <div className="flex flex-col items-start gap-2">
              {column.links.map((link) => (
                <a key={link.label} href={link.href} className="text-sm font-normal leading-5 text-foreground hover:underline">
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  )
}
