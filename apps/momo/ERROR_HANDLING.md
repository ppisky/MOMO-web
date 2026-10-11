# Error handling

Product HTTP handlers return structured errors; the browser validates responses before displaying a message. Streaming errors, cancellations and completed responses have distinct terminal states. Retrying a request must preserve its identity and avoid persisting duplicate messages. See [architecture](../../docs/architecture.md).

Do not include API keys, private prompts or local file paths in browser-facing errors. MOMO does not enable the upstream telemetry service. For the shared component library's upstream reporting design, see [Chatbox documentation](https://github.com/chatboxai/chatbox/blob/0ac6385ae1ff5bf778777826da3c5edcd55b61b8/docs/technical/sentry-error-reporting.md).
