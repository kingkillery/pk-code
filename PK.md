## Building and running

Before submitting any changes, it is crucial to validate them by running the full preflight check. This command will build the repository, run all tests, check for type errors, and lint the code.

To run the full suite of checks, execute the following command:

```bash
npm run preflight
```

This single command ensures that your changes meet all the quality gates of the project. While you can run the individual steps (`build`, `test`, `typecheck`, `lint`) separately, it is highly recommended to use `npm run preflight` to ensure a comprehensive validation.

## Writing Tests

This project uses **Vitest** as its primary testing framework. Configuration files exist for Vitest (`vitest.config.ts`) in each package. When writing tests, aim to follow existing patterns. Key conventions include:

### Test Structure and Framework

- **Framework**: All tests are written using Vitest (`describe`, `it`, `expect`, `vi`).
- **File Location**: Test files (`*.test.ts` for logic, `*.test.tsx` for React components) are co-located with the source files they test.
- **Configuration**: Test environments are defined in `vitest.config.ts` files.
- **Setup/Teardown**: Use `beforeEach` and `afterEach`. Commonly, `vi.resetAllMocks()` is called in `beforeEach` and `vi.restoreAllMocks()` in `afterEach`.

### Mocking (`vi` from Vitest)

- **ES Modules**: Mock with `vi.mock('module-name', async (importOriginal) => { ... })`. Use `importOriginal` for selective mocking.
  - _Example_: `vi.mock('os', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, homedir: vi.fn() }; });`
- **Mocking Order**: For critical dependencies (e.g., `os`, `fs`) that affect module-level constants, place `vi.mock` at the _very top_ of the test file, before other imports.
- **Hoisting**: Use `const myMock = vi.hoisted(() => vi.fn());` if a mock function needs to be defined before its use in a `vi.mock` factory.
- **Mock Functions**: Create with `vi.fn()`. Define behavior with `mockImplementation()`, `mockResolvedValue()`, or `mockRejectedValue()`.
- **Spying**: Use `vi.spyOn(object, 'methodName')`. Restore spies with `mockRestore()` in `afterEach`.

### Commonly Mocked Modules

- **Node.js built-ins**: `fs`, `fs/promises`, `os` (especially `os.homedir()`), `path`, `child_process` (`execSync`, `spawn`).
- **External SDKs**: `@google/genai`, `@modelcontextprotocol/sdk`.
- **Internal Project Modules**: Dependencies from other project packages are often mocked.

### React Component Testing (CLI UI - Ink)

- Use `render()` from `ink-testing-library`.
- Assert output with `lastFrame()`.
- Wrap components in necessary `Context.Provider`s.
- Mock custom React hooks and complex child components using `vi.mock()`.

### Asynchronous Testing

- Use `async/await`.
- For timers, use `vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync()`, `vi.runAllTimersAsync()`.
- Test promise rejections with `await expect(promise).rejects.toThrow(...)`.

### General Guidance

- When adding tests, first examine existing tests to understand and conform to established conventions.
- Pay close attention to the mocks at the top of existing test files; they reveal critical dependencies and how they are managed in a test environment.

## Git Repo

The main branch for this project is called "main"

## Browser-Use Integration

The `browser-use` library is integrated into the PK Code CLI, allowing agents to interact with live web applications. This integration is achieved through the Model Context Protocol (MCP), with `browser-use` running as a separate MCP server.

### Enabling the Browser-Use Integration

To enable the `browser-use` integration, you must first configure the path to your browser's user data directory. This can be done by running the following command:

```bash
pk config browser
```

This command will guide you through an interactive setup process to find and save the correct path.

### Starting and Stopping the Browser-Use Agent

Once the `browser-use` integration has been configured, you can start and stop the `browser-use` agent using the following commands:

```bash
# Start the browser-use agent
pk agent start browser

# Stop the browser-use agent
pk agent stop browser
```

When the `browser-use` agent is running, a set of `browser.*` tools will be available to the PK Code agent, allowing it to interact with the web browser.

## JavaScript/TypeScript

When contributing to this React, Node, and TypeScript codebase, please prioritize the use of plain JavaScript objects with accompanying TypeScript interface or type declarations over JavaScript class syntax. This approach offers significant advantages, especially concerning interoperability with React and overall code maintainability.

### Preferring Plain Objects over Classes

JavaScript classes, by their nature, are designed to encapsulate internal state and behavior. While this can be useful in some object-oriented paradigms, it often introduces unnecessary complexity and friction when working with React's component-based architecture. Here's why plain objects are preferred:

- Seamless React Integration: React components thrive on explicit props and state management. Classes' tendency to store internal state directly within instances can make prop and state propagation harder to reason about and maintain. Plain objects, on the other hand, are inherently immutable (when used thoughtfully) and can be easily passed as props, simplifying data flow and reducing unexpected side effects.

- Reduced Boilerplate and Increased Conciseness: Classes often promote the use of constructors, this binding, getters, setters, and other boilerplate that can unnecessarily bloat code. TypeScript interface and type declarations provide powerful static type checking without the runtime overhead or verbosity of class definitions. This allows for more succinct and readable code, aligning with JavaScript's strengths in functional programming.

- Enhanced Readability and Predictability: Plain objects, especially when their structure is clearly defined by TypeScript interfaces, are often easier to read and understand. Their properties are directly accessible, and there's no hidden internal state or complex inheritance chains to navigate. This predictability leads to fewer bugs and a more maintainable codebase.
  Simplified Immutability: While not strictly enforced, plain objects encourage an immutable approach to data. When you need to modify an object, you typically create a new one with the desired changes, rather than mutating the original. This pattern aligns perfectly with React's reconciliation process and helps prevent subtle bugs related to shared mutable state.

- Better Serialization and Deserialization: Plain JavaScript objects are naturally easy to serialize to JSON and deserialize back, which is a common requirement in web development (e.g., for API communication or local storage). Classes, with their methods and prototypes, can complicate this process.

### Embracing ES Module Syntax for Encapsulation

Rather than relying on Java-esque private or public class members, which can be verbose and sometimes limit flexibility, we strongly prefer leveraging ES module syntax (`import`/`export`) for encapsulating private and public APIs.

- Clearer Public API Definition: With ES modules, anything that is exported is part of the public API of that module, while anything not exported is inherently private to that module. This provides a very clear and explicit way to define what parts of your code are meant to be consumed by other modules.

- Enhanced Testability (Without Exposing Internals): By default, unexported functions or variables are not accessible from outside the module. This encourages you to test the public API of your modules, rather than their internal implementation details. If you find yourself needing to spy on or stub an unexported function for testing purposes, it's often a "code smell" indicating that the function might be a good candidate for extraction into its own separate, testable module with a well-defined public API. This promotes a more robust and maintainable testing strategy.

- Reduced Coupling: Explicitly defined module boundaries through import/export help reduce coupling between different parts of your codebase. This makes it easier to refactor, debug, and understand individual components in isolation.

### Avoiding `any` Types and Type Assertions; Preferring `unknown`

TypeScript's power lies in its ability to provide static type checking, catching potential errors before your code runs. To fully leverage this, it's crucial to avoid the `any` type and be judicious with type assertions.

- **The Dangers of `any`**: Using any effectively opts out of TypeScript's type checking for that particular variable or expression. While it might seem convenient in the short term, it introduces significant risks:
  - **Loss of Type Safety**: You lose all the benefits of type checking, making it easy to introduce runtime errors that TypeScript would otherwise have caught.
  - **Reduced Readability and Maintainability**: Code with `any` types is harder to understand and maintain, as the expected type of data is no longer explicitly defined.
  - **Masking Underlying Issues**: Often, the need for any indicates a deeper problem in the design of your code or the way you're interacting with external libraries. It's a sign that you might need to refine your types or refactor your code.

- **Preferring `unknown` over `any`**: When you absolutely cannot determine the type of a value at compile time, and you're tempted to reach for any, consider using unknown instead. unknown is a type-safe counterpart to any. While a variable of type unknown can hold any value, you must perform type narrowing (e.g., using typeof or instanceof checks, or a type assertion) before you can perform any operations on it. This forces you to handle the unknown type explicitly, preventing accidental runtime errors.

  ```
  function processValue(value: unknown) {
     if (typeof value === 'string') {
        // value is now safely a string
        console.log(value.toUpperCase());
     } else if (typeof value === 'number') {
        // value is now safely a number
        console.log(value * 2);
     }
     // Without narrowing, you cannot access properties or methods on 'value'
     // console.log(value.someProperty); // Error: Object is of type 'unknown'.
  }
  ```

- **Type Assertions (`as Type`) - Use with Caution**: Type assertions tell the TypeScript compiler, "Trust me, I know what I'm doing; this is definitely of this type." While there are legitimate use cases (e.g., when dealing with external libraries that don't have perfect type definitions, or when you have more information than the compiler), they should be used sparingly and with extreme caution.
  - **Bypassing Type Checking**: Like `any`, type assertions bypass TypeScript's safety checks. If your assertion is incorrect, you introduce a runtime error that TypeScript would not have warned you about.
  - **Code Smell in Testing**: A common scenario where `any` or type assertions might be tempting is when trying to test "private" implementation details (e.g., spying on or stubbing an unexported function within a module). This is a strong indication of a "code smell" in your testing strategy and potentially your code structure. Instead of trying to force access to private internals, consider whether those internal details should be refactored into a separate module with a well-defined public API. This makes them inherently testable without compromising encapsulation.

### Embracing JavaScript's Array Operators

To further enhance code cleanliness and promote safe functional programming practices, leverage JavaScript's rich set of array operators as much as possible. Methods like `.map()`, `.filter()`, `.reduce()`, `.slice()`, `.sort()`, and others are incredibly powerful for transforming and manipulating data collections in an immutable and declarative way.

Using these operators:

- Promotes Immutability: Most array operators return new arrays, leaving the original array untouched. This functional approach helps prevent unintended side effects and makes your code more predictable.
- Improves Readability: Chaining array operators often lead to more concise and expressive code than traditional for loops or imperative logic. The intent of the operation is clear at a glance.
- Facilitates Functional Programming: These operators are cornerstones of functional programming, encouraging the creation of pure functions that take inputs and produce outputs without causing side effects. This paradigm is highly beneficial for writing robust and testable code that pairs well with React.

By consistently applying these principles, we can maintain a codebase that is not only efficient and performant but also a joy to work with, both now and in the future.

## React (mirrored and adjusted from [react-mcp-server](https://github.com/facebook/react/blob/4448b18760d867f9e009e810571e7a3b8930bb19/compiler/packages/react-mcp-server/src/index.ts#L376C1-L441C94))

### Role

You are a React assistant that helps users write more efficient and optimizable React code. You specialize in identifying patterns that enable React Compiler to automatically apply optimizations, reducing unnecessary re-renders and improving application performance.

### Follow these guidelines in all code you produce and suggest

Use functional components with Hooks: Do not generate class components or use old lifecycle methods. Manage state with useState or useReducer, and side effects with useEffect (or related Hooks). Always prefer functions and Hooks for any new component logic.

Keep components pure and side-effect-free during rendering: Do not produce code that performs side effects (like subscriptions, network requests, or modifying external variables) directly inside the component's function body. Such actions should be wrapped in useEffect or performed in event handlers. Ensure your render logic is a pure function of props and state.

Respect one-way data flow: Pass data down through props and avoid any global mutations. If two components need to share data, lift that state up to a common parent or use React Context, rather than trying to sync local state or use external variables.

Never mutate state directly: Always generate code that updates state immutably. For example, use spread syntax or other methods to create new objects/arrays when updating state. Do not use assignments like state.someValue = ... or array mutations like array.push() on state variables. Use the state setter (setState from useState, etc.) to update state.

Accurately use useEffect and other effect Hooks: whenever you think you could useEffect, think and reason harder to avoid it. useEffect is primarily only used for synchronization, for example synchronizing React with some external state. IMPORTANT - Don't setState (the 2nd value returned by useState) within a useEffect as that will degrade performance. When writing effects, include all necessary dependencies in the dependency array. Do not suppress ESLint rules or omit dependencies that the effect's code uses. Structure the effect callbacks to handle changing values properly (e.g., update subscriptions on prop changes, clean up on unmount or dependency change). If a piece of logic should only run in response to a user action (like a form submission or button click), put that logic in an event handler, not in a useEffect. Where possible, useEffects should return a cleanup function.

Follow the Rules of Hooks: Ensure that any Hooks (useState, useEffect, useContext, custom Hooks, etc.) are called unconditionally at the top level of React function components or other Hooks. Do not generate code that calls Hooks inside loops, conditional statements, or nested helper functions. Do not call Hooks in non-component functions or outside the React component rendering context.

Use refs only when necessary: Avoid using useRef unless the task genuinely requires it (such as focusing a control, managing an animation, or integrating with a non-React library). Do not use refs to store application state that should be reactive. If you do use refs, never write to or read from ref.current during the rendering of a component (except for initial setup like lazy initialization). Any ref usage should not affect the rendered output directly.

Prefer composition and small components: Break down UI into small, reusable components rather than writing large monolithic components. The code you generate should promote clarity and reusability by composing components together. Similarly, abstract repetitive logic into custom Hooks when appropriate to avoid duplicating code.

Optimize for concurrency: Assume React may render your components multiple times for scheduling purposes (especially in development with Strict Mode). Write code that remains correct even if the component function runs more than once. For instance, avoid side effects in the component body and use functional state updates (e.g., setCount(c => c + 1)) when updating state based on previous state to prevent race conditions. Always include cleanup functions in effects that subscribe to external resources. Don't write useEffects for "do this when this changes" side effects. This ensures your generated code will work with React's concurrent rendering features without issues.

Optimize to reduce network waterfalls - Use parallel data fetching wherever possible (e.g., start multiple requests at once rather than one after another). Leverage Suspense for data loading and keep requests co-located with the component that needs the data. In a server-centric approach, fetch related data together in a single request on the server side (using Server Components, for example) to reduce round trips. Also, consider using caching layers or global fetch management to avoid repeating identical requests.

Rely on React Compiler - useMemo, useCallback, and React.memo can be omitted if React Compiler is enabled. Avoid premature optimization with manual memoization. Instead, focus on writing clear, simple components with direct data flow and side-effect-free render functions. Let the React Compiler handle tree-shaking, inlining, and other performance enhancements to keep your code base simpler and more maintainable.

Design for a good user experience - Provide clear, minimal, and non-blocking UI states. When data is loading, show lightweight placeholders (e.g., skeleton screens) rather than intrusive spinners everywhere. Handle errors gracefully with a dedicated error boundary or a friendly inline message. Where possible, render partial data as it becomes available rather than making the user wait for everything. Suspense allows you to declare the loading states in your component tree in a natural way, preventing "flash" states and improving perceived performance.

### Process

1. Analyze the user's code for optimization opportunities:
   - Check for React anti-patterns that prevent compiler optimization
   - Look for component structure issues that limit compiler effectiveness
   - Think about each suggestion you are making and consult React docs for best practices

2. Provide actionable guidance:
   - Explain specific code changes with clear reasoning
   - Show before/after examples when suggesting changes
   - Only suggest changes that meaningfully improve optimization potential

### Optimization Guidelines

- State updates should be structured to enable granular updates
- Side effects should be isolated and dependencies clearly defined

## Comments policy

Only write high-value comments if at all. Avoid talking to the user through comments.

## General style requirements

Use hyphens instead of underscores in flag names (e.g. `my-flag` instead of `my_flag`).

## Codebase Architecture Map

### Project Structure Overview

PK Code is a monorepo with the following architecture:

```
pk-code/
├── packages/
│   ├── core/           # Core business logic and AI integrations
│   ├── cli/            # Terminal UI and command processing
│   └── vscode-ide-companion/  # VSCode extension
├── scripts/            # Build and development automation
├── bundle/             # Distribution artifacts
└── package.json        # Root workspace configuration
```

### Core Package (`packages/core/`)

**Purpose**: Central business logic, AI model integrations, authentication, and tool system.

#### Key Modules:

**Authentication & Configuration:**

- `src/core/contentGenerator.ts` - Content generator factory and `AuthType` enum
- `src/config/config.ts` - Central `Config` class for system configuration
- `src/config/models.ts` - Default model constants (`DEFAULT_PK_MODEL`)
- `src/code_assist/oauth2.ts` - Google OAuth2 implementation

**AI Provider Integrations:**

- `src/core/openaiContentGenerator.ts` - OpenAI API integration
- `src/core/openrouterContentGenerator.ts` - OpenRouter API integration
- `src/core/geminiChat.ts` - Gemini API integration
- `src/core/client.ts` - Main client orchestration

**Tool System:**

- `src/tools/tool-registry.ts` - Tool discovery and registration
- `src/tools/` - File operations, shell commands, web tools, memory tools

**Services:**

- `src/services/fileDiscoveryService.ts` - File discovery with gitignore support
- `src/services/gitService.ts` - Git operations
- `src/services/loopDetectionService.ts` - Infinite loop prevention

**Utilities:**

- `src/utils/paths.ts` - Path manipulation (`PK_DIR = '.pk'`)
- `src/utils/memoryDiscovery.ts` - Memory management
- `src/telemetry/` - OpenTelemetry integration

### CLI Package (`packages/cli/`)

**Purpose**: Terminal user interface, authentication dialogs, and command processing.

#### Key Modules:

**Entry Points:**

- `index.ts` - Global CLI entry point
- `src/pk.tsx` - Main React application bootstrap
- `src/nonInteractiveCli.ts` - Headless mode handler

**Configuration Management:**

- `src/config/config.ts` - CLI argument parsing with yargs
- `src/config/settings.ts` - Hierarchical settings loading (system/user/workspace)
- `src/config/auth.ts` - Authentication method validation
- `src/config/extension.ts` - Extension system
- `src/config/sandboxConfig.ts` - Sandbox configuration

**User Interface (React + Ink):**

- `src/ui/App.tsx` - Main UI orchestrator
- `src/ui/components/AuthDialog.tsx` - Multi-provider authentication selection
- `src/ui/components/OpenAIKeyPrompt.tsx` - OpenAI configuration
- `src/ui/components/OpenRouterKeyPrompt.tsx` - OpenRouter configuration
- `src/ui/hooks/usePkStream.ts` - Core AI response streaming

**Command System:**

- `src/services/CommandService.ts` - Command management
- `src/ui/commands/` - Slash command implementations
- `src/ui/hooks/slashCommandProcessor.ts` - Command parsing

**Theme System:**

- `src/ui/themes/` - Color schemes and theming

### Root Level Structure

**Build System:**

- `esbuild.config.js` - Single-file bundling to `bundle/pk.js`
- `scripts/build.js` - Workspace build orchestration
- `scripts/bundle.js` - Asset copying and bundling
- `package.json` - Workspace management and CLI distribution via `"bin": {"pk": "bundle/pk.js"}`

**Distribution:**

- `bundle/pk.js` - Standalone executable
- `bundle/*.sb` - macOS sandbox configuration files

### Authentication Flow Architecture

**Environment Loading Priority:**

1. Current directory `.pk/.env`
2. Current directory `.env`
3. Parent directories (recursive)
4. Home directory `.pk/.env`
5. Home directory `.env`

**Auth Type Selection Priority:**

1. Saved user preference (`settings.selectedAuthType`)
2. `PK_DEFAULT_AUTH_TYPE` environment variable
3. Auto-detection based on available credentials:
   - `OPENROUTER_API_KEY` → `AuthType.USE_OPENROUTER`
   - `OPENAI_API_KEY` → `AuthType.USE_OPENAI`
   - `GEMINI_API_KEY` → `AuthType.USE_GEMINI`
4. Fallback: Interactive auth dialog

**Configuration Flow:**

```
Environment Loading → Auth Type Selection → Content Generator Creation → API Calls
```

### Key Configuration Points

**Default Model Selection:**

- File: `packages/core/src/config/models.ts:7`
- Current: `DEFAULT_PK_MODEL = 'pk3-coder-max'`

**CLI Model Priority:**

- File: `packages/cli/src/config/config.ts:75`
- Order: `OPENROUTER_MODEL || PK_MODEL || DEFAULT_PK_MODEL`

**Auth Selection (Interactive):**

- File: `packages/cli/src/ui/components/AuthDialog.tsx:57-78`
- Priority: Settings → ENV vars → API key detection → Default (Google Login)

**Auth Selection (Non-Interactive):**

- File: `packages/cli/src/nonInteractiveCli.ts`
- Priority: `OPENROUTER_API_KEY` → `OPENAI_API_KEY` → `PK_API_KEY`

### Global Installation Flow

1. `npm run build` - TypeScript compilation
2. `npm run bundle` - esbuild creates `bundle/pk.js`
3. `npm install -g` - Installs `pk` command globally
4. `pk` command executes `bundle/pk.js`

This architecture supports both development (monorepo with hot reloading) and distribution (single executable) workflows.

---

# Codebase Investigation: Interactive Agent Creation Functionality

**Date**: 2025-10-01
**Investigator**: Codebase Investigator
**Scope**: Open questions from implementation plan including model detection, revision iterations, and agent reuse strategies.

## Initial Assessment

- **Architecture Overview**: Building on CLI structure in packages/cli, integrating new command for agent creation with modes for manual and AI-assisted generation.
- **Current Type Safety Level**: Strong in core, but ensure new features maintain strict typing for agent configs.
- **Key Patterns Identified**: Command processing via yargs, UI components in React/Ink, consistent use of configs and env vars.

## Critical Findings

1. **[Model Detection]**: Dynamic labeling of "Generate with [model]".
   - **Risk Level**: Low
   - **Recommended Action**: Use environment variables or config files to detect current model, falling back to defaults.
   - **Prevention Strategy**: Implement type-safe config reader to avoid runtime errors in model detection.

2. **[Revision Iterations]**: Optimal number in generation mode.
   - **Risk Level**: Medium
   - **Recommended Action**: Limit to 2-3 iterations based on best practices for prompt refinement.
   - **Prevention Strategy**: Add loop detection to prevent excessive revisions.

3. **[Agent Reuse]**: When to use existing vs new agents.
   - **Risk Level**: Medium
   - **Recommended Action**: Prefer existing agents for modularity unless task requires specialized capabilities.
   - **Prevention Strategy**: Type-check agent compatibility before reuse.

## Type Safety Improvements

- **Missing Types**: Add interfaces for agent creation params and responses.
- **Weak Boundaries**: Strengthen typing in command handlers for user inputs.
- **Recommended Strict Rules**: Enable @typescript-eslint/no-unsafe-assignment for config handling.

## ESLint Recommendations

- **Additional Rules to Enable**: @typescript-eslint/consistent-type-definitions for interfaces.
- **Rules to Configure**: Increase max-lines-per-function for complex generators.
- **Auto-fixable Issues**: Enforce consistent naming for agent files.

## Bug Prevention Strategies

- **Defensive Patterns to Implement**: Validate YAML frontmatter in generated agent files.
- **Validation Improvements**: Add schema checks for agent descriptions.
- **Testing Gaps**: Add unit tests for generation modes and model detection.

## Long-term Health

- **Technical Debt Areas**: Potential duplication in config handling across packages.
- **Scalability Concerns**: Ensure agent registry scales with many custom agents.
- **Maintenance Recommendations**: Document agent creation patterns in docs/.

## Action Items

- [ ] Implement model detection using config priorities.
- [ ] Add revision limit to generation mode.
- [ ] Update agent selection logic to prefer reuse.

---
