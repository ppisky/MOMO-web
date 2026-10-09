// Product request port. The browser and native entry bind their own transport.
let transport: typeof fetch = (input, init) => globalThis.fetch(input, init);
export function installTransport(value: typeof fetch): void { transport = value; }
export const request: typeof fetch = (input, init) => transport(input, init);
