/** Framework-neutral HTTP port shared by the Web host and product handlers. */
export type HandlerArgs = {
  request: Request
  params: Record<string, string | undefined>
  context: Record<string, unknown>
}
export type LoaderFunctionArgs = HandlerArgs
export type ActionFunctionArgs = HandlerArgs
