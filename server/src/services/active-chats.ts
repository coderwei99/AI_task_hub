// Shared by chat and confirmation endpoints to prevent confirming an in-flight document.
export const activeChats = new Map<string, AbortController>();
