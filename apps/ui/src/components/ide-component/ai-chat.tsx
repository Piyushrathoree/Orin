"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { FileCode2, MessageSquare, Trash2 } from "lucide-react";
import type { FileSystemTree } from "@webcontainer/api";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "../ai-elements/conversation";
import { Message, MessageContent } from "../ai-elements/message";
import { Response } from "../ai-elements/response";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fileTreeToPrompt,
  getOrinResponseText,
  parseOrinActions,
  type OrinAction,
} from "@/lib/orin-artifact";
import {
  IdePromptComposer,
  type ComposerContextFile,
} from "./prompt-composer";

interface AiChatProps {
  fileStructure: FileSystemTree;
  onActionsGenerated?: (actions: OrinAction[]) => Promise<void> | void;
  currentFile?: ComposerContextFile | null;
  runtimeReady?: boolean;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: OrinAction[];
  actionStatus?: "pending" | "applied" | "cancelled";
};

type PendingActions = {
  actions: OrinAction[];
  messageId: string;
};

function actionSummary(actions: OrinAction[]) {
  const createdOrUpdated = actions.filter((action) => action.type === "file").length;
  const deleted = actions.filter((action) => action.type === "delete").length;
  const shellCommands = actions.filter((action) => action.type === "shell").length;
  const parts = [
    createdOrUpdated > 0 && `${createdOrUpdated} file${createdOrUpdated === 1 ? "" : "s"} updated`,
    deleted > 0 && `${deleted} file${deleted === 1 ? "" : "s"} deleted`,
    shellCommands > 0 && `${shellCommands} command${shellCommands === 1 ? "" : "s"} run`,
  ].filter(Boolean);

  return parts.join(" · ");
}

const AiChat: React.FC<AiChatProps> = ({
  fileStructure,
  onActionsGenerated,
  currentFile = null,
  runtimeReady = true,
}) => {
  const [chatPrompt, setChatPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "loading" | "error">("ready");
  const [error, setError] = useState<Error | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActions | null>(null);
  const [isApplyingActions, setIsApplyingActions] = useState(false);
  const loading = status === "loading";

  const pendingDeletions =
    pendingActions?.actions.filter((action) => action.type === "delete") ?? [];

  const applyActions = async (actions: OrinAction[]) => {
    await onActionsGenerated?.(actions);
  };

  const handleCancelPendingActions = () => {
    if (isApplyingActions) return;
    if (pendingActions) {
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingActions.messageId
            ? { ...message, actionStatus: "cancelled" }
            : message,
        ),
      );
    }
    setPendingActions(null);
    toast.info("AI changes were not applied.");
  };

  const handleConfirmPendingActions = async () => {
    if (!pendingActions) return;

    setIsApplyingActions(true);
    try {
      await applyActions(pendingActions.actions);
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingActions.messageId
            ? { ...message, actionStatus: "applied" }
            : message,
        ),
      );
      setPendingActions(null);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error("The AI changes could not be applied.");
      setError(nextError);
      toast.error(nextError.message);
    } finally {
      setIsApplyingActions(false);
    }
  };

  const handlePromptSubmit = async () => {
    const content = chatPrompt.trim();
    if (!content) {
      toast.error("Prompt cannot be empty");
      return;
    }
    if (loading || pendingActions || !runtimeReady) {
      toast.info(
        runtimeReady
          ? "Finish the pending AI changes before sending another message."
          : "Wait for the preview runtime to finish starting.",
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setChatPrompt("");
    setError(null);
    setStatus("loading");

    try {
      const response = await fetch("/api/orin/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
          context: fileTreeToPrompt(fileStructure),
        }),
      });
      const payload = (await response.json()) as {
        response?: string;
        error?: string;
      };

      if (!response.ok || !payload.response) {
        throw new Error(payload.error || "The Orin backend could not respond.");
      }

      const actions = parseOrinActions(payload.response);
      const responseText = getOrinResponseText(payload.response);
      const assistantContent =
        responseText ||
        (actions.length > 0 ? "Updated the project files." : payload.response);

      const assistantMessageId = `assistant-${Date.now()}`;
      const requiresConfirmation = actions.some((action) => action.type === "delete");
      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: "assistant",
          content: assistantContent,
          actions,
          actionStatus: actions.length > 0 ? (requiresConfirmation ? "pending" : "applied") : undefined,
        },
      ]);

      if (requiresConfirmation) {
        setPendingActions({ actions, messageId: assistantMessageId });
      } else if (actions.length > 0) {
        await applyActions(actions);
      }

      setStatus("ready");
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error("The assistant could not complete the request.");
      setError(nextError);
      setStatus("error");
      toast.error(nextError.message);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AlertDialog
        open={pendingActions !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelPendingActions();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDeletions.length} file{pendingDeletions.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Any updates in this AI response will be applied only after you confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-40 overflow-y-auto rounded-md border bg-muted/40 p-2 font-mono text-xs">
            {pendingDeletions.map((action) => (
              <li key={action.path} className="py-1">
                {action.path}
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplyingActions}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isApplyingActions}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmPendingActions();
              }}
            >
              {isApplyingActions ? "Applying..." : "Apply changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <Conversation className="absolute inset-0 mask-b-from-80% pb-32">
          <ConversationContent className="gap-3 p-3">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-8" />}
                title="No messages yet"
                description="Start chatting with Orin."
              />
            ) : (
              <>
                {messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      <Response>{message.content}</Response>
                      {message.actions && message.actions.length > 0 && (
                        <div className="flex items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground">
                          {message.actions.some((action) => action.type === "delete") ? (
                            <Trash2 className="size-3" />
                          ) : (
                            <FileCode2 className="size-3" />
                          )}
                          {message.actionStatus === "pending"
                            ? "Changes awaiting approval"
                            : message.actionStatus === "cancelled"
                              ? "Changes not applied"
                              : actionSummary(message.actions)}
                        </div>
                      )}
                    </MessageContent>
                  </Message>
                ))}

                {loading && (
                  <div className="flex justify-start p-2">
                    <Skeleton className="h-10 w-40" />
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                {error.message}
              </div>
            )}
          </ConversationContent>

          <ConversationScrollButton />
        </Conversation>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-background via-background/80 to-transparent" />
        <div className="pointer-events-auto absolute inset-x-2.5 bottom-2.5 z-10">
          <IdePromptComposer
            value={chatPrompt}
            onChange={setChatPrompt}
            onSubmit={() => void handlePromptSubmit()}
            disabled={loading || pendingActions !== null || !runtimeReady}
            loading={loading}
            currentFile={currentFile}
            placeholder={
              runtimeReady
                ? "Plan, search, build anything"
                : "Waiting for the preview runtime..."
            }
          />
        </div>
      </div>
    </div>
  );
};

export default AiChat;
