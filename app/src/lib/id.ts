/** ID locale univoco a sufficienza per questo caso d'uso: timestamp + suffisso casuale. */
export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
