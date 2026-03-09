import type { LucideIcon } from "lucide-react";
import {
  Code,
  Laptop,
  Layers,
  Monitor,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";

export interface GitignoreCategory {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const GITIGNORE_CATEGORIES: GitignoreCategory[] = [
  { id: "recommended", label: "Recommended", icon: Sparkles },
  { id: "languages", label: "Languages", icon: Code },
  { id: "frameworks", label: "Frameworks", icon: Layers },
  { id: "editors", label: "Editors/IDEs", icon: Monitor },
  { id: "os", label: "Operating Systems", icon: Laptop },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

export type CategoryId = (typeof GITIGNORE_CATEGORIES)[number]["id"];

const TEMPLATE_CATEGORY_MAP: Record<string, CategoryId> = {
  // Languages
  Node: "languages",
  Python: "languages",
  Java: "languages",
  "C++": "languages",
  C: "languages",
  Go: "languages",
  Rust: "languages",
  Ruby: "languages",
  Swift: "languages",
  Kotlin: "languages",
  Scala: "languages",
  Haskell: "languages",
  Elixir: "languages",
  Erlang: "languages",
  Clojure: "languages",
  R: "languages",
  Julia: "languages",
  Perl: "languages",
  PHP: "languages",
  Lua: "languages",
  Dart: "languages",
  OCaml: "languages",
  Fortran: "languages",
  Pascal: "languages",
  "Objective-C": "languages",
  Assembly: "languages",
  Nim: "languages",
  Zig: "languages",
  V: "languages",
  Crystal: "languages",
  D: "languages",
  Elm: "languages",
  PureScript: "languages",
  Racket: "languages",
  Scheme: "languages",
  CommonLisp: "languages",
  FSharp: "languages",
  TeX: "languages",
  Sass: "languages",

  // Frameworks
  Rails: "frameworks",
  Django: "frameworks",
  Laravel: "frameworks",
  Angular: "frameworks",
  Vue: "frameworks",
  Symfony: "frameworks",
  Spring: "frameworks",
  Flutter: "frameworks",
  Android: "frameworks",
  Unity: "frameworks",
  UnrealEngine: "frameworks",
  Godot: "frameworks",
  ROS: "frameworks",
  Terraform: "frameworks",
  Packer: "frameworks",
  Ansible: "frameworks",
  Zephyr: "frameworks",
  Yii: "frameworks",
  CakePHP: "frameworks",
  CodeIgniter: "frameworks",
  Magento: "frameworks",
  WordPress: "frameworks",
  Joomla: "frameworks",
  Drupal: "frameworks",
  ExpressionEngine: "frameworks",
  SugarCRM: "frameworks",
  Umbraco: "frameworks",
  PlayFramework: "frameworks",
  GWT: "frameworks",
  Grails: "frameworks",
  Leiningen: "frameworks",
  Gradle: "frameworks",
  Maven: "frameworks",

  // Editors/IDEs
  JetBrains: "editors",
  VisualStudioCode: "editors",
  Vim: "editors",
  Emacs: "editors",
  SublimeText: "editors",
  Eclipse: "editors",
  NetBeans: "editors",
  Xcode: "editors",
  "Notepad++": "editors",
  NotepadPP: "editors",
  Kate: "editors",
  Atom: "editors",
  TextMate: "editors",
  VisualStudio: "editors",

  // Operating Systems
  macOS: "os",
  Windows: "os",
  Linux: "os",
};

export function getCategoryForTemplate(name: string): CategoryId {
  // Direct lookup first
  if (name in TEMPLATE_CATEGORY_MAP) {
    return TEMPLATE_CATEGORY_MAP[name];
  }

  // Case-insensitive fallback
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(TEMPLATE_CATEGORY_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }

  return "other";
}

export function getTemplatesByCategory(
  templateNames: string[],
): Record<CategoryId, string[]> {
  const result: Record<string, string[]> = {};

  for (const cat of GITIGNORE_CATEGORIES) {
    result[cat.id] = [];
  }

  for (const name of templateNames) {
    const category = getCategoryForTemplate(name);
    if (!result[category]) result[category] = [];
    result[category].push(name);
  }

  return result;
}
