# Skill: Cerlesse Search
Description: Guidelines for executing web retrieval, querying search engines, handling search candidates, and extracting source evidence.

## Guidelines
1. Call `search_web` with focused, targeted keyword queries.
2. If initial evidence is insufficient or contradictory, call `search_web` again with refined search queries rather than hallucinating facts.
3. Every search candidate returned has a unique `id` (or URL). Keep track of these source IDs for downstream citations and widget bindings.
4. Call `search_images` when the user query asks for images, wallpapers, photos, or diagrams.
