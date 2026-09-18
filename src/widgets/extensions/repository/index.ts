import { manifest } from "./manifest.js";
import { repositoryAdapter } from "./adapter.js";
import { RepositoryWidget } from "./widget.js";
import type { WidgetExtension } from "../../sdk/extension.js";
import type { RepositoryData } from "./types.js";

const repositoryExtension: WidgetExtension<RepositoryData> = {
  manifest,
  adapter: repositoryAdapter,
  component: RepositoryWidget
};

export default repositoryExtension;
export { manifest, repositoryAdapter, RepositoryWidget };
