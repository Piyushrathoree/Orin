"use client";

import Logo from "@/components/mine/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
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
import { ArrowUpRight, FolderDown, FolderOpen, Trash2 } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

type LocalProject = {
  id: string;
  name: string;
  createdAt: number;
};

const PROJECTS_STORAGE_KEY = "orin:projects";

const projectTypes = [
  {
    icon: <FolderOpen size={16} />,
    name: "Start new Project",
  },
  {
    icon: <FolderDown size={16} />,
    name: "Create With Prompt",
  },
  {
    icon: <FolderDown size={16} />,
    name: "Collab with friends",
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

function createProjectId() {
  return globalThis.crypto?.randomUUID?.() || `project-${Date.now()}`;
}

const Page = () => {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Read browser storage after hydration so the server and client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjects(readProjects());
  }, []);

  const projectCount = projects.length;
  const isAtProjectLimit = projectCount >= 5;

  const formatCreationTime = (timestampMs: number) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestampMs));

  const handleEnterRoom = (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectName.trim() || isCreating || isAtProjectLimit) return;

    setIsCreating(true);
    const project: LocalProject = {
      id: createProjectId(),
      name: projectName.trim(),
      createdAt: Date.now(),
    };
    const nextProjects = [project, ...projects].slice(0, 5);
    saveProjects(nextProjects);
    setProjects(nextProjects);
    setIsDialogOpen(false);
    setProjectName("");
    window.location.assign(`/room/${project.id}`);
  };

  const handleDeleteProject = (projectId: string) => {
    if (deletingProjectId) return;

    setDeletingProjectId(projectId);
    const nextProjects = projects.filter((project) => project.id !== projectId);
    saveProjects(nextProjects);
    window.localStorage.removeItem(`orin:project:${projectId}`);
    setProjects(nextProjects);
    setDeletingProjectId(null);
  };

  const visibleProjects = projects.slice(0, 5);

  return (
    <div className="relative flex min-h-screen w-full justify-center bg-background px-6 py-10 sm:px-10">
      <div className="flex w-full max-w-5xl flex-col items-start justify-center">
        <div className="flex w-full items-start justify-between gap-6">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground">
              Build, preview, and collaborate from one focused workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="hidden rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary sm:inline-flex"
            >
              Back to landing
            </Link>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {projectTypes.map((item, index) => (
              <DialogTrigger key={item.name} asChild disabled={isAtProjectLimit}>
                <div
                  className={
                    "group flex w-full flex-col rounded-xl border border-border bg-card/60 p-4 transition-all duration-150" +
                    (isAtProjectLimit
                      ? " cursor-not-allowed opacity-60"
                      : " cursor-pointer hover:border-primary/40 hover:bg-primary/5")
                  }
                >
                  {item.icon}
                  <span className="mt-3 text-sm font-medium">{item.name}</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {index === 0
                      ? "Start with a clean project"
                      : "Create a project to continue"}
                  </span>
                </div>
              </DialogTrigger>
            ))}
          </div>
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
                placeholder="Project name"
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
                  You reached the 5 project limit. Delete a project to create a
                  new one.
                </p>
              )}
            </form>
          </DialogContent>
        </Dialog>

        <div className="mt-10 flex w-full items-center justify-between">
          <div>
            <p className="text-sm font-medium">Recent projects</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Continue where you left off.
            </p>
          </div>
          <div className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            {projectCount} total
          </div>
        </div>

        <div className="mt-4 w-full space-y-2">
          {visibleProjects.map((project) => (
            <div
              key={project.id}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card/40 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="mr-4 flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {project.name}
                </span>
                <div className="text-xs text-muted-foreground">
                  Created At: {formatCreationTime(project.createdAt)}
                </div>
              </div>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      className="aspect-square cursor-pointer bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Trash2 />
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
                <Link href={`/room/${project.id}`}>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="aspect-square cursor-pointer px-3 text-sm font-medium hover:bg-primary/10 hover:text-primary"
                  >
                    <ArrowUpRight />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {projectCount > 5 && (
          <p className="mt-4 w-full text-xs text-muted-foreground">
            You reached the 5 project limit. Delete a project to create a new
            one.
          </p>
        )}
      </div>
    </div>
  );
};

export default Page;
