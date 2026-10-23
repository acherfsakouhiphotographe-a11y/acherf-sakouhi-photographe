/* =====================================================================
   ACHREF SAKOUHI — Envoi des notifications push
   ---------------------------------------------------------------------
   Tourne SUR GITHUB ACTIONS (gratuit pour un dépôt public), jamais dans
   le navigateur : il utilise la clé de service Firebase, qui doit rester
   secrète (secret GitHub FIREBASE_SERVICE_ACCOUNT).

   À chaque passage (toutes les 5 à 15 minutes, ou tout de suite si Achref
   a enregistré un jeton GitHub dans l'app) :
     1. la veille de l'expiration d'un lien WeTransfer non téléchargé,
        il crée un rappel pour le client (une seule fois) ;
     2. il envoie toutes les notifications « en attente » aux téléphones
        du destinataire, dans sa langue (français ou arabe) ;
     3. il supprime les jetons des téléphones qui n'existent plus.

   Test à blanc (n'envoie rien) :  DRY_RUN=1 node envoyer-notifications.mjs
   ===================================================================== */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

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
