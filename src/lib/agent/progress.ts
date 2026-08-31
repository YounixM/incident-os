export const PROGRESS_STEPS = [
  { id: "context", label: "Incident context" },
  { id: "error-rate", label: "Error-rate analysis" },
  { id: "deployments", label: "Deployment analysis" },
  { id: "traces", label: "Failed traces" },
  { id: "db-correlation", label: "Database correlation" },
  { id: "root-cause", label: "Root cause validation" },
  { id: "remediation", label: "Remediation" },
] as const;

export type ProgressStepId = (typeof PROGRESS_STEPS)[number]["id"];
