export interface WidgetAdapter<TInput = any, TData = unknown> {
  canHandle(
    query: string,
    input?: TInput
  ): boolean;

  transform(
    query: string,
    input?: TInput
  ): Promise<TData> | TData;

  validate(
    data: TData
  ): boolean;
}
