import type { WidgetExtension } from "../sdk/extension.js";

export class ExtensionRegistry {
  private extensions = new Map<string, WidgetExtension>();

  register(extension: WidgetExtension, options?: { replace?: boolean }): void {
    const id = extension?.manifest?.id;
    if (!id) {
      throw new Error("Cannot register extension without manifest.id");
    }

    if (this.extensions.has(id)) {
      if (options?.replace) {
        this.extensions.set(id, extension);
        return;
      }
      throw new Error(`Widget extension already registered: ${id}`);
    }

    this.extensions.set(id, extension);
  }

  loadAll(extensions: WidgetExtension[], options?: { replace?: boolean }): void {
    for (const ext of extensions) {
      this.register(ext, options);
    }
  }

  unregister(id: string): boolean {
    return this.extensions.delete(id);
  }

  get(id: string): WidgetExtension | undefined {
    return this.extensions.get(id);
  }

  has(id: string): boolean {
    return this.extensions.has(id);
  }

  getAll(): WidgetExtension[] {
    return [...this.extensions.values()];
  }

  findByCapability(capability: string): WidgetExtension[] {
    const target = capability.toLowerCase();
    return this.getAll().filter(extension =>
      extension.manifest.capabilities?.some(c => c.toLowerCase() === target)
    );
  }

  findByIntent(intent: string): WidgetExtension[] {
    const target = intent.toLowerCase();
    return this.getAll().filter(extension =>
      extension.manifest.intents?.some(i => i.toLowerCase() === target)
    );
  }

  clear(): void {
    this.extensions.clear();
  }
}

interface ExtensionRegistryGlobal {
  __CERLESSE_EXTENSION_REGISTRY__?: ExtensionRegistry;
}

const extensionRegistryGlobal = globalThis as unknown as ExtensionRegistryGlobal;

export const extensionRegistry: ExtensionRegistry =
  extensionRegistryGlobal.__CERLESSE_EXTENSION_REGISTRY__ ??
  (extensionRegistryGlobal.__CERLESSE_EXTENSION_REGISTRY__ = new ExtensionRegistry());

export function getExtensionRegistry(): ExtensionRegistry {
  return extensionRegistry;
}

