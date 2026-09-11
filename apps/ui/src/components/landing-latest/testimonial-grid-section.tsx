import Image from "next/image"

const workflowCards = [
  {
    quote:
      "Describe what you want to build in the prompt launcher. Orin creates the starting project and opens it in a workspace.",
    name: "Maya Chen",
    detail: "Prompt launcher",
    avatar: "/images/avatars/maya-chen.png",
    type: "large-teal",
  },
  {
    quote:
      "Open the generated files in the Explorer and edit them directly in the code editor. Save when the change is ready.",
    name: "Jordan Ellis",
    detail: "Code editor",
    avatar: "/images/avatars/jordan-ellis.png",
    type: "small-dark",
  },
  {
    quote:
      "Ask Orin to add a feature or fix a bug. Its response can create, update, or delete files in the project.",
    name: "Priya Nair",
    detail: "AI chat",
    avatar: "/images/avatars/priya-nair.png",
    type: "small-dark",
  },
  {
    quote:
      "Run your package scripts and commands in the built-in terminal. Dependency and file changes stay with the project.",
    name: "Owen Brooks",
    detail: "Terminal",
    avatar: "/images/avatars/owen-brooks.png",
    type: "small-dark",
  },
  {
    quote:
      "Use the live preview to see each update as it lands, then switch between desktop, tablet, and mobile views.",
    name: "Sofia Martinez",
    detail: "Live preview",
    avatar: "/images/avatars/sofia-martinez.png",
    type: "small-dark",
  },
  {
    quote:
      "Open the same room with a teammate, chat in the workspace, and keep code changes synchronized as you work.",
    name: "Ethan Williams",
    detail: "Collaboration",
    avatar: "/images/avatars/ethan-williams.png",
    type: "small-dark",
  },
  {
    quote:
      "When the project is ready, export it directly to GitHub. Your files and project structure leave the workspace with you.",
    name: "Leila Hassan",
    detail: "GitHub export",
    avatar: "/images/avatars/leila-hassan.png",
    type: "large-light",
  },
]

type WorkflowCard = (typeof workflowCards)[number]

const WorkflowCard = ({ quote, name, detail, avatar, type }: WorkflowCard) => {
  const isLargeCard = type.startsWith("large")
  const avatarSize = isLargeCard ? 48 : 36
  const padding = isLargeCard ? "p-6" : "p-[30px]"

  let cardClasses = `flex flex-col justify-between items-start overflow-hidden rounded-[10px] shadow-[0px_2px_4px_rgba(0,0,0,0.08)] relative ${padding}`
  let quoteClasses = ""
  let nameClasses = ""
  let detailClasses = ""
  let backgroundElements = null
  let cardHeight = ""
  const cardWidth = "w-full md:w-[384px]"

  if (type === "large-teal") {
    cardClasses += " bg-primary"
    quoteClasses += " text-primary-foreground text-2xl font-medium leading-8"
    nameClasses += " text-primary-foreground text-base font-normal leading-6"
    detailClasses += " text-primary-foreground/60 text-base font-normal leading-6"
    cardHeight = "h-[502px]"
    backgroundElements = (
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/large-card-background.svg')", zIndex: 0 }}
      />
    )
  } else if (type === "large-light") {
    cardClasses += " bg-[rgba(231,236,235,0.12)]"
    quoteClasses += " text-foreground text-2xl font-medium leading-8"
    nameClasses += " text-foreground text-base font-normal leading-6"
    detailClasses += " text-muted-foreground text-base font-normal leading-6"
    cardHeight = "h-[502px]"
    backgroundElements = (
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: "url('/images/large-card-background.svg')", zIndex: 0 }}
      />
    )
  } else {
    cardClasses += " bg-card outline outline-1 outline-border outline-offset-[-1px]"
    quoteClasses += " text-foreground/80 text-[17px] font-normal leading-6"
    nameClasses += " text-foreground text-sm font-normal leading-[22px]"
    detailClasses += " text-muted-foreground text-sm font-normal leading-[22px]"
    cardHeight = "h-[244px]"
  }

  return (
    <div className={`${cardClasses} ${cardWidth} ${cardHeight}`}>
      {backgroundElements}
      <div className={`relative z-10 font-normal break-words ${quoteClasses}`}>{quote}</div>
      <div className="relative z-10 flex justify-start items-center gap-3">
        <Image
          src={avatar}
          alt={`${name} avatar`}
          width={avatarSize}
          height={avatarSize}
          className={`${isLargeCard ? "size-12" : "size-9"} rounded-full object-cover`}
          style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
        />
        <div className="flex flex-col justify-start items-start gap-0.5">
          <div className={nameClasses}>{name}</div>
          <div className={detailClasses}>{detail}</div>
        </div>
      </div>
    </div>
  )
}

export function WorkflowGridSection() {
  return (
    <section className="w-full px-5 overflow-hidden flex flex-col justify-start py-6 md:py-8 lg:py-14">
      <div className="self-stretch py-6 md:py-8 lg:py-14 flex flex-col justify-center items-center gap-2">
        <div className="flex flex-col justify-start items-center gap-4">
          <h2 className="text-center text-foreground text-3xl md:text-4xl lg:text-[40px] font-semibold leading-tight md:leading-tight lg:leading-[40px]">
            From prompt to running project
          </h2>
          <p className="self-stretch text-center text-muted-foreground text-sm md:text-sm lg:text-base font-medium leading-[18.20px] md:leading-relaxed lg:leading-relaxed">
            {"Ask, edit, run, preview, and share from the same workspace."} <br />{" "}
            {"Here’s what actually happens inside Orin."}
          </p>
        </div>
      </div>
      <div className="w-full pt-0.5 pb-4 md:pb-6 lg:pb-10 flex flex-col md:flex-row justify-center items-start gap-4 md:gap-4 lg:gap-6 max-w-[1100px] mx-auto">
        <div className="flex-1 flex flex-col justify-start items-start gap-4 md:gap-4 lg:gap-6">
          <WorkflowCard {...workflowCards[0]} />
          <WorkflowCard {...workflowCards[1]} />
        </div>
        <div className="flex-1 flex flex-col justify-start items-start gap-4 md:gap-4 lg:gap-6">
          <WorkflowCard {...workflowCards[2]} />
          <WorkflowCard {...workflowCards[3]} />
          <WorkflowCard {...workflowCards[4]} />
        </div>
        <div className="flex-1 flex flex-col justify-start items-start gap-4 md:gap-4 lg:gap-6">
          <WorkflowCard {...workflowCards[5]} />
          <WorkflowCard {...workflowCards[6]} />
        </div>
      </div>
    </section>
  )
}
