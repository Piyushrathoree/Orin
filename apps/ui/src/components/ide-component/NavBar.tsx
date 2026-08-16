import React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { X, Eye, Code, Monitor, Tablet, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import ExportGithubDialog from "./export-github";
import { FileIconCustom } from "./file-icon";
import { FileSystemTree } from "@webcontainer/api";
import { cn } from "@/lib/utils";

interface TabInfo {
  id: string;
  name: string;
  path: string;
  isDirty: boolean;
  content: string;
}

interface NavBarProps {
  openTabs: TabInfo[];
  currentTabId: string | null;
  setCurrentTabId: (id: string) => void;
  handleCloseTab: (id: string) => void;
  showAiChat: boolean;
  setShowAiChat: (v: boolean | ((prev: boolean) => boolean)) => void;
  showExplorer: boolean;
  setShowExplorer: (v: boolean | ((prev: boolean) => boolean)) => void;
  showTerminal: boolean;
  setShowTerminal: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleSaveCurrentFile: () => void;
  liveUrl: string | null;
  activeTab?: "code" | "preview";
  setActiveTab?: (tab: "code" | "preview") => void;
  previewDevice?: "desktop" | "tablet" | "mobile";
  setPreviewDevice?: (device: "desktop" | "tablet" | "mobile") => void;
  fileStructure: FileSystemTree;
  projectName?: string;
}

const NavBar: React.FC<NavBarProps> = ({
  openTabs,
  currentTabId,
  setCurrentTabId,
  handleCloseTab,
  activeTab = "code",
  setActiveTab = () => {},
  previewDevice = "desktop",
  setPreviewDevice = () => {},
  fileStructure,
  projectName,
}) => {
  const devices = [
    { id: "desktop", icon: Monitor, label: "Desktop" },
    { id: "tablet", icon: Tablet, label: "Tablet" },
    { id: "mobile", icon: Smartphone, label: "Mobile" },
  ] as const;

  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-sidebar pr-2">
      <div className="hide-scrollbar flex h-full flex-1 items-center overflow-x-auto">
        {openTabs.map((tab) => {
          const isActive = currentTabId === tab.id;
          return (
            <div
              key={tab.id}
              className={cn(
                "group relative flex h-full cursor-pointer items-center gap-1.5 border-t px-3 text-[13px] transition-colors",
                isActive
                  ? "border-t-primary bg-background text-foreground"
                  : "border-t-transparent bg-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
              onClick={() => setCurrentTabId(tab.id)}
            >
              <FileIconCustom filename={tab.name} className="size-3.5 shrink-0" />
              <span
                className={cn(
                  "max-w-[150px] truncate",
                  tab.isDirty && "text-amber-400",
                )}
              >
                {tab.name}
              </span>
              <button
                type="button"
                aria-label={`Close ${tab.name}`}
                className={cn(
                  "shrink-0 text-muted-foreground hover:text-foreground",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="ml-2 flex h-full items-center gap-1.5">
        <div className="flex h-7 items-center rounded-md bg-muted p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("code")}
            className={cn(
              "h-6 rounded-sm px-2 text-xs shadow-none",
              activeTab === "code" && "bg-accent shadow-xs",
            )}
          >
            <Code className="mr-1 size-3" />
            Code
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("preview")}
            className={cn(
              "h-6 rounded-sm px-2 text-xs shadow-none",
              activeTab === "preview" && "bg-accent shadow-xs",
            )}
          >
            <Eye className="mr-1 size-3" />
            Preview
          </Button>
        </div>

        {activeTab === "preview" && (
          <div className="flex h-7 items-center rounded-md bg-muted p-0.5">
            {devices.map((device) => {
              const Icon = device.icon;
              const isActive = previewDevice === device.id;
              return (
                <Tooltip key={device.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice(device.id)}
                      className={cn(
                        "relative flex h-6 items-center justify-center px-1.5 transition-colors",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="relative z-10 size-3.5" />
                      {isActive && (
                        <motion.div
                          layoutId="activeDevicePill"
                          className="absolute inset-0 z-0 rounded-sm bg-accent"
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                          }}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{device.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <ExportGithubDialog
              fileStructure={fileStructure}
              projectName={projectName}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>Export to GitHub</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default NavBar;
