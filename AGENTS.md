# Project Instructions for Cerlesse Agent Architecture

Cerlesse uses one Agent only: OpenAI Codex.
Never reintroduce a second agent loop.
Never implement another LLM planner/selector/router.
Widgets are tools/capabilities, not agents.
Widgets must come from the registry.
The model must not emit JSX or arbitrary JavaScript.
Search results must remain traceable to source IDs.
Do not claim a tool was executed unless a real tool result exists.
When evidence is insufficient, search again or say the evidence is insufficient.
Layout is not a business decision layer.
Dangerous operations require explicit permission/approval.
