# Collegamento Fatture in Cloud

Variabili server richieste in Production: `FIC_CLIENT_ID`, `FIC_CLIENT_SECRET`, `FIC_REDIRECT_URI`. Nessuna usa NEXT_PUBLIC. Redirect: `https://raia-gestionale.vercel.app/api/fatture-in-cloud/callback`.

Dopo il deploy: Impostazioni → Fatture in Cloud → Collega. Autorizzare l'azienda, selezionarla se ne compare più di una e usare Verifica anagrafica clienti. Questa fase legge le anagrafiche senza importarle e non emette DDT o fatture.

I token sono cifrati AES-256-GCM in raia_fic_connection. La chiave viene derivata tramite HKDF dal Client Secret: cambiando il segreto occorre ricollegare. RLS permette solo agli amministratori attivi di leggere il contenuto cifrato o modificare la connessione. Le API non restituiscono token al browser. Cookie OAuth HttpOnly/SameSite=Lax/Secure in HTTPS, scadenza 10 minuti, state casuale. Callback verifica nuovamente l'account amministratore. Refresh automatico con lease database per evitare richieste concorrenti.

Restano da attivare dopo il consenso reale: riconciliazione/importazione anagrafiche, creazione DDT, creazione fattura e comando separato invio SDI. Non considerare i pulsanti documentali esistenti già collegati all'API.

Se il dominio cambia, aggiornare sia la configurazione app Fatture in Cloud sia FIC_REDIRECT_URI sul server. Chiavi e token non vanno nei commit, nei log o nei backup Excel.


## Flussi disponibili
Fatture: solo amministratori, da una bozza → Crea fattura in Cloud → scelta cliente, imponibile di riga, IVA e pagamento → calcolo API → conferma creazione. Il documento elettronico è creato ma non inviato allo SDI. Numero e PDF ritornano da Fatture in Cloud; il gestionale segna fatturato dopo successo. Richieste incerte non vengono ripetute; verifica documento remoto e ricollega con ID.

DDT: amministratori e operatori, dal pulsante accanto all'ordine. Richiede SUPABASE_SECRET_KEY sul server Production, mai NEXT_PUBLIC. L'account viene validato prima di usare questa chiave. Solo l'endpoint DDT concede accesso agli operatori; invoice/settings restano admin. La chiave serve per conservare i token fiscali fuori dall'accesso operatore e rinnovarli sul server.

Clienti: l'amministratore usa Clienti → Sostituisci con anagrafica Fatture in Cloud. Vengono lette tutte le pagine prima di salvare; se una richiesta fallisce non viene sostituito nulla. I clienti sono copie persistenti in Supabase. L'anagrafica visibile viene sostituita, i vecchi nomi sono conservati esclusivamente come riferimenti storici per ordini/portale. Nuovo cliente resta disponibile.

Cifra: archivio separato raia_order_admin_values, RLS admin, stringa di 1–8 cifre. Non fa parte di Store, esportazione Excel/JSON, PDF A3, richieste fattura o DDT. Il normale backup completo del database contiene naturalmente anche questa tabella riservata.

Pubblicare il codice su Vercel dopo aver impostato le variabili. La sostituzione reale dei clienti non avviene durante il deploy: va eseguita una volta dal pulsante dedicato. Nessun documento fiscale viene creato dai test.
