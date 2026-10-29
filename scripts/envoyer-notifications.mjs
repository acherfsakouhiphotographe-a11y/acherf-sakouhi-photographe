/* =====================================================================
   ACHREF SAKOUHI — Envoi des notifications push
   ---------------------------------------------------------------------
   Tourne SUR GITHUB ACTIONS (gratuit pour un dépôt public), jamais dans
   le navigateur : il utilise la clé de service Firebase, qui doit rester
   secrète (secret GitHub FIREBASE_SERVICE_ACCOUNT).

   À chaque passage (toutes les 5 à 15 minutes, ou tout de suite si Achref
   a enregistré un jeton GitHub dans l'app) :
     1. la veille de l'expiration d'un lien SwissTransfer non téléchargé,
        il crée un rappel pour le client (une seule fois) ;
        avant chaque réservation confirmée (dans la semaine, puis la veille),
        il crée un rappel pour le client et pour Achref (version 1.7) ;
     2. il envoie toutes les notifications « en attente » aux téléphones
        du destinataire, dans sa langue (français ou arabe) ;
     3. il supprime les jetons des téléphones qui n'existent plus ;
     4. il efface chez Cloudinary les reels supprimés par Achref
        (secret GitHub CLOUDINARY_URL ; sans lui, cette étape est sautée).

   Test à blanc (n'envoie rien) :  DRY_RUN=1 node envoyer-notifications.mjs
   ===================================================================== */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { createHash } from "node:crypto";

const TZ = "Africa/Tunis";
const DRY_RUN = process.env.DRY_RUN === "1";
const APP_URL = ((process.env.APP_URL || "").trim() || "./").replace(/\/?$/, "/");
const MAX_AGE_MS = 3 * 86400000;      // une notification vieille de plus de 3 jours n'est plus envoyée

const brut = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!brut) { console.error("✗ Secret FIREBASE_SERVICE_ACCOUNT absent."); process.exit(1); }
initializeApp({ credential: cert(JSON.parse(brut)) });
const db = getFirestore();
const fcm = getMessaging();

const isoDate = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const AUJ = isoDate(new Date()), DEMAIN = isoDate(new Date(Date.now() + 86400000));
console.log(`— ${new Date().toISOString()} · aujourd'hui ${AUJ} (${TZ})${DRY_RUN ? " · TEST À BLANC" : ""} · app ${APP_URL}`);

/* 1. Rappels : liens qui expirent demain ------------------------------- */
let rappels = 0;
const exp = await db.collection("livraisons").where("expireLe", "==", DEMAIN).get();
for (const d of exp.docs) {
  const l = d.data();
  if (l.telechargeAt || l.rappelEnvoye) continue;
  const id = `n_rappel_${l.id}_${DEMAIN}`;
  const n = {
    id, target: l.clientId, kind: "rappel",
    fr: { t: "Votre lien expire demain", b: `Pensez à télécharger « ${l.titre} » avant demain soir.` },
    ar: { t: "ينتهي الرابط غدًا", b: `لا تنسوا تحميل «${l.titre}» قبل مساء الغد.` },
    lien: "photos/" + l.id, ts: Date.now(), lu: false, envoi: "attente"
  };
  if (!DRY_RUN) {
    await db.collection("notifs").doc(id).set(n);
    await d.ref.update({ rappelEnvoye: true });
  }
  rappels++;
}
console.log(`• Rappels d'expiration créés : ${rappels}`);

/* 1 bis. Rappels avant l'événement (version 1.7) ----------------------
   Réservation confirmée : un rappel dans la semaine qui précède (entre 7 et 2 jours avant,
   une seule fois) et un rappel la veille, pour le client et pour Achref. Événements ajoutés
   à la main dans l'agenda : les mêmes rappels, pour Achref seul. Le jour rappelé est noté
   (rappelJ7 / rappelJ1) : si les dates changent, les rappels repartent pour les nouvelles dates. */
const DANS7 = isoDate(new Date(Date.now() + 7 * 86400000));
const ecart = (de, a) => { const f = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((f(a) - f(de)) / 86400000); };
const TYPES_AR = { "Mariage": "عرس", "Wtiya": "وطية", "Henné": "حنّة", "Fiançailles": "خطوبة", "Contrat de mariage": "عقد القران",
  "Séance couple": "جلسة تصوير للعروسين", "Portrait": "بورتريه", "Événement": "مناسبة", "Autre": "مناسبة" };
const typeAr = type => TYPES_AR[type] || type;
const dateTxt = (iso, lang) => { const [y, m, d] = iso.split("-").map(Number);
  try{ return new Intl.DateTimeFormat(lang === "ar" ? "ar-TN-u-nu-latn" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d))); }
  catch(e){ return iso; } };
const joursAr = n => n === 1 ? "يوم" : (n === 2 ? "يومان" : (n <= 10 ? "أيام" : "يومًا"));
const premierJour = d => (Array.isArray(d.jours) && d.jours.length ? d.jours.map(x => x.date).filter(Boolean).sort()[0] : d.date) || "";
const typeDuJour = (d, iso) => { const j = Array.isArray(d.jours) ? d.jours.find(x => x.date === iso) : null; return (j && j.type) || d.type || "Mariage"; };
// Quel rappel envoyer pour un événement dans n jours : « j7 » (7 à 2 jours avant), « j1 » (la veille), sinon aucun.
const quelRappel = n => n === 1 ? ["j1", "rappelJ1"] : (n >= 2 && n <= 7 ? ["j7", "rappelJ7"] : null);
const equipeDe = async cle => { try{ const a = await db.collection("affectations").doc(cle).get(); return a.exists && Array.isArray(a.data().personnes) ? a.data().personnes : []; }catch(e){ return []; } };
async function creerNotif(n){ if(!DRY_RUN) await db.collection("notifs").doc(n.id).set(Object.assign({ ts: Date.now(), lu: false, envoi: "attente" }, n)); }

let rappelsEvt = 0;
const confirmees = await db.collection("demandes").where("statut", "==", "confirmee").get();
for(const doc of confirmees.docs){
  const d = doc.data(), p = premierJour(d); if(!p) continue;
  const n = ecart(AUJ, p), r = quelRappel(n); if(!r) continue;
  const [cle, champ] = r; if(d[champ] === p) continue;
  const type = typeDuJour(d, p), lieu = d.lieu ? " — " + d.lieu : "", P = await equipeDe("d_" + d.id + "_" + p);
  const equipeFr = P.length ? " — Équipe : " + P.join(", ") : "", equipeAr = P.length ? " — الفريق: " + P.join("، ") : "";
  // Le client
  await creerNotif({ id: `n_${cle}_${d.id}_${p}`, target: d.clientId, kind: "rappel_evt", lien: "reserver",
    fr: cle === "j1" ? { t: "C'est demain !", b: `${type} : ${dateTxt(p, "fr")}. Achref et son équipe seront là. À demain !` }
      : { t: n === 7 ? "Plus qu'une semaine !" : `Plus que ${n} jours !`, b: `${type} : ${dateTxt(p, "fr")}. Pensez à vérifier le programme du jour J dans l'app.` },
    ar: cle === "j1" ? { t: "إنّه غدًا!", b: `${typeAr(type)}: ${dateTxt(p, "ar")}. أشرف وفريقه سيكونون في الموعد. إلى الغد!` }
      : { t: n === 7 ? "بقي أسبوع واحد!" : `بقي ${n === 2 ? "" : n + " "}${joursAr(n)}!`, b: `${typeAr(type)}: ${dateTxt(p, "ar")}. لا تنسوا مراجعة برنامج اليوم الكبير في التطبيق.` } });
  // Achref
  await creerNotif({ id: `n_${cle}_a_${d.id}_${p}`, target: "admin", kind: "rappel_evt", lien: "demandes/" + d.id,
    fr: { t: cle === "j1" ? "Demain" : `Dans ${n} jours`, b: `${type} — ${d.clientNom || "Client"} — ${dateTxt(p, "fr")}${lieu}${equipeFr}` },
    ar: { t: cle === "j1" ? "غدًا" : `بعد ${n === 2 ? "يومين" : n + " " + joursAr(n)}`, b: `${typeAr(type)} — ${d.clientNom || ""} — ${dateTxt(p, "ar")}${lieu}${equipeAr}` } });
  if(!DRY_RUN) await doc.ref.update({ [champ]: p });
  rappelsEvt++;
}
const manuels = await db.collection("evenements").where("date", ">=", DEMAIN).where("date", "<=", DANS7).get();
for(const doc of manuels.docs){
  const e = doc.data(); if(!e.date) continue;
  const n = ecart(AUJ, e.date), r = quelRappel(n); if(!r) continue;
  const [cle, champ] = r; if(e[champ] === e.date) continue;
  const type = e.type || "Événement", note = e.note ? " — " + e.note : "", P = await equipeDe("e_" + e.id);
  await creerNotif({ id: `n_${cle}_e_${e.id}_${e.date}`, target: "admin", kind: "rappel_evt", lien: "tableau/agenda",
    fr: { t: cle === "j1" ? "Demain" : `Dans ${n} jours`, b: `${type}${note} — ${dateTxt(e.date, "fr")}${P.length ? " — Équipe : " + P.join(", ") : ""}` },
    ar: { t: cle === "j1" ? "غدًا" : `بعد ${n === 2 ? "يومين" : n + " " + joursAr(n)}`, b: `${typeAr(type)}${note} — ${dateTxt(e.date, "ar")}${P.length ? " — الفريق: " + P.join("، ") : ""}` } });
  if(!DRY_RUN) await doc.ref.update({ [champ]: e.date });
  rappelsEvt++;
}
console.log(`• Rappels avant l'événement créés : ${rappelsEvt}`);

/* 2. Envoi des notifications en attente ------------------------------- */
const attente = await db.collection("notifs").where("envoi", "==", "attente").limit(300).get();
console.log(`• Notifications en attente : ${attente.size}`);
const cacheJetons = new Map();
async function jetonsDe(cible) {
  if (cacheJetons.has(cible)) return cacheJetons.get(cible).filter((x) => !x.mort);
  const q = cible === "admin"
    ? db.collection("pushTokens").where("role", "==", "admin")
    : db.collection("pushTokens").where("userId", "==", cible);
  const snap = await q.get();
  const liste = snap.docs.map((x) => ({ ref: x.ref, ...x.data() })).filter((x) => x.token);
  cacheJetons.set(cible, liste);
  return liste;
}

let envoyes = 0, echecs = 0, nettoyes = 0;
for (const d of attente.docs) {
  const n = d.data();
  if (Date.now() - (n.ts || 0) > MAX_AGE_MS) { if (!DRY_RUN) await d.ref.update({ envoi: "ignore" }); continue; }
  const jetons = await jetonsDe(n.target);
  if (!jetons.length) { if (!DRY_RUN) await d.ref.update({ envoi: "sans-appareil", envoyeAt: Date.now() }); continue; }
  const messages = jetons.map((j) => {
    const txt = (j.lang === "ar" && n.ar) ? n.ar : (n.fr || {});
    return {
      token: j.token,
      data: {
        title: String(txt.t || "Achref Sakouhi"), body: String(txt.b || ""),
        url: APP_URL + "index.html" + (n.lien ? "#" + n.lien : ""), tag: String(n.id), lang: j.lang === "ar" ? "ar" : "fr"
      },
      webpush: { headers: { Urgency: "high", TTL: "172800" } }
    };
  });
  if (DRY_RUN) { console.log(`  (test) ${n.id} → ${messages.length} appareil(s) : ${messages[0].data.title}`); continue; }
  const res = await fcm.sendEach(messages);
  let ok = 0;
  for (let i = 0; i < res.responses.length; i++) {
    const r = res.responses[i];
    if (r.success) { ok++; continue; }
    const code = (r.error && r.error.code) || "";
    if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) {
      try { await jetons[i].ref.delete(); jetons[i].mort = true; nettoyes++; } catch (e) {}
    }
  }
  envoyes += ok; echecs += messages.length - ok;
  await d.ref.update({ envoi: ok ? "fait" : "echec", envoyeAt: Date.now(), nbEnvois: ok });
}
console.log(`✓ Envoyés : ${envoyes} · échecs : ${echecs} · jetons supprimés : ${nettoyes}`);

/* 4. Reels supprimés par Achref : la vidéo est aussi effacée chez Cloudinary ---- */
// CLOUDINARY_URL = « API environment variable » de Cloudinary : cloudinary://CLÉ:SECRET@NOM
const cld = (process.env.CLOUDINARY_URL || "").trim().replace(/^CLOUDINARY_URL=/, "").match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?\s]+)/);
if(!cld){
  console.log("• Reels : secret CLOUDINARY_URL absent, effacement chez Cloudinary sauté.");
} else {
  const [, cleApi, secret, nuage] = cld;
  const aEffacer = await db.collection("reelsSupprimes").limit(50).get();
  let effaces = 0, rates = 0;
  for(const d of aEffacer.docs){
    const r = d.data();
    if(!r.publicId){ if(!DRY_RUN) await d.ref.delete(); continue; }
    if(DRY_RUN){ console.log(`  (test) effacer ${r.publicId}`); continue; }
    const ts = Math.floor(Date.now() / 1000);
    // Signature Cloudinary : paramètres triés par nom, puis le secret, en SHA-1.
    const signature = createHash("sha1").update(`invalidate=true&public_id=${r.publicId}&timestamp=${ts}${secret}`).digest("hex");
    try{
      const rep = await fetch(`https://api.cloudinary.com/v1_1/${nuage}/video/destroy`, {
        method: "POST", body: new URLSearchParams({ public_id: r.publicId, invalidate: "true", timestamp: String(ts), api_key: cleApi, signature })
      });
      const j = await rep.json().catch(() => ({}));
      if(j.result === "ok" || j.result === "not found"){ await d.ref.delete(); effaces++; }
      else{ rates++; console.log(`  ✗ ${r.publicId} : ${JSON.stringify(j).slice(0, 200)}`); }
    }catch(e){ rates++; console.log(`  ✗ ${r.publicId} : ${e.message}`); }
  }
  console.log(`• Reels effacés chez Cloudinary : ${effaces}${rates ? ` · ${rates} à réessayer au prochain passage` : ""}`);
}
