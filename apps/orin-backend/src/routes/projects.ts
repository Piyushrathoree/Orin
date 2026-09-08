import { Router, type Request } from "express";
import { Prisma, prisma } from "@orin/db";
import type { ErrorResponse } from "../types";

const router = Router();

function readText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

function readTree(value: unknown): Prisma.InputJsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Prisma.InputJsonObject;
}

function userIdFromRequest(req: Request) {
  return req.user?.id ?? null;
}

function projectResponse(project: {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  files: { tree: Prisma.JsonValue } | null;
}) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    tree: project.files?.tree ?? {},
  };
}

async function findOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { files: true },
  });
}

router.get("/", async (req, res) => {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" } satisfies ErrorResponse);
    return;
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ projects });
  } catch (error) {
    console.error("[Orin API] Project list failed:", error);
    res.status(500).json({ error: "Could not load projects" } satisfies ErrorResponse);
  }
});

router.post("/", async (req, res) => {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" } satisfies ErrorResponse);
    return;
  }

  const name = readText(req.body?.name, "Untitled project", 100);
  const description = readText(req.body?.description, "", 500);
  const tree = readTree(req.body?.tree) ?? {};

  try {
    const project = await prisma.project.create({
      data: {
        name: name || "Untitled project",
        description,
        userId,
        files: { create: { tree } },
      },
      include: { files: true },
    });
    res.status(201).json({ project: projectResponse(project) });
  } catch (error) {
    console.error("[Orin API] Project creation failed:", error);
    res.status(500).json({ error: "Could not create project" } satisfies ErrorResponse);
  }
});

router.get("/:projectId", async (req, res) => {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" } satisfies ErrorResponse);
    return;
  }

  try {
    const project = await findOwnedProject(req.params.projectId, userId);
    if (!project) {
      res.status(404).json({ error: "Project not found" } satisfies ErrorResponse);
      return;
    }
    res.json({ project: projectResponse(project) });
  } catch (error) {
    console.error("[Orin API] Project load failed:", error);
    res.status(500).json({ error: "Could not load project" } satisfies ErrorResponse);
  }
});

router.put("/:projectId/files", async (req, res) => {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" } satisfies ErrorResponse);
    return;
  }

  const tree = readTree(req.body?.tree);
  if (!tree) {
    res.status(400).json({ error: "tree must be an object" } satisfies ErrorResponse);
    return;
  }

  try {
    const project = await findOwnedProject(req.params.projectId, userId);
    if (!project) {
      res.status(404).json({ error: "Project not found" } satisfies ErrorResponse);
      return;
    }

    const files = await prisma.projectFiles.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, tree },
      update: { tree },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    });
    res.json({ tree: files.tree });
  } catch (error) {
    console.error("[Orin API] Project files save failed:", error);
    res.status(500).json({ error: "Could not save project files" } satisfies ErrorResponse);
  }
});

router.delete("/:projectId", async (req, res) => {
  const userId = userIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" } satisfies ErrorResponse);
    return;
  }

  try {
    const project = await findOwnedProject(req.params.projectId, userId);
    if (!project) {
      res.status(404).json({ error: "Project not found" } satisfies ErrorResponse);
      return;
    }

    await prisma.project.delete({ where: { id: project.id } });
    res.status(204).end();
  } catch (error) {
    console.error("[Orin API] Project deletion failed:", error);
    res.status(500).json({ error: "Could not delete project" } satisfies ErrorResponse);
  }
});

export default router;
