import { GITIGNORE_CATEGORIES } from "../../../lib/gitignoreCategories";
import { useInitRepoStore } from "../store";

interface CategoryFilterProps {
  showRecommended: boolean;
}

export function CategoryFilter({ showRecommended }: CategoryFilterProps) {
  const { activeCategory, setActiveCategory } = useInitRepoStore();

  const categories = showRecommended
    ? GITIGNORE_CATEGORIES
    : GITIGNORE_CATEGORIES.filter((c) => c.id !== "recommended");

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2"
      role="tablist"
      aria-label="Template categories"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeCategory === "all"}
        onClick={() => setActiveCategory("all")}
        className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 shrink-0 transition-colors ${
          activeCategory === "all"
            ? "bg-ctp-blue/20 text-ctp-blue border-ctp-blue/30"
            : "bg-ctp-surface0 text-ctp-subtext1 border-ctp-surface1 hover:bg-ctp-surface1"
        }`}
      >
        All
      </button>
      {categories.map((cat) => {
        const Icon = cat.icon;
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 shrink-0 transition-colors ${
              activeCategory === cat.id
                ? "bg-ctp-blue/20 text-ctp-blue border-ctp-blue/30"
                : "bg-ctp-surface0 text-ctp-subtext1 border-ctp-surface1 hover:bg-ctp-surface1"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
