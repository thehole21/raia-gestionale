# RAIA Gestionale

Applicazione Next.js nel progetto originale. Avvio: npm run dev. Verifiche: npm test, npm run typecheck, npm run build.

## Stato attuale

- Interfaccia sobria bordeaux, responsive, ricerca e filtri per mese, anno, stato e operatore. Filtro Consegnati.
- Commesse, lavorazioni, clienti e bozze interne mantenuti dalla base precedente.
- Importazione XLSX/XLS/CSV per foglio, associazione colonne, anteprima, errori bloccanti, riconoscimento reimportazioni identiche. I dati originali di ogni riga vengono conservati.
- DDT con numero e data per ogni commessa; importazione ed esportazione incluse. Per ora un DDT per ordine; consegne parziali richiederanno più DDT e associazione alle quantità.
- PDF fino a 20 MB, anteprima integrata nel browser, scaricamento, eliminazione admin. Il visualizzatore dipende dal supporto PDF del browser.
- Accesso email/password, recupero password, creazione account operatore e revoca accessi predisposti per Supabase. Password gestite da Supabase, non dal database applicativo.
- In assenza di configurazione si può entrare esplicitamente nella demo, salvata nel browser. NON è un ambiente multiutente. I PDF demo sono in IndexedDB e NON sono inclusi nel backup JSON.

## Attivazione Supabase (necessaria prima dell'uso aziendale)

1. Creare un progetto Supabase dedicato, scegliendo una regione UE. Non usare un progetto con dati di altri applicativi.
2. Eseguire database/supabase-setup.sql nel SQL Editor, una sola volta. Gli altri schema SQL sono proposte storiche, non migrazioni da applicare.
3. Creare il primo utente admin dal pannello Authentication e associarlo a raia_profiles con lo SQL commentato in fondo al file. Disabilitare la registrazione pubblica.
4. Copiare .env.example in .env.local e compilare URL, chiave pubblica e service-role solo sul proprio computer/hosting. Non condividere i segreti nella chat. Riavviare Next.js dopo la configurazione.
5. Configurare Site URL e redirect di recupero: https://gestionale.raiaweb.it/?reset=1; durante sviluppo autorizzare anche http://localhost:3000/?reset=1.
6. Configurare SMTP con mittente aziendale verificato e controllare le email di recupero. Il servizio email di sviluppo Supabase non sostituisce la configurazione di produzione.
7. Accedere come admin e creare operatori in Impostazioni. La revoca mantiene le assegnazioni storiche e blocca le richieste al database e ai PDF tramite RLS. Un file già scaricato sul dispositivo non è revocabile.
8. Verificare con account reali: login, recupero, revoca, upload/download PDF, ruolo operatore e modifica simultanea. Questi test remoti non sono eseguibili senza progetto e credenziali.

## Persistenza e conflitti

Questa prima integrazione conserva il modello V2 in uno snapshot JSONB condiviso. Ogni salvataggio passa da una funzione SQL con lock, revisione e audit dell'autore. Un conflitto blocca altri salvataggi: esportare il lavoro in sospeso e ricaricare i dati prima di riapplicarlo. Nessuna fusione silenziosa.
Il limite iniziale è 10 MB per snapshot. Non è una struttura adatta a volumi elevati: con l'Excel definitivo normalizzare ordini/righe/DDT prima della fatturazione automatica. Gli operatori abilitati collaborano sugli stessi dati aziendali; solo admin modifica l'elenco operatori e accede all'API di gestione account.
I dati demo non vengono caricati automaticamente sul cloud. Importare esplicitamente un backup o l'Excel dopo la verifica. Creazione account e aggiunta del nominativo sono due operazioni: se il salvataggio del nominativo fallisce, recuperare il collegamento prima di creare di nuovo l'account.

## Messa online

Dominio previsto: gestionale.raiaweb.it. Il sito principale può cambiare hosting indipendentemente. Il progetto richiede un runtime Next.js/Node, non il solo caricamento FTP di file statici. Configurare le variabili anche sull'hosting e aggiungere il solo record DNS del sottodominio secondo le indicazioni del provider; preservare sito principale e posta. Nessuna modifica DNS eseguita.
Prevedere backup del database E copia separata del bucket PDF, con prova di ripristino.

## Fatture in Cloud: predisposizione, non invio attivo

lib/billing.ts prepara un modello interno versionato con cliente, righe, importi e riferimenti DDT. Le bozze conservano uno snapshot e una submissionKey. Il pulsante Prepara dati API esporta la situazione corrente e segnala dati mancanti; non chiama servizi esterni e non emette fatture.

Per completare l'integrazione occorrono: anagrafiche fiscali definitive, codici IVA del provider, pagamenti/scadenze, company ID, autorizzazione OAuth/API server-side. Creazione documento, invio allo SDI e invio email sono operazioni distinte. Non considerare una fattura consegnata allo SDI sulla sola risposta di creazione.
La futura coda server deve avere una chiave univoca per invio, lock transazionale, ID remoto persistito e stati draft/validated/creating/created/sending/sent/failed/reconcile. In caso di timeout con esito incerto riconciliare col documento remoto prima di ritentare; la submissionKey locale NON presume supporto idempotenza dell'API. Verificare gli esiti con polling/webhook autenticati. Testare i casi di doppio clic, retry, rifiuto e disconnessione prima dell'abilitazione.

Riferimenti ufficiali:
- https://developers.fattureincloud.it/docs/guides/invoice-creation/
- https://developers.fattureincloud.it/docs/guides/e-invoice-management/
- https://supabase.com/docs/guides/storage/security/access-control

## Aggiornamento gruppi e cancellazione
I gruppi cliente/giornata si basano sulla data esecuzione. Per i dati precedenti senza esecuzione si usa la data ordine, esplicitamente segnalata. I due tipi di data restano separati. Lo stato riepilogativo usa sempre tutte le righe, non solo quelle filtrate.
Eseguire anche database/supabase-order-deletion.sql. La cancellazione verifica password e ruolo attivo sul server, impedisce la rimozione di ordini collegati a bozze, controlla la revisione e conserva una copia in raia_deleted_orders. Il recupero è amministrativo dal database; i PDF restano nel bucket. I normali salvataggi non possono eliminare ordini o righe aggirando la verifica.

## Progetto Supabase collegato
Progetto wqhnjmzincfoussybyxd (Raia S.R.L.), regione eu-west-1. Schema e bucket privato applicati tramite migrazione remota. Le operazioni account e cancellazione usano la Edge Function raia-admin con JWT obbligatorio, getUser e controllo profilo attivo. Non occorre più una service-role key in .env.local. I vecchi script SQL di setup sono storici: non rieseguirli sul progetto configurato. database/deployed-schema-reference.sql rappresenta lo schema applicato. Primo amministratore in attesa di creazione account Auth da parte del titolare.


## Area clienti e preventivatore (ottobre 2026)

Percorso locale: /clienti. Il gestionale operatori resta su /. Stesso progetto, schermate e sessioni browser separate (storageKey raia-customer-session). Non basta nascondere le schermate: RLS impedisce ai clienti di accedere al workspace e ai dati/PDF di altri clienti.

- Registrazione email/password con anagrafica; il trigger crea un cliente nel workspace in modo atomico. I metadati di registrazione contengono solo dati anagrafici, mai ruoli staff. L’invio richiede email confermata.
- Specifiche libro, due PDF privati immutabili (20 MB ciascuno), anteprima del PDF originale. Non è un motore di impaginazione, verifica automatica delle pagine o preflight tipografico.
- Conferma richiesta via RPC atomica/idempotente: una richiesta, un lavoro, un collegamento al cliente. Prezzi ancora da definire: nessun listino fittizio, pagamento o preventivo economico vincolante.
- Il gestionale rilegge gli aggiornamenti ogni 15 secondi quando non ha modifiche in salvataggio; il controllo revisioni protegge da sovrascritture. La barra cliente viene aggiornata ogni 15 secondi.
- Il personale conferma l’ordine dal dettaglio Richiesta cliente; gli stati di produzione interna sono indipendenti dalla barra cliente.
- Tracking: corriere e codice salvabili; funzione server-only raia_tracking_event pronta, con verifica abbinamento, idempotenza e protezione dagli eventi fuori ordine. Nessun corriere è connesso: inserire un numero NON attiva ancora aggiornamenti automatici. Collegare un adapter che verifichi firma webhook, normalizzi gli eventi e richiami la funzione con credenziale server. Non esporre mai service_role al browser.

Prima dell’apertura pubblica configurare Supabase Auth: registrazione email abilitata, conferma email, URL Site e redirect consentiti per /clienti e /clienti?reset=1 (in sviluppo http://localhost:3000, in produzione dominio HTTPS scelto). Configurare SMTP per inviare conferme e recuperi ai clienti esterni; verificare un ciclo reale registrazione → email → login → due upload → invio. Il servizio email predefinito non va assunto come pronto per invii pubblici. Configurare informative e condizioni aziendali con i testi effettivi prima del lancio.

DDL applicato: database/customer-portal.sql. Test di integrazione SQL eseguito in transazione con ROLLBACK: registrazione automatica, isolamento dati/PDF tra due clienti, invio idempotente, arrivo nel workspace, rifiuto conferma da cliente, conferma staff, tracking riservato al server, eventi duplicati e fuori ordine. Nessun account/file di prova è rimasto. Il test SQL non sostituisce la prova di consegna delle email e upload binario attraverso Auth/Storage.

Loghi originali in public/images, utilizzati su login, registrazione, sidebar, intestazione e footer clienti; monogramma anche come icona del sito.


### Assegnazioni e annullamento
Ruolo di accesso e assegnazione sono indipendenti: operatori e amministratori attivi entrano nell’elenco tramite trigger del database. Gli ordini manuali e le nuove righe preselezionano l’utente collegato; la scelta resta modificabile. Il profilo personale con titolo Tecnico conserva role=admin e tutti i permessi, ma viene escluso dalle assegnazioni anche lato database.

Annullamento disponibile nel dettaglio del lavoro e della lavorazione per tutti gli account staff attivi, con conferma esplicita e password. L’ordine passa nell’archivio di Panoramica → Ordini annullati, con anagrafica cliente e nome di chi annulla conservati al momento dell’operazione. Una bozza di fatturazione collegata deve essere rimossa prima. Il cliente vede Ordine annullato; conferme o eventi di tracking successivi non possono riattivarlo. Email rinviata su richiesta del titolare: nessun invio viene dichiarato o effettuato.

Test SQL ripetibile con ROLLBACK: tests/cancellation.integration.sql. Verifica anche inserimento amministratore nelle assegnazioni, esclusione Tecnico, archivio e stato terminale. Sidebar desktop comprimibile a icone con preferenza locale; menu mobile indipendente.


### Preventivatore staff e layout adattivi
Menu Preventivatore prima di Impostazioni. Inserimento per qualsiasi cliente dell’anagrafica, anche senza account portale: richiede due PDF e crea un ordine confirmed con lavorazione Da elaborare. Per un cliente già registrato, richiesta e PDF sono visibili nel suo portale. Conferma staff verificata lato database: i clienti non possono chiamare questo percorso. Assegnazione predefinita al creatore, modificabile; Tecnico escluso. Listino economico ancora da definire. Schema: database/staff-quote.sql; test transazionale con rollback: tests/staff-quote.integration.sql.

Impostazioni organizzate in Il mio account, Utenti e permessi, Backup e dati; eliminata la scheda Nominativi. Layout adattivi per login, registrazione, dashboard, impostazioni, moduli e preventivatori. Form a colonna su mobile, target touch e tabelle scorrevoli. Build e controlli TypeScript passati; verifica visiva su telefono ancora da completare perché la scheda browser integrata era una pagina di errore data: non accessibile al controllo UI.
