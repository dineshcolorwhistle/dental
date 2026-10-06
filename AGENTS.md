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
- **DO NOT store implementation plan text files in the project folder.** Keep the project repository clean of planning or scratch text files.
- Do not create `implementation-plan.txt` or any other plan text files inside the project directory.
- Implementation plans should be stored in the agent artifact directory or presented cleanly as structured summaries.

## Temporary & Dummy Files Cleanup
- If any testing, temporary, or dummy files/scripts are created for verification or checking, they must be **automatically deleted** once the check/process is completed.
- Never leave temporary scratch files, dummy data, or test scripts inside the project codebase.
