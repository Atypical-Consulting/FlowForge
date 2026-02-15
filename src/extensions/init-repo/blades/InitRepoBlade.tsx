import { useEffect } from "react";
import { commands } from "../../../bindings";
import { useProjectDetection } from "../hooks/useGitignoreTemplates";
import { useInitRepoStore } from "../store";
import { SplitPaneLayout } from "@/framework/layout/SplitPaneLayout";
import { InitRepoForm } from "../components/InitRepoForm";
import { InitRepoPreview } from "../components/InitRepoPreview";

interface InitRepoBladeProps {
  directoryPath: string;
  onCancel?: () => void;
  onComplete?: (path: string) => void;
}

export function InitRepoBlade({
  directoryPath,
  onCancel,
  onComplete,
}: InitRepoBladeProps) {
  const {
    setDirectoryPath,
    setReadmeName,
    setDetectedTypes,
    addTemplate,
    setTemplateContent,
    selectedTemplates,
    templateContents,
    reset,
  } = useInitRepoStore();

  // Hydrate store on mount
  useEffect(() => {
    setDirectoryPath(directoryPath);
    const folderName =
      directoryPath.split("/").pop() ||
      directoryPath.split("\\").pop() ||
      "Project";
    setReadmeName(folderName);

    return () => {
      reset();
    };
  }, [directoryPath, setDirectoryPath, setReadmeName, reset]);

  // Project detection
  const { data: detection } = useProjectDetection(directoryPath);

  useEffect(() => {
    if (detection?.detectedTypes) {
      setDetectedTypes(detection.detectedTypes);
      for (const dt of detection.detectedTypes) {
        for (const tpl of dt.recommendedTemplates) {
          addTemplate(tpl);
        }
      }
    }
  }, [detection, setDetectedTypes, addTemplate]);

  // Fetch template content for selected templates (for preview)
  useEffect(() => {
    for (const name of selectedTemplates) {
      if (!templateContents[name]) {
        commands.getGitignoreTemplate(name).then((result) => {
          if (result.status === "ok") {
            setTemplateContent(name, result.data.content);
          }
        });
      }
    }
  }, [selectedTemplates, templateContents, setTemplateContent]);

  return (
    <SplitPaneLayout
      autoSaveId="init-repo-split"
      primaryDefaultSize={55}
      primaryMinSize={35}
      primaryMaxSize={70}
      primary={<InitRepoForm onCancel={onCancel} onComplete={onComplete} />}
      detail={<InitRepoPreview />}
    />
  );
}
