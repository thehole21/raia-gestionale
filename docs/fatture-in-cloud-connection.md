# Collegamento Fatture in Cloud

Variabili server richieste in Production: `FIC_CLIENT_ID`, `FIC_CLIENT_SECRET`, `FIC_REDIRECT_URI`. Nessuna usa NEXT_PUBLIC. Redirect: `https://raia-gestionale.vercel.app/api/fatture-in-cloud/callback`.

Dopo il deploy: Impostazioni → Fatture in Cloud → Collega. Autorizzare l'azienda, selezionarla se ne compare più di una e usare Verifica anagrafica clienti. Questa fase legge le anagrafiche senza importarle e non emette DDT o fatture.

I token sono cifrati AES-256-GCM in raia_fic_connection. La chiave viene derivata tramite HKDF dal Client Secret: cambiando il segreto occorre ricollegare. RLS permette solo agli amministratori attivi di leggere il contenuto cifrato o modificare la connessione. Le API non restituiscono token al browser. Cookie OAuth HttpOnly/SameSite=Lax/Secure in HTTPS, scadenza 10 minuti, state casuale. Callback verifica nuovamente l'account amministratore. Refresh automatico con lease database per evitare richieste concorrenti.

Restano da attivare dopo il consenso reale: riconciliazione/importazione anagrafiche, creazione DDT, creazione fattura e comando separato invio SDI. Non considerare i pulsanti documentali esistenti già collegati all'API.

Se il dominio cambia, aggiornare sia la configurazione app Fatture in Cloud sia FIC_REDIRECT_URI sul server. Chiavi e token non vanno nei commit, nei log o nei backup Excel.
