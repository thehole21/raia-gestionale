# Fatture in Cloud: verifica e integrazione prevista

Verifica documentazione ufficiale: 28 ottobre 2026.

## Disponibile nel gestionale

- Selezione del cliente locale e di un singolo ordine per preparare i documenti.
- DDT PDF locale con anagrafica, destinazione e righe dell'ordine.
- Preparazione delle bozze fattura.
- Indicatore Fatturato distinto dalle bozze: documento remoto creato e identificato, oppure fatturazione storica importata. Un ordine parzialmente fatturato mostra il conteggio delle righe fatturate.
- Richieste diverse dello stesso cliente nella stessa giornata restano ordini indipendenti. Nessuna divisione automatica dei dati storici già salvati dentro un unico ordine.

L'account Fatture in Cloud non è ancora collegato: nessuna creazione o trasmissione reale è attiva.

## Funzioni supportate dalle API

1. Elencare, leggere, creare e modificare clienti. È possibile scegliere un cliente FiC e collegarlo tramite ficEntityId. L'ID non autocompila il documento: il server deve recuperare l'anagrafica e includerla nei dati del documento.
2. Creare documenti di trasporto con tipo delivery_note; ottenere il PDF e modificare i documenti secondo le regole dell'account.
3. Creare fatture, anche partendo da uno o più DDT. Join/transform restituiscono la struttura da inviare alla creazione: non emettono da soli il documento. Per mantenere distinte le voci usare group=0.
4. Validare XML e inviare fatture elettroniche allo SDI, con stato ed eventuali motivi di scarto. Creata, inviata e accettata sono stati diversi.
5. Inviare documenti per email e ricevere webhook per aggiornamenti. Dopo una notifica occorre rileggere il documento.

## Collegamento successivo

Credenziali esclusivamente sul server. Collegare azienda FiC, autorizzazioni clienti/fatture/DDT, dati fiscali, aliquote IVA e pagamenti; completare gli importi mancanti prima dell'emissione. Il JSON interno delle bozze richiede una conversione nel payload ufficiale.

Registrare ID remoto e stato; serializzare le richieste di emissione, impedire doppi clic e riconciliare gli esiti incerti prima di ritentare. Gli aggiornamenti remoti devono aggiornare la spunta senza confondere una bozza con una fattura creata.

Le API sono disponibili anche in prova, ma l'invio allo SDI richiede un piano a pagamento. Verificare limiti e funzionalità dell'abbonamento effettivo. I PDF hanno URL temporanei (7 giorni): recuperarli nuovamente quando necessario. Gestire paginazione, quote e Retry-After.

## Fonti ufficiali

- https://developers.fattureincloud.it/docs/FAQs/
- https://developers.fattureincloud.it/docs/guides/invoice-creation/
- https://developers.fattureincloud.it/docs/guides/invoice-join-transform/
- https://developers.fattureincloud.it/docs/guides/e-invoice-management/
- https://developers.fattureincloud.it/docs/webhooks/notification-types/
- https://developers.fattureincloud.it/docs/basics/activation/
- https://developers.fattureincloud.it/docs/basics/limits-and-quotas/
- https://developers.fattureincloud.it/blog/url-expiration/
- https://developers.fattureincloud.it/docs/authentication/
