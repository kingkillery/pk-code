The following link is for a report showing our oldest accounts. Overall Age is denoted by the 'Project Age (in days)'
https://ambia.lightning.force.com/lightning/r/Report/00OUS000005ZOpN2AW/view

---

Pull the top 20 oldest 'Project Name' and list them at the bottom of the email.

---

```
 Email-Create-Agent: Automated Salesforce-Powered Email Generation System

    This codebase creates an autonomous email generation system for Ambia
    Solar's IX (Interconnection) Team that transforms manual daily reporting
    into an AI-powered, data-driven communication workflow. The system
    automatically fetches live KPI data from five Salesforce reports,
    intelligently analyzes performance metrics, and generates authentic
    daily/weekly team update emails in Preston Nackos's distinctive
    management voice.

    How It Works

    The core orchestrator (email_agent.py) performs three main functions:
    data extraction, processing, and generation. It authenticates with
    Salesforce using the simple-salesforce library, pulls data from
    configured reports (Part 1/2 application metrics, witness testing
    results, and aging accounts), and feeds this structured data to an LLM
    via OpenRouter. The system uses sophisticated prompt engineering
    (IX-Email-Generation-Prompt.md) that captures Preston's communication
    patterns, management style, and business context to ensure the generated
    emails are indistinguishable from manually written ones. The refined
    parsing logic handles both TABULAR and SUMMARY report formats, extracting
     specific metrics like submission counts, approval rates, witness test
    results, and the top 20 oldest projects by age.

    System Integration

    The components work together through a multi-layer data pipeline:
    Salesforce reports → Python extraction functions → structured data
    dictionary → AI prompt construction → LLM generation → formatted email
    output. The aging accounts functionality specifically addresses the
    user's requirement by pulling project names and ages from the aging
    report, sorting by oldest first, and including the top 20 in every email.
     Template files like Daily-Email-Template.md and
    Gmail-Formatting-Guide.md provide structural guidance, while
    daily-email.json contains deep voice analysis that informs the AI's tone
    and style. The system supports both interactive mode (for manual
    input/verification) and autonomous mode (for scheduled execution), with
    fallback mechanisms that gracefully handle missing data through file
    parsing or user prompts.

------

We want to now tie our email agent to some of the functionality of AmbiaSolarAgent  (especially all of the functionality in ui/app.py)

---

Note, AmbiaSolarAgent as a whole has /api directory which houses the api set up. Our Email Create Agent should be able to interface with it in order to retrieve current status, summaries, and next steps from our 'AGING ACCOUNTS'

```
