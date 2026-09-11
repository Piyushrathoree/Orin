"use client";

import { AppPageShell } from "@/components/mine/app-page-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteNodeModulesSnapshot } from "@/lib/node-modules-cache";
import {
  createProjectFiles,
  DEFAULT_PROJECT_NAME,
  getLegacyProjectStorageKey,
  getPreviousProjectStorageKey,
  getProjectStorageKey,
  PROJECT_TEMPLATE_VERSION,
  sanitizeProjectName,
  TEMPLATE_VERSION_STORAGE_KEY,
} from "@/data/project-file";
import {
  acquirePromptCreateLock,
  releasePromptCreateLock,
  savePendingPrompt,
  saveProjectPrompt,
  takePendingPrompt,
} from "@/lib/initial-prompt";
import {
  ArrowLeft,
  ArrowUpRight,
  FolderPlus,
  LogOut,
  MessageSquarePlus,
  Settings,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

type LocalProject = {
  id: string;
  name: string;
  createdAt: string | number;
};

const PROJECTS_STORAGE_KEY = "orin:projects";

const projectTypes: {
  icon: LucideIcon;
  name: string;
  description: string;
}[] = [
  {
    icon: FolderPlus,
    name: "Start new Project",
    description: "Start with a React (Vite) app",
  },
  {
    icon: MessageSquarePlus,
    name: "Create With Prompt",
    description: "Generate an app from a prompt",
  },
  {
    icon: Users,
    name: "Collab with friends",
    description: "Coming soon",
  },
];

function readProjects(): LocalProject[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as LocalProject[]) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: LocalProject[]) {
  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function saveLocalProject(project: LocalProject, tree: ReturnType<typeof createProjectFiles>) {
  const existing = readProjects().filter((item) => item.id !== project.id);
  saveProjects([project, ...existing].slice(0, 5));
  window.localStorage.setItem(
    TEMPLATE_VERSION_STORAGE_KEY,
    String(PROJECT_TEMPLATE_VERSION),
  );
  window.localStorage.setItem(
    getProjectStorageKey(project.id),
    JSON.stringify(tree),
  );
  window.localStorage.removeItem(getLegacyProjectStorageKey(project.id));
  window.localStorage.removeItem(getPreviousProjectStorageKey(project.id));
}

function readRemoteProject(value: unknown): LocalProject | null {
  if (!value || typeof value !== "object") return null;
  const project = value as { id?: unknown; name?: unknown; createdAt?: unknown };
  if (
    typeof project.id !== "string" ||
    typeof project.name !== "string" ||
    (typeof project.createdAt !== "string" && typeof project.createdAt !== "number")
  ) {
    return null;
  }
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
  };
}

async function loadRemoteProjects() {
  const response = await fetch("/api/orin/projects", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load projects");
  const payload = (await response.json()) as { projects?: unknown };
  return Array.isArray(payload.projects)
    ? payload.projects.flatMap((project) => {
        const parsed = readRemoteProject(project);
        return parsed ? [parsed] : [];
      })
    : [];
}

async function createRemoteProject(name: string) {
  const trimmedName = name.trim() || DEFAULT_PROJECT_NAME;
  const tree = createProjectFiles(sanitizeProjectName(trimmedName));
  const response = await fetch("/api/orin/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: trimmedName, tree }),
  });
  const payload = (await response.json().catch(() => ({}))) as { project?: unknown; error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not create project");

  const project = readRemoteProject(payload.project);
  if (!project) throw new Error("Project service returned an invalid project");
  saveLocalProject(project, tree);
  return project;
}

function projectNameFromPrompt(prompt: string): string {
  return (
    sanitizeProjectName(prompt.split(/\s+/).slice(0, 5).join(" ")) ||
    DEFAULT_PROJECT_NAME
  );
}

const Page = () => {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState(DEFAULT_PROJECT_NAME);
  const [promptText, setPromptText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Read browser storage after hydration so the server and client render match.
    void loadRemoteProjects()
      .then((remoteProjects) => setProjects(remoteProjects.length > 0 ? remoteProjects : readProjects()))
      .catch(() => setProjects(readProjects()))
      .finally(() => setProjectsLoading(false));
  }, []);

  useEffect(() => {
    if (!acquirePromptCreateLock()) return;

    const prompt = takePendingPrompt();
    if (!prompt) {
      releasePromptCreateLock();
      return;
    }

    const existing = readProjects();
    if (existing.length >= 5) {
      savePendingPrompt(prompt);
      releasePromptCreateLock();
      toast.error("You reached the 5 project limit. Delete a project to generate a new one.");
      return;
    }

    const name = projectNameFromPrompt(prompt);
    void createRemoteProject(name)
      .then((project) => {
        saveProjectPrompt(project.id, prompt);
        releasePromptCreateLock();
        window.location.assign(`/room/${project.id}`);
      })
      .catch((error: unknown) => {
        savePendingPrompt(prompt);
        releasePromptCreateLock();
        toast.error(error instanceof Error ? error.message : "Could not create project");
      });
  }, []);

  const projectCount = projects.length;
  const isAtProjectLimit = projectCount >= 5;

  const formatCreationTime = (timestampMs: string | number) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestampMs));

  const handleEnterRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectName.trim() || isCreating || isAtProjectLimit) return;

    setIsCreating(true);
    try {
      const project = await createRemoteProject(projectName.trim());
      setProjects((previous) => [project, ...previous].slice(0, 5));
      setIsDialogOpen(false);
      setProjectName(DEFAULT_PROJECT_NAME);
      window.location.assign(`/room/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateWithPrompt = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = promptText.trim();
    if (!trimmed || isCreating || isAtProjectLimit) return;

    setIsCreating(true);
    try {
      const project = await createRemoteProject(projectNameFromPrompt(trimmed));
      saveProjectPrompt(project.id, trimmed);
      setProjects((previous) => [project, ...previous].slice(0, 5));
      setIsPromptDialogOpen(false);
      setPromptText("");
      window.location.assign(`/room/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (deletingProjectId) return;

    setDeletingProjectId(projectId);
    try {
      const response = await fetch(`/api/orin/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Could not delete project");
      }
      const nextProjects = projects.filter((project) => project.id !== projectId);
      saveProjects(nextProjects);
      window.localStorage.removeItem(getProjectStorageKey(projectId));
      window.localStorage.removeItem(getPreviousProjectStorageKey(projectId));
      window.localStorage.removeItem(getLegacyProjectStorageKey(projectId));
      void deleteNodeModulesSnapshot(projectId);
      setProjects(nextProjects);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete project");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/sign-in");
  };

  const visibleProjects = projects.slice(0, 5);

  return (
    <AppPageShell
      actions={
        <>
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="size-3.5" />
              Back to landing
            </Link>
          </Button>
          <Link href="/main/settings">
            <Button variant="outline" size="sm">
              <Settings className="size-3.5" />
              Settings
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </>
      }
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build, preview, and collaborate from one focused workspace.
        </p>
      </div>

        <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {projectTypes.map((item, index) => {
            const isCollabCard = index === 2;
            const disabled = isAtProjectLimit || isCollabCard;
            const Icon = item.icon;
            const card = (
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border border-border bg-card/60 p-4 text-left transition-colors duration-150",
                  disabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:border-primary/40 hover:bg-primary/5",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            );

            if (index === 0) {
              return (
                <Dialog
                  key={item.name}
                  open={isDialogOpen}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (open) setProjectName(DEFAULT_PROJECT_NAME);
                  }}
                >
                  <DialogTrigger asChild disabled={isAtProjectLimit}>
                    {card}
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Enter project details</DialogTitle>
                      <DialogDescription>
                        Add a project name to continue.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEnterRoom} className="grid gap-4">
                      <Input
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        placeholder="my-app"
                        autoFocus
                      />
                      <DialogFooter>
                        <Button
                          type="submit"
                          disabled={
                            !projectName.trim() || isCreating || isAtProjectLimit
                          }
                        >
                          {isCreating ? "Creating..." : "Continue"}
                        </Button>
                      </DialogFooter>
                      {isAtProjectLimit && (
                        <p className="text-xs text-muted-foreground">
                          You reached the 5 project limit. Delete a project to
                          create a new one.
                        </p>
                      )}
                    </form>
                  </DialogContent>
                </Dialog>
              );
            }

            if (index === 1) {
              return (
                <Dialog
                  key={item.name}
                  open={isPromptDialogOpen}
                  onOpenChange={(open) => {
                    setIsPromptDialogOpen(open);
                    if (open) setPromptText("");
                  }}
                >
                  <DialogTrigger asChild disabled={isAtProjectLimit}>
                    {card}
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create with prompt</DialogTitle>
                      <DialogDescription>
                        Describe the app you want Orin to build. Generation
                        starts after the workspace boots.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateWithPrompt} className="grid gap-4">
                      <Textarea
                        value={promptText}
                        onChange={(event) => setPromptText(event.target.value)}
                        placeholder="Describe the app you want Orin to build..."
                        className="min-h-28"
                        autoFocus
                      />
                      <DialogFooter>
                        <Button
                          type="submit"
                          disabled={
                            !promptText.trim() || isCreating || isAtProjectLimit
                          }
                        >
                          {isCreating ? "Creating..." : "Continue"}
                        </Button>
                      </DialogFooter>
                      {isAtProjectLimit && (
                        <p className="text-xs text-muted-foreground">
                          You reached the 5 project limit. Delete a project to
                          create a new one.
                        </p>
                      )}
                    </form>
                  </DialogContent>
                </Dialog>
              );
            }

            return <div key={item.name}>{card}</div>;
          })}
        </div>

        <div className="mt-10 flex w-full items-center justify-between">
          <div>
            <p className="text-sm font-medium">Recent projects</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Continue where you left off.
            </p>
          </div>
          <div className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            {projectsLoading ? "…" : `${projectCount} total`}
          </div>
        </div>

        <div
          className="mt-4 grid w-full gap-2"
          aria-busy={projectsLoading}
          aria-live="polite"
        >
          {projectsLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3.5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            ))
          ) : visibleProjects.length === 0 ? (
            <div className="flex h-28 items-center rounded-xl border border-dashed border-border px-4 text-sm text-muted-foreground">
              No projects yet. Start a new one above.
            </div>
          ) : (
            visibleProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{project.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCreationTime(project.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" asChild>
                    <Link href={`/room/${project.id}`}>
                      Open
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${project.name}`}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete project</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{project.name}&quot; and
                          its files.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => handleDeleteProject(project.id)}
                          disabled={deletingProjectId === project.id}
                        >
                          {deletingProjectId === project.id
                            ? "Deleting..."
                            : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>

        {projectCount > 5 && (
          <p className="mt-4 w-full text-xs text-muted-foreground">
            You reached the 5 project limit. Delete a project to create a new
            one.
          </p>
        )}
    </AppPageShell>
  );
};

export default Page;
