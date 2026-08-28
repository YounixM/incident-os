export {};

declare global {
  interface ModelContextTool {
    name: string;
    title?: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    execute: (
      inputObject?: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ) => Promise<unknown>;
    annotations?: {
      readOnlyHint?: boolean;
      untrustedContentHint?: boolean;
    };
  }

  interface ModelContext {
    registerTool(
      tool: ModelContextTool,
      options?: { signal?: AbortSignal },
    ): Promise<void>;
    /** Chrome / in-app hosts. ChatGPT's site-tools subset may omit this. */
    getTools?(): Promise<ModelContextTool[]>;
    executeTool?(
      tool: ModelContextTool,
      inputObject?: Record<string, unknown>,
    ): Promise<string>;
  }

  interface Document {
    readonly modelContext?: ModelContext;
  }

  interface Window {
    __INCIDENTOS_FAST?: boolean;
    __INCIDENTOS_FORCE_DEMO?: boolean;
  }
}
