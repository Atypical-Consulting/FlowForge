import type { ComponentType, SVGProps } from "react";

import AngularIcon from "../assets/icons/file-types/angular.svg?react";
import ArchiveIcon from "../assets/icons/file-types/archive.svg?react";
import AstroIcon from "../assets/icons/file-types/astro.svg?react";
import BashIcon from "../assets/icons/file-types/bash.svg?react";
import CIcon from "../assets/icons/file-types/c.svg?react";
import CppIcon from "../assets/icons/file-types/cpp.svg?react";
import CSharpIcon from "../assets/icons/file-types/csharp.svg?react";
import CssIcon from "../assets/icons/file-types/css.svg?react";
import CsvIcon from "../assets/icons/file-types/csv.svg?react";
import DatabaseIcon from "../assets/icons/file-types/database.svg?react";
import DockerIcon from "../assets/icons/file-types/docker.svg?react";
import EnvIcon from "../assets/icons/file-types/env.svg?react";
import FileIcon from "../assets/icons/file-types/file.svg?react";
import FolderIcon from "../assets/icons/file-types/folder.svg?react";
import FolderOpenIcon from "../assets/icons/file-types/folder-open.svg?react";
import FontIcon from "../assets/icons/file-types/font.svg?react";
import GitIcon from "../assets/icons/file-types/git.svg?react";
import GoIcon from "../assets/icons/file-types/go.svg?react";
import HtmlIcon from "../assets/icons/file-types/html.svg?react";
import ImageIcon from "../assets/icons/file-types/image.svg?react";
import JavaIcon from "../assets/icons/file-types/java.svg?react";
import JavaScriptIcon from "../assets/icons/file-types/javascript.svg?react";
import JsonIcon from "../assets/icons/file-types/json.svg?react";
import KotlinIcon from "../assets/icons/file-types/kotlin.svg?react";
import LicenseIcon from "../assets/icons/file-types/license.svg?react";
import LuaIcon from "../assets/icons/file-types/lua.svg?react";
import MarkdownIcon from "../assets/icons/file-types/markdown.svg?react";
import NodejsIcon from "../assets/icons/file-types/nodejs.svg?react";
import PhpIcon from "../assets/icons/file-types/php.svg?react";
import PythonIcon from "../assets/icons/file-types/python.svg?react";
import ReactIcon from "../assets/icons/file-types/react.svg?react";
import RubyIcon from "../assets/icons/file-types/ruby.svg?react";
import RustIcon from "../assets/icons/file-types/rust.svg?react";
import ScssIcon from "../assets/icons/file-types/scss.svg?react";
import SvelteIcon from "../assets/icons/file-types/svelte.svg?react";
import SwiftIcon from "../assets/icons/file-types/swift.svg?react";
import TomlIcon from "../assets/icons/file-types/toml.svg?react";
// Import all icons using ?react suffix for SVGR
import TypeScriptIcon from "../assets/icons/file-types/typescript.svg?react";
import VueIcon from "../assets/icons/file-types/vue.svg?react";
import XmlIcon from "../assets/icons/file-types/xml.svg?react";
import YamlIcon from "../assets/icons/file-types/yaml.svg?react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Map extensions to icons
export const FILE_ICON_MAP: Record<string, IconComponent> = {
  // TypeScript
  ts: TypeScriptIcon,
  tsx: ReactIcon,
  mts: TypeScriptIcon,
  cts: TypeScriptIcon,

  // JavaScript
  js: JavaScriptIcon,
  jsx: ReactIcon,
  mjs: JavaScriptIcon,
  cjs: JavaScriptIcon,

  // Rust
  rs: RustIcon,

  // Python
  py: PythonIcon,
  pyw: PythonIcon,
  pyi: PythonIcon,

  // Go
  go: GoIcon,

  // Java
  java: JavaIcon,
  jar: JavaIcon,

  // C#
  cs: CSharpIcon,
  csx: CSharpIcon,

  // C/C++
  cpp: CppIcon,
  cxx: CppIcon,
  cc: CppIcon,
  c: CIcon,
  h: CIcon,
  hpp: CppIcon,

  // Ruby
  rb: RubyIcon,
  rake: RubyIcon,

  // PHP
  php: PhpIcon,

  // Swift
  swift: SwiftIcon,

  // Kotlin
  kt: KotlinIcon,
  kts: KotlinIcon,

  // Lua
  lua: LuaIcon,

  // Shell
  sh: BashIcon,
  bash: BashIcon,
  zsh: BashIcon,
  fish: BashIcon,
  ps1: BashIcon,

  // Web
  html: HtmlIcon,
  htm: HtmlIcon,
  css: CssIcon,
  scss: ScssIcon,
  sass: ScssIcon,
  less: CssIcon,
  vue: VueIcon,
  svelte: SvelteIcon,
  astro: AstroIcon,

  // Data/Config
  json: JsonIcon,
  jsonc: JsonIcon,
  json5: JsonIcon,
  yaml: YamlIcon,
  yml: YamlIcon,
  toml: TomlIcon,
  xml: XmlIcon,
  svg: XmlIcon,

  // Markdown/Text
  md: MarkdownIcon,
  mdx: MarkdownIcon,
  txt: FileIcon,
  text: FileIcon,

  // Data
  csv: CsvIcon,
  tsv: CsvIcon,
  sql: DatabaseIcon,

  // Config
  lock: JsonIcon,
  env: EnvIcon,

  // Images
  png: ImageIcon,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  gif: ImageIcon,
  webp: ImageIcon,
  bmp: ImageIcon,
  ico: ImageIcon,
  tiff: ImageIcon,
  avif: ImageIcon,

  // Fonts
  ttf: FontIcon,
  otf: FontIcon,
  woff: FontIcon,
  woff2: FontIcon,
  eot: FontIcon,

  // Archives
  zip: ArchiveIcon,
  tar: ArchiveIcon,
  gz: ArchiveIcon,
  bz2: ArchiveIcon,
  xz: ArchiveIcon,
  "7z": ArchiveIcon,
  rar: ArchiveIcon,
};

// Special filename mappings (exact match, case-insensitive)
export const FILENAME_ICON_MAP: Record<string, IconComponent> = {
  "package.json": NodejsIcon,
  "package-lock.json": NodejsIcon,
  "yarn.lock": NodejsIcon,
  "pnpm-lock.yaml": NodejsIcon,
  "bun.lockb": NodejsIcon,
  "cargo.toml": RustIcon,
  "cargo.lock": RustIcon,
  dockerfile: DockerIcon,
  "docker-compose.yml": DockerIcon,
  "docker-compose.yaml": DockerIcon,
  "compose.yml": DockerIcon,
  "compose.yaml": DockerIcon,
  ".gitignore": GitIcon,
  ".gitattributes": GitIcon,
  ".gitmodules": GitIcon,
  license: LicenseIcon,
  "license.md": LicenseIcon,
  "license.txt": LicenseIcon,
  "readme.md": MarkdownIcon,
  readme: MarkdownIcon,
  "tsconfig.json": TypeScriptIcon,
  "jsconfig.json": JavaScriptIcon,
  ".eslintrc": JsonIcon,
  ".eslintrc.json": JsonIcon,
  ".prettierrc": JsonIcon,
  "vite.config.ts": TypeScriptIcon,
  "vite.config.js": JavaScriptIcon,
  "angular.json": AngularIcon,
  "biome.json": JsonIcon,
  "biome.jsonc": JsonIcon,

  // Env files
  ".env": EnvIcon,
  ".env.local": EnvIcon,
  ".env.development": EnvIcon,
  ".env.production": EnvIcon,
  ".env.staging": EnvIcon,
  ".env.test": EnvIcon,
  ".env.example": EnvIcon,

  // Docker
  ".dockerignore": DockerIcon,

  // Tailwind
  "tailwind.config.js": JavaScriptIcon,
  "tailwind.config.ts": TypeScriptIcon,
  "tailwind.config.mjs": JavaScriptIcon,
  "tailwind.config.cjs": JavaScriptIcon,

  // Config files
  ".editorconfig": JsonIcon,
  ".npmrc": NodejsIcon,
  ".nvmrc": NodejsIcon,
  ".prettierignore": JsonIcon,
  ".eslintignore": JsonIcon,
  ".browserslistrc": JsonIcon,
  "webpack.config.js": JavaScriptIcon,
  "webpack.config.ts": TypeScriptIcon,
  "rollup.config.js": JavaScriptIcon,
  "rollup.config.ts": TypeScriptIcon,
  "postcss.config.js": JavaScriptIcon,
  "postcss.config.cjs": JavaScriptIcon,
  "babel.config.js": JavaScriptIcon,
  "babel.config.json": JsonIcon,
  ".babelrc": JsonIcon,

  // Build tools
  makefile: BashIcon,
  rakefile: RubyIcon,
  gemfile: RubyIcon,
  "gemfile.lock": RubyIcon,
  "go.mod": GoIcon,
  "go.sum": GoIcon,
};

export function getFileIcon(filePath: string): IconComponent {
  const filename = filePath.split("/").pop() || filePath;
  const lowerFilename = filename.toLowerCase();

  // Check exact filename matches first (case-insensitive)
  for (const [key, icon] of Object.entries(FILENAME_ICON_MAP)) {
    if (key.toLowerCase() === lowerFilename) {
      return icon;
    }
  }

  // Get extension
  const ext = filename.includes(".")
    ? filename.split(".").pop()?.toLowerCase()
    : null;

  if (ext && FILE_ICON_MAP[ext]) {
    return FILE_ICON_MAP[ext];
  }

  return FileIcon;
}

export function getFolderIcon(isOpen: boolean): IconComponent {
  return isOpen ? FolderOpenIcon : FolderIcon;
}

export { FileIcon as DefaultFileIcon, FolderIcon, FolderOpenIcon };
