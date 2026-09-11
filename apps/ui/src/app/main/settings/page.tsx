"use client";

import Logo from "@/components/mine/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchProviderSettings,
  PROVIDER_META,
  PROVIDER_ORDER,
  type ProviderKey,
  type ProviderState,
} from "@/lib/ai-providers";

type DraftState = { apiKey: string; baseUrl: string; model: string };

function emptyDraft(): DraftState {
  return { apiKey: "", baseUrl: "", model: "" };
}

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderState[] | null>(null);
  const [drafts, setDrafts] = useState<Record<ProviderKey, DraftState>>(() => {
    const initial = {} as Record<ProviderKey, DraftState>;
    for (const provider of PROVIDER_ORDER) initial[provider] = emptyDraft();
    return initial;
  });
  const [savingProvider, setSavingProvider] = useState<ProviderKey | null>(null);

  const loadProviders = async () => {
    try {
      setProviders(await fetchProviderSettings());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load provider settings");
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const updateDraft = (provider: ProviderKey, patch: Partial<DraftState>) => {
    setDrafts((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  };

  const handleSave = async (provider: ProviderKey, setAsDefault: boolean) => {
    const meta = PROVIDER_META[provider];
    const draft = drafts[provider];
    const existing = providers?.find((row) => row.provider === provider);

    if (meta.keyRequired && !existing?.configured && !draft.apiKey.trim()) {
      toast.error(`Add an API key for ${meta.label}`);
      return;
    }
    if (meta.modelRequired && !existing?.model && !draft.model.trim()) {
      toast.error(`${meta.label} requires a model name`);
      return;
    }

    setSavingProvider(provider);
    try {
      const body: Record<string, unknown> = { setAsDefault };
      if (draft.apiKey.trim()) body.apiKey = draft.apiKey.trim();
      if (draft.baseUrl.trim()) body.baseUrl = draft.baseUrl.trim();
      if (draft.model.trim()) body.model = draft.model.trim();

      const response = await fetch(`/api/orin/settings/providers/${provider}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not save provider settings");

      updateDraft(provider, emptyDraft());
      await loadProviders();
      toast.success(`${meta.label} saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save provider settings");
    } finally {
      setSavingProvider(null);
    }
  };

  const handleRemove = async (provider: ProviderKey) => {
    setSavingProvider(provider);
    try {
      const response = await fetch(`/api/orin/settings/providers/${provider}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Could not remove provider");
      }
      updateDraft(provider, emptyDraft());
      await loadProviders();
      toast.success(`${PROVIDER_META[provider].label} removed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove provider");
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full justify-center bg-background px-6 py-10 sm:px-10">
      <div className="flex w-full max-w-3xl flex-col items-start justify-center">
        <div className="flex w-full items-center justify-between gap-6">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground">
              Add your own API keys, or point at a local model. Your keys are encrypted at rest and only used for
              your own requests.
            </p>
          </div>
          <Link href="/main">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-3.5" />
              Back to dashboard
            </Button>
          </Link>
        </div>

        <div className="mt-8 flex w-full flex-col gap-4">
          {providers === null && <p className="text-sm text-muted-foreground">Loading providers…</p>}

          {providers?.map((row) => {
            const meta = PROVIDER_META[row.provider];
            const draft = drafts[row.provider];
            const busy = savingProvider === row.provider;

            return (
              <Card key={row.provider}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {meta.label}
                      {row.isDefault && (
                        <Badge variant="secondary">
                          <Check className="size-3" />
                          Default
                        </Badge>
                      )}
                      {!row.isDefault && row.configured && <Badge variant="outline">Connected</Badge>}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
                  </div>
                  {row.configured && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleRemove(row.provider)}>
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {row.provider === "LOCAL" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${row.provider}-baseUrl`}>Base URL</Label>
                      <Input
                        id={`${row.provider}-baseUrl`}
                        placeholder={row.baseUrl || meta.baseUrlPlaceholder}
                        value={draft.baseUrl}
                        onChange={(event) => updateDraft(row.provider, { baseUrl: event.target.value })}
                      />
                    </div>
                  )}

                  {meta.needsKey && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${row.provider}-key`}>API key</Label>
                      <Input
                        id={`${row.provider}-key`}
                        type="password"
                        placeholder={row.keyHint || "sk-…"}
                        value={draft.apiKey}
                        onChange={(event) => updateDraft(row.provider, { apiKey: event.target.value })}
                        autoComplete="off"
                      />
                    </div>
                  )}

                  {row.provider === "LOCAL" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${row.provider}-key-optional`}>API key (optional)</Label>
                      <Input
                        id={`${row.provider}-key-optional`}
                        type="password"
                        placeholder={row.keyHint || "leave blank if not required"}
                        value={draft.apiKey}
                        onChange={(event) => updateDraft(row.provider, { apiKey: event.target.value })}
                        autoComplete="off"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${row.provider}-model`}>
                      Model{meta.modelRequired ? "" : " (optional override)"}
                    </Label>
                    <Input
                      id={`${row.provider}-model`}
                      placeholder={row.model || row.defaultModel || meta.modelPlaceholder}
                      value={draft.model}
                      onChange={(event) => updateDraft(row.provider, { model: event.target.value })}
                    />
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-3">
                    <Button size="sm" disabled={busy} onClick={() => handleSave(row.provider, false)}>
                      Save
                    </Button>
                    {row.configured && !row.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => handleSave(row.provider, true)}
                      >
                        Use as default
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
