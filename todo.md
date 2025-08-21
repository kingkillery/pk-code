# TODO

As of 2025-08-21 08:06:59Z, there are no pending todos.

Completed items (recent):
- Verify help output — Run the CLI help to confirm --prompt-file is documented and appears in usage.
- Test exclusivity errors — Invoke CLI with --prompt-file and --prompt together and ensure it exits with a clear error.
- Identify package manager and CLI bin — Check root package.json and lockfiles; read packages/cli/package.json to find the bin name and scripts.
- Build the workspace — Use the correct package manager (pnpm/yarn/npm) to run the build across the monorepo.
- Test a working --prompt-file run — Create a temp prompt file and run the CLI to ensure it reads the file successfully.

