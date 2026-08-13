"use client";

import dynamic from "next/dynamic";
import { use } from "react";

const IDEComponent = dynamic(() => import("./_ide-component"), {
  ssr: false,
});

export default function RoomPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  const params = use(searchParams);
  const prompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;

  return <IDEComponent initialPrompt={prompt} />;
}
