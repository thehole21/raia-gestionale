# Gestionale RAIA: NAS, accesso remoto e Fatture in Cloud

## Architettura prevista

Il NAS ospita l'app Next.js in un container Docker di produzione, con riavvio automatico, indirizzo di rete stabile e HTTPS. Supabase Pro conserva database, autenticazione e PDF. Il NAS può inoltre ricevere backup periodici separati del database e dei file: ospitare l'app sul NAS non rende il database locale e non introduce automaticamente il funzionamento offline.

In ufficio si apre l'indirizzo del gestionale dal browser. Da fuori si attiva una VPN privata e si usa lo stesso indirizzo. Il NAS e la connessione aziendale devono restare disponibili. Vercel si disattiva solo dopo aver verificato login, recupero password, documenti e accesso remoto sul nuovo ambiente.

Il portale pubblico clienti è stato rimosso. Il gestionale può restare sulla rete aziendale/VPN; non richiede un accesso pubblico per clienti esterni.

## Informazioni necessarie del NAS e della rete

- Marca e modello esatto del NAS; processore/architettura, RAM installata e versione del sistema operativo.
- Disponibilità di Docker, Container Manager o Container Station.
- Dischi installati, configurazione RAID, spazio libero, applicazioni già in esecuzione e presenza di UPS.
- Modello del router, gestore Internet, disponibilità di un IP pubblico raggiungibile e presenza eventuale di CGNAT. IP statico non obbligatorio se si può usare un DDNS.
- Numero di persone/dispositivi che accederanno da fuori, sistemi operativi e possibilità di installare il client VPN.
- Sistema di backup già presente, destinazione e frequenza; un RAID non sostituisce una copia di backup.

WireGuard non richiede un abbonamento software, ma deve essere compatibile con NAS/router e raggiungibile dalla rete esterna. Con CGNAT vanno valutati un IP pubblico del gestore, un relay oppure un servizio di rete privata. Il piano personale gratuito di Tailscale non è una soluzione da presumere valida per l'uso aziendale.

Fonti: https://www.wireguard.com/ e https://tailscale.com/pricing?plan=business

## Collegamento Fatture in Cloud

Per partire servono un accesso autorizzato all'azienda FiC e il piano attivo. Va creata un'app di integrazione: per il collegamento continuativo si usa OAuth, con Client ID, Client Secret e URL di ritorno configurato. L'identificativo azienda (Company ID) può essere recuperato dalle API dopo l'autorizzazione. Un token manuale può servire per prove circoscritte, ma non è il flusso raccomandato per il collegamento continuativo di un gestionale.

Autorizzazioni iniziali previste: clienti, fatture e DDT in lettura/scrittura; impostazioni in lettura. Si aggiungono altre autorizzazioni solo se richieste da una funzione concreta. Il titolare deve autorizzare l'app con un account che abbia i corrispondenti permessi in FiC.

Per i documenti servono inoltre: ragione sociale completa verificata, dati fiscali, numerazioni/sezionali DDT e fatture, aliquote IVA, condizioni e metodi di pagamento, IBAN se previsto, causali di trasporto, destinazione, vettori e modello PDF desiderato. Clienti e impostazioni disponibili vengono recuperati da FiC e collegati alle anagrafiche esistenti, evitando duplicati.

Password, token e Client Secret non vanno incollati in chat, salvati nel repository o messi in variabili NEXT_PUBLIC_. Saranno configurati nelle variabili riservate del backend o nelle funzioni Supabase. L'URL di ritorno e gli eventuali webhook possono risiedere nel backend cloud, lasciando il NAS privato.

Prima dell'emissione effettiva si verificano anagrafiche, importi, IVA e numerazioni. La creazione di una fattura, l'invio allo SDI e l'accettazione sono stati distinti. Il gestionale deve salvare gli ID remoti e gestire i tentativi incerti senza creare documenti doppi.

Fonti ufficiali:
- https://developers.fattureincloud.it/docs/authentication/
- https://developers.fattureincloud.it/docs/authentication/manual-authentication/
- https://developers.fattureincloud.it/docs/basics/scopes/

## Stato attuale

Nessun trasferimento di hosting o collegamento fiscale effettivo è stato eseguito. Il gestionale usa il progetto Supabase esistente. Le schede di lavoro hanno una numerazione separata e persistente nella tabella raia_work_sheet_numbers, assegnata dalla funzione raia_work_sheet_number esclusivamente allo staff autorizzato. Il codice viene attribuito alla prima generazione della scheda e resta lo stesso nelle ristampe. Questa tabella deve essere inclusa nei backup del database; non è contenuta nel solo JSON degli ordini.
