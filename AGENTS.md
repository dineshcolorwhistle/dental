# Agent Guidelines

## Permissions & Autonomous Actions
- **Do NOT ask permission for routine, read-only, or inspection operations:**
  - Accessing, reading, viewing, and searching files or code across the project.
  - Running safe inspection and verification commands (e.g., file searches, grep, `git status`, `git log`, `tsc --noEmit`, linting, build checks).
  - Proceed autonomously without requesting user confirmation for standard development tasks.
- **Ask permission ONLY for critical, destructive, or high-risk operations:**
  - Destructive or irreversible actions (e.g., dropping databases, deleting tables or critical directories).
  - Destructive git commands (e.g., `git reset --hard`, `git clean -f`, force pushes).
  - Major breaking architecture shifts not requested by the user.

## Implementation Plans
When asked to prepare an implementation plan:
- Always write the detailed plan to a text file (e.g., `implementation-plan.txt`) in the project root.
- Do not dump the plan directly into the conversation.
- Output a short summary and clickable link to the created file in the chat.
