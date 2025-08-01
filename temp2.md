Of course. Here is an in-depth guide to how the sub-agents (`/agents`) functionality works in pk Code, based on the provided video.

---

## A Comprehensive Guide to Sub-agents in pk Code

pk Code's sub-agents feature is a powerful implementation of a multi-agent system designed to solve two of the biggest challenges in AI development: **context management** and **tool selection**. By allowing you to create specialized, reusable AI assistants, you can build more complex, efficient, and reliable workflows.

### 1. What Are Sub-agents?

Think of sub-agents as a team of specialized experts that your main pk Code instance (the "orchestrator") can delegate tasks to. Each sub-agent is a self-contained, specialized instance of pk with its own unique purpose, tools, and instructions.

**Key Characteristics of a Sub-agent:**

*   **Specific Purpose:** Each agent is designed for a narrow, well-defined task (e.g., code reviewer, debugger, unit test writer).
*   **Separate Context Window:** This is the most critical feature. A sub-agent operates in a context window that is completely separate from the main conversation. This prevents the main chat from getting cluttered with the sub-agent's internal thought processes and actions.
*   **Custom System Prompt:** You define the agent's behavior, persona, and responsibilities through a detailed system prompt.
*   **Limited Tool Access:** You can restrict which tools an agent can use, improving security and making tool selection more accurate.

### 2. The Sub-agent Workflow: How It Works

The video provides a clear flowchart (`00:33`) that illustrates the delegation process.

1.  **Task Initiation:** You give a task to the main pk Code orchestrator.
2.  **Delegation Check:** The orchestrator analyzes your request and compares it against the `description` of all available sub-agents.
3.  **Decision Point:**
    *   **If a match is found:** The task is delegated to the most suitable sub-agent. The main conversation pauses while the sub-agent works.
    *   **If no match is found:** The main orchestrator handles the task itself within the main context.
4.  **Sub-agent Execution:** The activated sub-agent works on the task in its own isolated environment. It uses its specific system prompt and limited toolset to solve the problem. All of its actions, tool uses, and internal reasoning happen within its private context window.
5.  **Return Results:** Once the sub-agent has completed its task, it doesn't return its entire work history. Instead, it provides a final, concise result back to the main orchestrator.
6.  **Integration:** The main orchestrator integrates this result into the main conversation and continues the workflow.

This process ensures the main context remains clean and focused on high-level objectives, while the complex, noisy work is handled by specialized agents behind the scenes.

### 3. Core Benefits of Using Sub-agents

The mind map at `01:50` highlights the key advantages:

| Benefit Category          | Specific Advantages                                          |
| :------------------------ | :----------------------------------------------------------- |
| **Context Preservation**  | • **No Pollution:** Keeps the main conversation clean by offloading intermediate steps. <br> • **Separate Windows:** Each agent's work doesn't interfere with others. <br> • **Focused Objectives:** Allows the main agent to focus on the bigger picture. |
| **Flexible Permissions**  | • **Improved Tool Selection:** With fewer tools to choose from, agents make fewer mistakes. <br> • **Security Boundaries:** You can limit dangerous tools (like file deletion or shell access) to only the agents that absolutely need them. |
| **Specialized Expertise** | • **Domain-Specific Instructions:** Highly detailed system prompts make agents true experts in their niche. <br> • **Higher Success Rates:** Specialization leads to more reliable and accurate task completion. |
| **Reusability**           | • **Use Across Projects:** Define an agent once and use it everywhere. <br> • **Share with Team:** Promotes consistency and collaboration by sharing proven agent configurations. |

### 4. How to Create and Manage Sub-agents

You can create, view, edit, and delete sub-agents directly from the pk Code terminal using the `/agents` command.

#### File Structure

Sub-agents are defined in Markdown (`.md`) files and can be stored in two locations:

*   **Project Agents:** Located in the `.pk/agents/` directory within your current project. These are specific to the project.
*   **Personal (User) Agents:** Located in `~/.pk/agents/` in your home directory. These are global and available across all your projects.

> **Priority:** If a Project agent and a Personal agent have the same name, the **Project agent will take priority**.

#### The Creation Process (`/agents`)

Here is the step-by-step workflow for creating a new agent, as shown in the video (`04:25`):

1.  **Initiate:** Type `/agents` and press Enter.
2.  **Select Action:** Choose **Create new agent** from the menu.
3.  **Choose Location:**
    *   `Project`: To create an agent only for the current project.
    *   `Personal`: To create a global agent available everywhere.
4.  **Choose Creation Method:**
    *   **Generate with pk (Recommended):** pk will help you write the description and system prompt.
    *   `Manual configuration`: You will create the file and fill it out yourself.
5.  **Describe the Agent's Purpose:** Provide a clear, natural language description of what the agent does and when it should be used. For example: `Okay, so this agent is going to write unit tests for every change that the main agent makes.`
6.  **Select Tools:** You will be presented with a list of all available tools. You can use your arrow keys and the spacebar to toggle which tools this specific agent is allowed to use. This is crucial for security and performance.
7.  **Choose a Color:** Assign a color to the agent. This color will be used in the terminal output to make it easy to see which agent is currently active.
8.  **Confirm and Save:** pk will display a summary of the agent's configuration (name, description, tools, and system prompt). Press Enter to save the agent, which creates the corresponding `.md` file.

### 5. Using Your Sub-agents

Once created, sub-agents can be invoked in two ways:

1.  **Automatic Delegation:** This is the most common method. Simply state your task in the main chat. pk's orchestrator will analyze your prompt, and if it matches the `description` of one of your sub-agents, it will automatically delegate the task.
    *   *Example from video:* The user types `test to test the current functionality`. pk recognizes this matches the purpose of the `unit-test-writer` agent and activates it.

2.  **Explicit Invocation:** You can directly command pk to use a specific agent.
    *   *Example:* `"Use the code-quality-auditor to review my recent changes."`

By mastering sub-agents, you can transform pk Code from a single powerful assistant into a highly efficient, specialized team capable of tackling incredibly complex development workflows.