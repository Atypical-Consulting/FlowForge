import { createBladeStore } from "../../core/stores/createBladeStore";

interface InitRepoState {
  // Core config
  directoryPath: string;
  defaultBranch: string;

  // Project detection
  detectedTypes: Array<{
    projectType: string;
    markerFile: string;
    recommendedTemplates: string[];
  }>;
  isDetecting: boolean;

  // Gitignore
  selectedTemplates: string[];
  templateContents: Record<string, string>;
  isLoadingTemplates: boolean;
  templateSource: "github" | "bundled" | null;
  searchQuery: string;
  activeCategory: string;
  isPickerOpen: boolean;

  // README
  readmeEnabled: boolean;
  readmeName: string;
  readmeDescription: string;

  // Initial commit
  commitEnabled: boolean;
  commitMessage: string;

  // Active section (for preview context switching)
  activeSection: "gitignore" | "readme" | "commit" | "summary";

  // Init progress
  isInitializing: boolean;
  initError: string | null;

  // Actions
  setDirectoryPath: (path: string) => void;
  setDefaultBranch: (branch: string) => void;
  setDetectedTypes: (types: InitRepoState["detectedTypes"]) => void;
  setIsDetecting: (v: boolean) => void;
  addTemplate: (name: string) => void;
  removeTemplate: (name: string) => void;
  reorderTemplates: (names: string[]) => void;
  clearTemplates: () => void;
  setTemplateContent: (name: string, content: string) => void;
  setIsLoadingTemplates: (v: boolean) => void;
  setTemplateSource: (source: "github" | "bundled") => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: string) => void;
  setIsPickerOpen: (open: boolean) => void;
  setReadmeEnabled: (enabled: boolean) => void;
  setReadmeName: (name: string) => void;
  setReadmeDescription: (desc: string) => void;
  setCommitEnabled: (enabled: boolean) => void;
  setCommitMessage: (msg: string) => void;
  setActiveSection: (section: InitRepoState["activeSection"]) => void;
  setIsInitializing: (v: boolean) => void;
  setInitError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  directoryPath: "",
  defaultBranch: "main",
  detectedTypes: [] as InitRepoState["detectedTypes"],
  isDetecting: false,
  selectedTemplates: [] as string[],
  templateContents: {} as Record<string, string>,
  isLoadingTemplates: false,
  templateSource: null as "github" | "bundled" | null,
  searchQuery: "",
  activeCategory: "all",
  isPickerOpen: false,
  readmeEnabled: false,
  readmeName: "",
  readmeDescription: "",
  commitEnabled: true,
  commitMessage: "Initial commit",
  activeSection: "summary" as const,
  isInitializing: false,
  initError: null as string | null,
};

export const useInitRepoStore = createBladeStore<InitRepoState>(
  "init-repo",
  (set) => ({
    ...initialState,

    setDirectoryPath: (path) => set({ directoryPath: path }),
    setDefaultBranch: (branch) => set({ defaultBranch: branch }),
    setDetectedTypes: (types) => set({ detectedTypes: types }),
    setIsDetecting: (v) => set({ isDetecting: v }),

    addTemplate: (name) =>
      set((state) => ({
        selectedTemplates: state.selectedTemplates.includes(name)
          ? state.selectedTemplates
          : [...state.selectedTemplates, name],
      })),
    removeTemplate: (name) =>
      set((state) => ({
        selectedTemplates: state.selectedTemplates.filter((t) => t !== name),
      })),
    reorderTemplates: (names) => set({ selectedTemplates: names }),
    clearTemplates: () => set({ selectedTemplates: [] }),
    setTemplateContent: (name, content) =>
      set((state) => ({
        templateContents: { ...state.templateContents, [name]: content },
      })),
    setIsLoadingTemplates: (v) => set({ isLoadingTemplates: v }),
    setTemplateSource: (source) => set({ templateSource: source }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setActiveCategory: (category) => set({ activeCategory: category }),
    setIsPickerOpen: (open) => set({ isPickerOpen: open }),
    setReadmeEnabled: (enabled) => set({ readmeEnabled: enabled }),
    setReadmeName: (name) => set({ readmeName: name }),
    setReadmeDescription: (desc) => set({ readmeDescription: desc }),
    setCommitEnabled: (enabled) => set({ commitEnabled: enabled }),
    setCommitMessage: (msg) => set({ commitMessage: msg }),
    setActiveSection: (section) => set({ activeSection: section }),
    setIsInitializing: (v) => set({ isInitializing: v }),
    setInitError: (error) => set({ initError: error }),
    reset: () => set(initialState),
  }),
);
