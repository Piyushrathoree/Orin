"use client";

import dynamic from "next/dynamic";
import { use, useState } from "react";
import { readProjectPrompt } from "@/lib/initial-prompt";

const IDEComponent = dynamic(() => import("../_ide-component"), {
  ssr: false,
});

export default function RoomPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [initialPrompt] = useState(
    () => readProjectPrompt(projectId) ?? undefined,
  );
  return <IDEComponent projectId={projectId} initialPrompt={initialPrompt} />;
}
