# Skill: Cerlesse Widgets
Description: Guidelines for querying the widget catalog, choosing widgets based on real evidence, and preparing widgets.

## Guidelines
1. Widgets are capabilities, NOT sub-agents.
2. First call `get_widget_catalog` to inspect what widgets are available in the Registry and what capabilities they require.
3. Only call `prepare_widget` for widgets whose ID exists in the catalog and whose required evidence is present in the tool results.
4. Pass verified `sourceIds` and concrete `params` to `prepare_widget`.
5. NEVER emit arbitrary JSX or JavaScript code; widget visualization is strictly driven by structured configuration and typed props.
6. After preparing all necessary widgets, call `solve_layout` to arrange the selected widgets into a balanced 12-column grid.
