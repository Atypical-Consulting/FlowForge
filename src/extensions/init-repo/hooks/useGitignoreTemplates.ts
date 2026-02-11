import { useQuery } from "@tanstack/react-query";
import { commands } from "../../../bindings";

export function useGitignoreTemplateList() {
  return useQuery({
    queryKey: ["gitignore-templates"],
    queryFn: async () => {
      const result = await commands.listGitignoreTemplates();
      if (result.status === "error") throw new Error("Failed to load templates");
      return result.data;
    },
    staleTime: Infinity,
    retry: 1,
  });
}

export function useGitignoreTemplateContent(name: string | null) {
  return useQuery({
    queryKey: ["gitignore-template-content", name],
    queryFn: async () => {
      if (!name) return null;
      const result = await commands.getGitignoreTemplate(name);
      if (result.status === "error")
        throw new Error(`Failed to load template: ${name}`);
      return result.data;
    },
    enabled: !!name,
    staleTime: Infinity,
  });
}

export function useProjectDetection(path: string | null) {
  return useQuery({
    queryKey: ["project-detection", path],
    queryFn: async () => {
      if (!path) return null;
      const result = await commands.detectProjectType(path);
      if (result.status === "error") return null;
      return result.data;
    },
    enabled: !!path && path.length > 0,
    staleTime: 30_000,
  });
}
