import { Check, Search, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCategoryForTemplate } from "../../../core/lib/gitignoreCategories";
import { useGitignoreTemplateList } from "../hooks/useGitignoreTemplates";
import { useInitRepoStore } from "../store";
import { CategoryFilter } from "./CategoryFilter";

export function TemplatePicker() {
  const {
    selectedTemplates,
    addTemplate,
    removeTemplate,
    activeCategory,
    detectedTypes,
    setIsPickerOpen,
    setTemplateSource,
  } = useInitRepoStore();

  const { data: templateList, isLoading } = useGitignoreTemplateList();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [focusIndex, setFocusIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Store the template source once loaded
  useEffect(() => {
    if (templateList?.source) {
      setTemplateSource(templateList.source as "github" | "bundled");
    }
  }, [templateList, setTemplateSource]);

  // Filter templates by category and search
  const filteredTemplates = useMemo(() => {
    if (!templateList) return [];

    return templateList.templates.filter((t) => {
      // Category filter
      if (activeCategory === "recommended") {
        const recommendedNames = new Set(
          detectedTypes.flatMap((d) => d.recommendedTemplates),
        );
        if (!recommendedNames.has(t.name)) return false;
      } else if (activeCategory !== "all") {
        const category = getCategoryForTemplate(t.name);
        if (category !== activeCategory) return false;
      }

      // Search filter
      if (debouncedSearch) {
        return t.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      }

      return true;
    });
  }, [templateList, activeCategory, debouncedSearch, detectedTypes]);

  const toggleTemplate = (name: string) => {
    if (selectedTemplates.includes(name)) {
      removeTemplate(name);
    } else {
      addTemplate(name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, filteredTemplates.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (focusIndex >= 0 && focusIndex < filteredTemplates.length) {
        toggleTemplate(filteredTemplates[focusIndex].name);
      }
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[role='option']");
      items[focusIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  return (
    <div className="border border-ctp-surface1 rounded-lg bg-ctp-mantle overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-ctp-surface1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ctp-overlay0" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded-md text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/50"
            aria-label="Search gitignore templates"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="px-3 pt-3">
        <CategoryFilter showRecommended={detectedTypes.length > 0} />
      </div>

      {/* Source badge */}
      {templateList?.source === "bundled" && (
        <div className="mx-3 mt-2 inline-flex items-center gap-1.5 bg-ctp-yellow/10 text-ctp-yellow border border-ctp-yellow/30 text-xs px-2 py-1 rounded">
          <WifiOff className="w-3 h-3" />
          Offline — showing bundled templates
        </div>
      )}
      {templateList?.source === "github" && (
        <div className="mx-3 mt-2 inline-flex items-center gap-1.5 bg-ctp-green/10 text-ctp-green border border-ctp-green/30 text-xs px-2 py-1 rounded">
          <Wifi className="w-3 h-3" />
          GitHub — {templateList.templates.length} templates
        </div>
      )}

      {/* Template list */}
      <div className="p-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-ctp-surface0 rounded h-8"
              />
            ))}
          </div>
        ) : (
          <ul
            ref={listRef}
            aria-multiselectable="true"
            aria-label="Gitignore templates"
            className="max-h-80 overflow-y-auto space-y-0.5"
            onKeyDown={handleKeyDown}
          >
            {filteredTemplates.map((t, idx) => {
              const isSelected = selectedTemplates.includes(t.name);
              const isFocused = idx === focusIndex;

              return (
                <li
                  key={t.name}
                  aria-selected={isSelected}
                  onClick={() => toggleTemplate(t.name)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                    isFocused
                      ? "bg-ctp-surface1 text-ctp-text"
                      : "hover:bg-ctp-surface0 text-ctp-subtext1"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-ctp-blue border-ctp-blue"
                        : "border-ctp-surface2 bg-ctp-surface0"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-ctp-base" />}
                  </div>
                  <span
                    className={isSelected ? "text-ctp-text font-medium" : ""}
                  >
                    {t.name}
                  </span>
                </li>
              );
            })}
            {filteredTemplates.length === 0 && (
              <li className="px-3 py-4 text-sm text-ctp-subtext0 text-center">
                No templates match your search
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-ctp-surface1">
        <span className="text-xs text-ctp-subtext0">
          {selectedTemplates.length} selected
        </span>
        <button
          type="button"
          onClick={() => setIsPickerOpen(false)}
          className="text-xs px-3 py-1.5 rounded-md bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
