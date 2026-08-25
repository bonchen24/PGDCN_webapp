export interface PersistedColumnConfig {
  id: string;
  width?: number;
  visible?: boolean;
}

type ColumnConfigLike = {
  id: string;
  width: number;
  visible: boolean;
};

/**
 * Applies a saved column configuration without losing its order or newer
 * columns that were added after the configuration was stored.
 */
export function mergeColumnConfig<T extends ColumnConfigLike>(
  defaults: readonly T[],
  saved: unknown,
): T[] {
  const defaultById = new Map(defaults.map(column => [column.id, column]));
  const savedById = new Map<string, PersistedColumnConfig>();
  const savedOrder: string[] = [];

  if (Array.isArray(saved)) {
    for (const candidate of saved) {
      if (!candidate || typeof candidate !== 'object' || typeof (candidate as any).id !== 'string') {
        continue;
      }

      const id = (candidate as any).id as string;
      if (!defaultById.has(id) || savedById.has(id)) continue;

      savedById.set(id, candidate as PersistedColumnConfig);
      savedOrder.push(id);
    }
  }

  const orderedIds = [
    ...savedOrder,
    ...defaults.map(column => column.id).filter(id => !savedById.has(id)),
  ];

  return orderedIds.map(id => {
    const defaultColumn = defaultById.get(id) as T;
    const savedColumn = savedById.get(id);

    return {
      ...defaultColumn,
      ...(typeof savedColumn?.width === 'number' ? { width: savedColumn.width } : {}),
      ...(typeof savedColumn?.visible === 'boolean' ? { visible: savedColumn.visible } : {}),
    };
  });
}

/** Prevents the initial default state from overwriting a user's saved layout. */
export function shouldPersistColumnConfig(
  loadedUsername: string | null,
  activeUsername: string | null | undefined,
): boolean {
  return Boolean(
    loadedUsername &&
    activeUsername &&
    loadedUsername === activeUsername,
  );
}
