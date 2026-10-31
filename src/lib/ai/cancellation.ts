const requests = new Map<string, Set<AbortController>>();
export function registerAiRequest(owner: string, controller: AbortController): () => void {
  const group = requests.get(owner) ?? new Set<AbortController>();
  group.add(controller);
  requests.set(owner, group);
  return () => { group.delete(controller); if (!group.size) requests.delete(owner); };
}
export function cancelAiRequests(owner: string): void {
  for (const request of requests.get(owner) ?? []) request.abort();
}
