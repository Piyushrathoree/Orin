import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import AiChat from "./ai-chat";
import PeerChat from "./peer-chat";
import type { ComposerContextFile } from "./prompt-composer";
import type { FileSystemTree } from "@webcontainer/api";
import type { OrinAction } from "@/lib/orin-artifact";

interface ChatProps {
  onClose: () => void;
  projectId?: string;
  roomConnection: any;
  fileStructure: FileSystemTree;
  onActionsGenerated?: (actions: OrinAction[]) => Promise<void> | void;
  currentFile?: ComposerContextFile | null;
}

const Chat: React.FC<ChatProps> = ({
  onClose,
  projectId,
  roomConnection,
  fileStructure,
  onActionsGenerated,
  currentFile = null,
}) => {
  const [activeTab, setActiveTab] = useState<"ai" | "peer">("ai");

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2">
        <div className="flex rounded-md bg-muted p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("ai")}
            className={cn(
              "h-6 gap-1.5 px-2 text-[11px] font-medium shadow-none",
              activeTab === "ai" && "bg-accent shadow-xs",
            )}
          >
            <Sparkles className="size-3" />
            Chat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("peer")}
            className={cn(
              "h-6 gap-1.5 px-2 text-[11px] font-medium shadow-none",
              activeTab === "peer" && "bg-accent shadow-xs",
            )}
          >
            <Users className="size-3" />
            Peer
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "absolute inset-0",
            activeTab === "ai"
              ? "visible z-10 opacity-100"
              : "invisible z-0 opacity-0",
          )}
        >
          <AiChat
            fileStructure={fileStructure}
            onActionsGenerated={onActionsGenerated}
            currentFile={currentFile}
          />
        </div>
        <div
          className={cn(
            "absolute inset-0",
            activeTab === "peer"
              ? "visible z-10 opacity-100"
              : "invisible z-0 opacity-0",
          )}
        >
          <PeerChat projectId={projectId} roomConnection={roomConnection} />
        </div>
      </div>
    </div>
  );
};

export default Chat;
