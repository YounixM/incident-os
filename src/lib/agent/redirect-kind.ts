export type RedirectKind = "payment" | "inventory" | "traffic" | "generic";

export function isTrafficPrompt(text: string): boolean {
  return /\b(traffic|spike|rps|qps|load spike|request rate)\b/i.test(text);
}

export function classifyRedirect(text: string): RedirectKind {
  const lower = text.toLowerCase();
  if (isTrafficPrompt(text) && !/\b(payment|inventory)\b/i.test(text)) {
    return "traffic";
  }
  if (lower.includes("payment")) {
    return "payment";
  }
  if (lower.includes("inventory")) {
    return "inventory";
  }
  return "generic";
}
