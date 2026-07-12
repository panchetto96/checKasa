export type RootStackParamList = {
  Proprieta: undefined;
  NuovaProprieta: undefined;
  DettaglioProprieta: { id: string };
  NuovaStanza: { propertyId: string };
  Sessione: { sessionId: string };
  CatturaStanza: { sessionId: string; roomId: string };
  Cronologia: { propertyId: string };
  RiepilogoSessione: { sessionId: string };
  Firma: { sessionId: string };
};
