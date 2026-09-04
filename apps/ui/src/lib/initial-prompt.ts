const PENDING_PROMPT_KEY = "orin:pending-prompt";
const PROJECT_PROMPT_PREFIX = "orin:project-prompt:";
const CREATE_LOCK_KEY = "orin:creating-from-prompt";

export function savePendingPrompt(prompt: string) {
  if (typeof window === "undefined") return;

  const trimmed = prompt.trim();
  if (!trimmed) {
    window.sessionStorage.removeItem(PENDING_PROMPT_KEY);
    return;
  }

  window.sessionStorage.setItem(PENDING_PROMPT_KEY, trimmed);
}

function readPendingPrompt(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(PENDING_PROMPT_KEY)?.trim() || null;
}

export function takePendingPrompt(): string | null {
  const value = readPendingPrompt();
  if (value) {
    window.sessionStorage.removeItem(PENDING_PROMPT_KEY);
  }
  return value;
}

export function saveProjectPrompt(projectId: string, prompt: string) {
  if (typeof window === "undefined" || !projectId || !prompt.trim()) return;
  window.sessionStorage.setItem(
    `${PROJECT_PROMPT_PREFIX}${projectId}`,
    prompt.trim(),
  );
}

export function readProjectPrompt(projectId?: string): string | null {
  if (typeof window === "undefined" || !projectId) return null;
  return (
    window.sessionStorage.getItem(`${PROJECT_PROMPT_PREFIX}${projectId}`)?.trim() ||
    null
  );
}

export function consumeProjectPrompt(projectId?: string): string | null {
  const value = readProjectPrompt(projectId);
  if (value && projectId) {
    window.sessionStorage.removeItem(`${PROJECT_PROMPT_PREFIX}${projectId}`);
  }
  return value;
}

export function acquirePromptCreateLock(): boolean {
  if (typeof window === "undefined") return false;
  if (window.sessionStorage.getItem(CREATE_LOCK_KEY)) return false;
  window.sessionStorage.setItem(CREATE_LOCK_KEY, "1");
  return true;
}

export function releasePromptCreateLock() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CREATE_LOCK_KEY);
}
