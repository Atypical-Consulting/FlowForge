export interface TemplateSection {
  name: string;
  content: string;
}

/**
 * Compose multiple .gitignore templates into a single merged output.
 *
 * - Each template gets a section header comment: `# === {Name} ===`
 * - Duplicate rules across templates are removed (keep first occurrence)
 * - Excessive blank lines collapsed to single blank line
 * - Leading/trailing whitespace per section is trimmed
 */
export function composeGitignore(templates: TemplateSection[]): string {
  if (templates.length === 0) return "";

  const seenRules = new Set<string>();
  const sections: string[] = [];

  for (const template of templates) {
    const lines = template.content.split("\n");
    const sectionLines: string[] = [`# === ${template.name} ===`];

    for (const line of lines) {
      const trimmed = line.trim();

      // Always keep blank lines and comments
      if (trimmed === "" || trimmed.startsWith("#")) {
        sectionLines.push(line);
        continue;
      }

      // Deduplicate rules (case-insensitive comparison)
      const normalized = trimmed.toLowerCase();
      if (!seenRules.has(normalized)) {
        seenRules.add(normalized);
        sectionLines.push(line);
      }
    }

    sections.push(sectionLines.join("\n").trim());
  }

  // Join sections with blank line separator
  let result = sections.join("\n\n");

  // Collapse runs of 3+ consecutive blank lines to 2
  result = result.replace(/\n{4,}/g, "\n\n\n");

  // Ensure single trailing newline
  return `${result.trimEnd()}\n`;
}

/**
 * Parse a composed .gitignore back into individual template sections.
 * Useful for displaying which templates contributed which rules.
 */
export function parseGitignoreSections(composed: string): TemplateSection[] {
  const sections: TemplateSection[] = [];
  const headerRegex = /^# === (.+) ===$/;
  let currentName: string | null = null;
  let currentLines: string[] = [];

  for (const line of composed.split("\n")) {
    const match = line.match(headerRegex);
    if (match) {
      if (currentName !== null) {
        sections.push({
          name: currentName,
          content: currentLines.join("\n").trim(),
        });
      }
      currentName = match[1];
      currentLines = [];
    } else if (currentName !== null) {
      currentLines.push(line);
    }
  }

  if (currentName !== null) {
    sections.push({
      name: currentName,
      content: currentLines.join("\n").trim(),
    });
  }

  return sections;
}
