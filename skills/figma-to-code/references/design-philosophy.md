# Repo-First Design Philosophy

Convert Figma frames, components, variables, and design-system references into production-ready repository changes. This skill is **repo-first**: inspect the target codebase before trusting generated markup, preserve local components and tokens, use MCP-provided assets instead of placeholders, recover from truncated design context, and verify the rendered result visually.

## Implementation Rules

**Detect conventions first.** Do not assume Next.js, Tailwind, single quotes, semicolon policy, import aliases, or a specific component layout until the repository confirms them.

**Prefer existing primitives.** Check for local button, card, dialog, form, typography, icon, image, theme, and token utilities before creating new primitives.

**Preserve design intent.** Match visible hierarchy, spacing rhythm, type scale, color semantics, interaction states, and responsive behavior. Do not copy arbitrary absolute positions if the layout should be fluid.

**Use semantic structure.** Produce accessible HTML, labels, landmarks, keyboard states, alt text, and focus styles appropriate to the component. A visual match that breaks interaction is not complete.

**Handle assets deliberately.** Use project asset pipelines for icons, images, masks, and exported SVGs. Prefer MCP-provided image and SVG sources when they are available, especially localhost asset endpoints. Avoid embedding large base64 assets in source files. Name assets according to local conventions.

**Respect tokens.** Prefer existing code tokens over raw Figma values when they represent the same design decision. Add new tokens only when the project has an established token workflow.

**Keep changes scoped.** Implement the requested design surface and necessary shared support only. Leave unrelated visual cleanup for a separate pass.
