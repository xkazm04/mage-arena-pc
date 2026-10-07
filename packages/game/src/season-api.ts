import type { SeasonService, SeasonCommand } from '@mage/director';
export type SeasonView = ReturnType<SeasonService['view']>;
export async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? 'The season could not complete that action.');
  return result as T;
}
export async function seasonCommand(command: SeasonCommand): Promise<SeasonView> {
  const view = await request<SeasonView>('session');
  return request('season', { command, revision: view.revision });
}
