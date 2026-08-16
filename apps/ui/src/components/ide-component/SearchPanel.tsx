"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSystemTree } from "@webcontainer/api";
import { Search } from "lucide-react";
import { FileIconCustom } from "./file-icon";

interface SearchResult {
  path: string;
  name: string;
  type: "file" | "directory";
  matchType: "name" | "content";
  line?: number;
  preview?: string;
}

interface SearchPanelProps {
  fileStructure: FileSystemTree;
  onFileClick: (path: string, name: string) => void;
}

function searchFileSystem(
  tree: FileSystemTree,
  query: string,
  basePath: string = "",
): SearchResult[] {
  if (!query) return [];
  let results: SearchResult[] = [];
  const lowercaseQuery = query.toLowerCase();

  for (const [name, node] of Object.entries(tree)) {
    const currentPath = basePath ? `${basePath}/${name}` : name;


    if (name.toLowerCase().includes(lowercaseQuery)) {
      results.push({
        path: currentPath,
        name,
        type: "directory" in node ? "directory" : "file",
        matchType: "name",
      });
    }


    if ("file" in node && "contents" in node.file && typeof node.file.contents === "string") {
      const content = node.file.contents;
      if (content.toLowerCase().includes(lowercaseQuery)) {
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(lowercaseQuery)) {
            results.push({
              path: currentPath,
              name,
              type: "file",
              matchType: "content",
              line: index + 1,
              preview: line.trim(),
            });
          }
        });
      }
    } else if ("directory" in node) {
      results = [
        ...results,
        ...searchFileSystem(node.directory, query, currentPath),
      ];
    }
  }

  return results;
}

const SearchPanel = ({ fileStructure, onFileClick }: SearchPanelProps) => {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    return searchFileSystem(fileStructure, query);
  }, [fileStructure, query]);


  const groupedResults = useMemo(() => {
    const groups: { [path: string]: SearchResult[] } = {};
    results.forEach((res) => {
      if (!groups[res.path]) groups[res.path] = [];
      groups[res.path].push(res);
    });
    return groups;
  }, [results]);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
          Search
        </span>
      </div>
      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search files and content..."
            className="h-7 border-border bg-background/50 pl-8 text-xs shadow-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {query && results.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No results found for "{query}"
          </div>
        ) : (
          <div className="py-1">
            {Object.entries(groupedResults).map(([path, fileResults]) => (
              <div key={path}>
                <button
                  onClick={() => onFileClick(path, fileResults[0].name)}
                  className="group flex h-6 w-full items-center gap-1.5 px-2 text-left text-[13px] hover:bg-accent"
                >
                  <FileIconCustom filename={path.split("/").pop() || ""} className="size-3.5" />
                  <span className="flex-1 truncate">{path}</span>
                  <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {fileResults.length}
                  </span>
                </button>
                <div>
                  {fileResults.map((res, i) =>
                    res.matchType === "content" ? (
                      <button
                        key={`${path}-${i}`}
                        onClick={() => onFileClick(path, res.name)}
                        className="flex w-full items-start gap-2 px-2 py-0.5 pl-8 text-left text-[11px] text-muted-foreground hover:bg-accent/50"
                      >
                        <span className="shrink-0 tabular-nums text-muted-foreground/50">
                          {res.line}:
                        </span>
                        <span className="line-clamp-1 truncate italic">
                          {res.preview}
                        </span>
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default SearchPanel;
