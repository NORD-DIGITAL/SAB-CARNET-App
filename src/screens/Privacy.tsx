import type { ReactNode } from 'react'

export const PRIVACY_VERSION = '2026-10-03'
const CONTACT = 'gosamsan1122@gmail.com'

function S({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-ink">{n}. {title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </section>
  )
}

/** Politique de confidentialité de SAB-CARNET (texte standard, en français). */
export function PrivacyText() {
  return (
    <div className="space-y-5 text-ink">
      <p className="text-sm text-ink-muted">Dernière mise à jour : 3 octobre 2026</p>
      <p className="text-sm leading-relaxed text-ink-soft">
        SAB-CARNET est une application de suivi des dépenses, du petit commerce et des dettes éditée par <b>NORD DIGITAL</b> (Madagascar).
        Cette politique explique quelles données nous collectons, pourquoi, comment elles sont protégées et quels sont tes droits.
        En créant un compte, tu acceptes cette politique.
      </p>
      <S n={1} title="Données collectées">
        <p><b>Compte :</b> nom complet, adresse email, numéro de téléphone, mot de passe (enregistré chiffré, nous ne le voyons jamais).</p>
                <p><b>Données du carnet :</b> dépenses, retraits, virements, cartes bancaires (nom et 4 derniers chiffres seulement), produits, ventes, échéanciers, prêts et emprunts, et les noms et téléphones des personnes que tu y notes (clients, prêteurs).</p>
                <p><b>Abonnement :</b> Go Codes utilisés et date de fin d'accès. <b>Messages :</b> remarques que tu envoies à l'équipe.</p>
        <p>Nous ne collectons <b>pas</b> ta position, le répertoire de ton téléphone, ni tes numéros de carte complets ou tes codes Mobile Money et bancaires. L'empreinte ou le visage restent sur ton téléphone : l'application reçoit seulement « reconnu / non reconnu ».</p>
      </S>
      <S n={2} title="Pourquoi nous les utilisons">
        <p>Uniquement pour faire fonctionner l'application : afficher tes soldes, tes ventes et tes dettes, gérer ton abonnement, répondre à tes remarques et t'envoyer des informations sur le service.</p>
                <p><b>Nous ne vendons pas tes données</b> et ne faisons pas de publicité ciblée.</p>
      </S>
      <S n={3} title="Qui peut voir tes données">
        <p><b>Toi seul(e)</b> : ton carnet n'est partagé avec personne.</p>
        <p><b>L'administrateur NORD DIGITAL</b> voit seulement ce qui est nécessaire au service : nom, email, téléphone, dates d'inscription et de connexion, abonnement et remarques envoyées.</p>
        <p><b>Hébergeur :</b> les données sont stockées chez Supabase (serveurs sécurisés, connexion chiffrée HTTPS). Aucune autre entreprise n'y a accès, sauf obligation légale.</p>
      </S>
      <S n={4} title="Sécurité">
        <p>Connexion chiffrée, accès aux données limité par des règles de sécurité (chaque compte ne voit que ses propres données), déconnexion automatique à 8 h et 18 h, connexion par empreinte ou visage possible.</p>
        <p>Garde ton mot de passe pour toi. Les rappels WhatsApp ne partent que si tu touches le bouton : l'application n'envoie rien toute seule.</p>
      </S>
      <S n={5} title="Durée de conservation">
        <p>Tes données sont conservées tant que ton compte existe. Si tu supprimes une opération, elle est supprimée définitivement. Un compte inactif ou sans abonnement depuis plus de 24 mois peut être supprimé après un message de prévenance.</p>
      </S>
      <S n={6} title="Tes droits">
        <p>Tu peux à tout moment : <b>consulter et corriger</b> ton profil, <b>exporter</b> tes opérations (Historique › Exporter, fichier Excel), <b>effacer</b> n'importe quelle opération, et demander la <b>suppression complète de ton compte</b> en écrivant à {CONTACT}.</p>
        <p>Ces droits sont prévus par la loi malgache n° 2014-038 sur la protection des données à caractère personnel.</p>
      </S>
      <S n={7} title="Personnes que tu notes">
        <p>Les noms et téléphones de tes clients, prêteurs ou partenaires servent uniquement à suivre ce qu'ils te doivent ou ce que tu leur dois. Préviens-les si tu leur envoies des rappels. Tu peux corriger ou supprimer ces informations à tout moment.</p>
      </S>
      <S n={8} title="Modifications et contact">
        <p>Nous pouvons mettre à jour cette politique ; tu en seras informé dans la Boîte de réception de l'application.</p>
        <p>Questions : <b>{CONTACT}</b> ou le bouton « Remarque / suggestion ». — NORD DIGITAL, Madagascar.</p>
      </S>
    </div>
  )
}

export function PrivacyPage() {
  return <div className="px-5 pb-10 pt-2"><PrivacyText /></div>
}
