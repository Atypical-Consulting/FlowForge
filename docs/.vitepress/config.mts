import { defineConfig } from "vitepress";

export default defineConfig({
  title: "FlowForge",
  description: "A visual Git client built with Tauri, React, and TypeScript",
  base: "/FlowForge/",

  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/FlowForge/logo.svg" }]],

  themeConfig: {
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Features", link: "/features/" },
      { text: "Concepts", link: "/concepts/" },
      { text: "Reference", link: "/reference/keyboard-shortcuts" },
      { text: "Download", link: "/download" },
    ],

    sidebar: {
      "/features/": [
        {
          text: "Features",
          items: [
            { text: "Overview", link: "/features/" },
            { text: "Gitflow Workflow", link: "/features/gitflow" },
            { text: "Staging & Commits", link: "/features/staging" },
            { text: "Branch Management", link: "/features/branches" },
          ],
        },
      ],
      "/concepts/": [
        {
          text: "Concepts",
          items: [
            { text: "Overview", link: "/concepts/" },
            { text: "GitFlow", link: "/concepts/gitflow" },
            {
              text: "Conventional Commits",
              link: "/concepts/conventional-commits",
            },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            {
              text: "Keyboard Shortcuts",
              link: "/reference/keyboard-shortcuts",
            },
            { text: "Settings", link: "/reference/settings" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/phmatray/FlowForge" },
    ],
  },

  markdown: {
    theme: {
      light: "catppuccin-latte",
      dark: "catppuccin-mocha",
    },
  },
});
