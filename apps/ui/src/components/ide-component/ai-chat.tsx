"use client";

import React, { useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { FileCode2, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
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

interface AiChatProps {
  fileStructure: FileSystemTree;
  onActionsGenerated?: (actions: OrinAction[]) => Promise<void> | void;
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
  const parts = [
    createdOrUpdated > 0 && `${createdOrUpdated} file${createdOrUpdated === 1 ? "" : "s"} updated`,
    deleted > 0 && `${deleted} file${deleted === 1 ? "" : "s"} deleted`,
  ].filter(Boolean);

  return parts.join(" · ");
}

const AiChat: React.FC<AiChatProps> = ({
  fileStructure,
  onActionsGenerated,
}) => {
  const [chatPrompt, setChatPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "loading" | "error">("ready");
  const [error, setError] = useState<Error | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActions | null>(null);
  const [isApplyingActions, setIsApplyingActions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (loading || pendingActions) {
      toast.info("Finish the pending AI changes before sending another message.");
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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handlePromptSubmit();
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

      <div className="flex shrink-0 items-center gap-1 border-b bg-muted/40 px-3 py-2.5">
        <Badge
          variant="outline"
          className="gap-1.5 rounded-none border-primary/30 bg-primary/10 py-0.5 text-primary"
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <div className="size-1.5 bg-primary" />}
          AI Assistant
        </Badge>
        <Badge variant="secondary" className="rounded-none py-0.5 text-xs">
          {loading ? "Thinking..." : status === "error" ? "Error" : "Ready"}
        </Badge>
      </div>

      <Conversation className="w-full pb-26 mask-b-from-80%">
        <ConversationContent className="gap-3 p-3">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-12" />}
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

      <div className="shrink-0 border-t bg-background p-3">
        <ButtonGroup className="flex w-full flex-1">
          <Input
            ref={inputRef}
            placeholder="Type your message..."
            value={chatPrompt}
            onChange={(event) => setChatPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            className="h-10 w-full flex-1 border px-3 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
          />
          <Button
            onClick={() => void handlePromptSubmit()}
            disabled={!chatPrompt.trim() || loading || pendingActions !== null}
            size="icon"
            className="h-10 w-10 shrink-0 bg-primary text-primary-foreground shadow-sm hover:bg-primary-dark"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
};

export default AiChat;
