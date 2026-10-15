import type { SeasonService, SeasonCommand } from '@mage/director';
export type SeasonView = ReturnType<SeasonService['view']>;
/** Whether the local season server is answering: consecutive unreachable requests and when it last replied. */
export const connection = { failures: 0, lastHeard: Date.now() };
export async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    // A read that hangs counts as unreachable; actions may wait on the Director.
    response = await fetch(`/api/${path}`, body === undefined ? { signal: AbortSignal.timeout(4000) } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    connection.failures++;
    throw Error('The camp could not be reached. Try again in a moment.');
  }
  connection.failures = 0;
  connection.lastHeard = Date.now();
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? 'The season could not complete that action.');
  return result as T;
}
export async function seasonCommand(command: SeasonCommand): Promise<SeasonView> {
  const view = await request<SeasonView>('session');
  return request('season', { command, revision: view.revision });
}
