/**
 * Minimal ambient declarations for the Deno APIs used by the edge functions,
 * so they can be type-checked with plain `tsc` (tsconfig.edge.json) without
 * installing Deno. At runtime Deno provides the real implementations.
 */
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  const env: {
    get(key: string): string | undefined;
  };
}
