import type { Language } from '@/lib/translations'

// Legal data that must not be invented. Every value still wrapped in
// "[PENDIENTE: …]" is rendered highlighted on /privacy and /terms until the
// operator fills it in. Grep for PENDIENTE before considering the pages final.
export const LEGAL_INFO = {
  // Personal address for now; replace with a company one once it exists.
  contactEmail: 'lesteban.dev@gmail.com',
  jurisdiction: '[PENDIENTE: país y ciudad de jurisdicción]',
  refundPolicy: '[PENDIENTE: política de reembolsos]',
  lastUpdated: '2026-11-12',
}

export const PENDING_MARKER = /(\[PENDIENTE:[^\]]*\])/

// A block is either a paragraph or a bullet list.
export type LegalBlock = string | string[]

export type LegalSection = {
  heading: string
  blocks: LegalBlock[]
}

export type LegalDocument = {
  title: string
  lastUpdatedLabel: string
  intro: string
  sections: LegalSection[]
}

export type LegalDocumentKind = 'privacy' | 'terms'

const { contactEmail, jurisdiction, refundPolicy } = LEGAL_INFO

const privacyEn: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdatedLabel: 'Last updated',
  intro:
    'This policy explains what data LESFin stores, why, who processes it, how long it is kept, and how you can export or delete it. LESFin handles personal financial information, so we try to keep this short and specific.',
  sections: [
    {
      heading: 'Who is responsible for your data',
      blocks: [
        `LESFin (www.lesfin.app) is an independent personal finance app run by its developer as an individual, not by a company. For anything related to your data, write to ${contactEmail}.`,
      ],
    },
    {
      heading: 'What we store',
      blocks: [
        [
          'Your Google account: name, email address, profile picture, and the Google account identifier and sign-in tokens that Google returns when you log in. We never see your Google password.',
          'The financial data you enter: accounts (name, type, balances, description, color, icon, and any logo you upload), transactions, transfers, categories, budgets, debts, subscriptions, and recurring expenses. LESFin does not connect to your bank — everything is entered by you or by an AI assistant you connect.',
          'Your preferences: currency, timezone, language, and budget period.',
          'Billing status: your plan and the identifiers, status, and renewal dates of your Pro subscription, as reported by Polar. Card and payment details are handled by Polar and never reach LESFin.',
          'AI assistant access (MCP): the names of the API keys you create, plus hashed versions of those keys and of OAuth tokens, when they were last used, and the results of recent write requests so retries do not create duplicates.',
          'Feedback messages you send from the app.',
          'Session data: a session cookie, plus the IP address and browser user agent associated with each active session.',
          'Website analytics: Vercel Web Analytics records aggregated page views (page, referrer, country, device type) without cookies and without identifying you.',
        ],
      ],
    },
    {
      heading: 'How we use it',
      blocks: [
        [
          'To sign you in and keep your session active.',
          'To show and calculate your balances, budgets, trends, and reports.',
          'To apply the limits of the Free plan and manage the Pro subscription.',
          'To answer support requests and feedback.',
          'To keep the service secure and to understand, in aggregate, which pages are used.',
        ],
        'We do not sell your data, show ads, share your financial data for marketing, or use it to train AI models.',
      ],
    },
    {
      heading: 'Providers that process data on our behalf',
      blocks: [
        [
          'Google — sign-in with your Google account.',
          'Vercel — hosting, website analytics, and storage of uploaded account logos. Uploaded logos are stored at a public, unguessable URL.',
          'Neon — the Postgres database where your data is stored.',
          'Polar — checkout, payments, invoices, and taxes for the Pro plan, acting as merchant of record.',
        ],
        'Each provider only receives what it needs to perform its function and processes it under its own privacy policy.',
      ],
    },
    {
      heading: 'AI assistants connected through MCP',
      blocks: [
        'LESFin lets you connect AI assistants (for example, through the Model Context Protocol) using an API key or an OAuth authorization. A connected assistant can read and modify your financial data through the tools LESFin exposes, exactly as you could from the app.',
        'You decide which assistants to connect. What an assistant does with the data it reads is governed by that assistant provider’s terms and privacy policy, not by LESFin. You can revoke any key or connection at any time from the AI assistant section of the app.',
      ],
    },
    {
      heading: 'How long we keep it',
      blocks: [
        'We keep your data while your account exists. When you ask us to delete your account, we delete your user record and all associated financial data from the production database. Copies may remain in our providers’ backups for a limited time until they are overwritten, and billing records may be kept by Polar or by us when the law requires it.',
        'Expired sessions, OAuth codes, and revoked keys stop working immediately and are cleaned up over time.',
      ],
    },
    {
      heading: 'Your rights: access, export, correction, and deletion',
      blocks: [
        'You can view, edit, and delete most of your data directly in the app. To request a full export of your data, the deletion of your account, or to exercise any other right you have under applicable data protection law, write to ' +
          contactEmail +
          ' from the email address of your account. We will answer within the deadlines set by applicable law.',
      ],
    },
    {
      heading: 'Cookies and local storage',
      blocks: [
        'LESFin uses a strictly necessary session cookie to keep you signed in, and stores your language preference in your browser’s local storage. We do not use advertising or cross-site tracking cookies.',
      ],
    },
    {
      heading: 'Security',
      blocks: [
        'Traffic is encrypted with HTTPS, API keys and OAuth tokens are stored as hashes, and every request is checked against your session so you only ever access your own data. No system is completely secure; if we learn of an incident affecting your data, we will notify you.',
      ],
    },
    {
      heading: 'Age',
      blocks: [
        'LESFin is intended for adults. Do not use it if you are under 18.',
      ],
    },
    {
      heading: 'Changes to this policy',
      blocks: [
        'If we change this policy, we will update the date at the top of this page. If the change is significant, we will also let you know in the app or by email before it takes effect.',
      ],
    },
    {
      heading: 'Contact',
      blocks: [`Questions about this policy: ${contactEmail}.`],
    },
  ],
}

const privacyEs: LegalDocument = {
  title: 'Política de privacidad',
  lastUpdatedLabel: 'Última actualización',
  intro:
    'Esta política explica qué datos guarda LESFin, para qué, quién los procesa, cuánto tiempo se conservan y cómo puedes exportarlos o borrarlos. LESFin maneja información financiera personal, así que intentamos que sea corta y concreta.',
  sections: [
    {
      heading: 'Responsable de tus datos',
      blocks: [
        `LESFin (www.lesfin.app) es una app independiente de finanzas personales operada por su desarrollador como persona natural, no por una empresa. Para cualquier tema relacionado con tus datos, escribe a ${contactEmail}.`,
      ],
    },
    {
      heading: 'Qué datos guardamos',
      blocks: [
        [
          'Tu cuenta de Google: nombre, correo, foto de perfil, y el identificador de la cuenta y los tokens de inicio de sesión que Google devuelve al entrar. Nunca vemos tu contraseña de Google.',
          'Los datos financieros que ingresas: cuentas (nombre, tipo, saldos, descripción, color, ícono y el logo que subas), transacciones, transferencias, categorías, presupuestos, deudas, suscripciones y gastos recurrentes. LESFin no se conecta a tu banco: todo lo ingresas tú o un asistente de IA que conectes.',
          'Tus preferencias: moneda, zona horaria, idioma y periodo de presupuesto.',
          'Estado de facturación: tu plan y los identificadores, estado y fechas de renovación de tu suscripción Pro, según los reporta Polar. Los datos de tarjeta y pago los maneja Polar y nunca llegan a LESFin.',
          'Acceso de asistentes de IA (MCP): los nombres de las API keys que crees, versiones hasheadas de esas keys y de los tokens OAuth, cuándo se usaron por última vez y el resultado de escrituras recientes para que los reintentos no creen duplicados.',
          'Los mensajes de feedback que envías desde la app.',
          'Datos de sesión: una cookie de sesión, y la dirección IP y el user agent del navegador asociados a cada sesión activa.',
          'Analítica del sitio: Vercel Web Analytics registra visitas agregadas (página, referente, país, tipo de dispositivo) sin cookies y sin identificarte.',
        ],
      ],
    },
    {
      heading: 'Para qué los usamos',
      blocks: [
        [
          'Para iniciar tu sesión y mantenerla activa.',
          'Para mostrar y calcular tus saldos, presupuestos, tendencias y reportes.',
          'Para aplicar los límites del plan Free y gestionar la suscripción Pro.',
          'Para responder solicitudes de soporte y feedback.',
          'Para mantener el servicio seguro y entender, de forma agregada, qué páginas se usan.',
        ],
        'No vendemos tus datos, no mostramos publicidad, no compartimos tus datos financieros con fines de marketing y no los usamos para entrenar modelos de IA.',
      ],
    },
    {
      heading: 'Proveedores que procesan datos por nosotros',
      blocks: [
        [
          'Google: inicio de sesión con tu cuenta de Google.',
          'Vercel: hosting, analítica del sitio y almacenamiento de los logos de cuentas que subas. Los logos quedan en una URL pública y difícil de adivinar.',
          'Neon: la base de datos Postgres donde se guardan tus datos.',
          'Polar: checkout, pagos, facturas e impuestos del plan Pro, como merchant of record.',
        ],
        'Cada proveedor recibe solo lo que necesita para cumplir su función y lo procesa según su propia política de privacidad.',
      ],
    },
    {
      heading: 'Asistentes de IA conectados por MCP',
      blocks: [
        'LESFin te permite conectar asistentes de IA (por ejemplo, mediante el Model Context Protocol) con una API key o una autorización OAuth. Un asistente conectado puede leer y modificar tus datos financieros a través de las herramientas que expone LESFin, igual que tú desde la app.',
        'Tú decides qué asistentes conectar. Lo que un asistente haga con los datos que lee se rige por los términos y la política de privacidad de su proveedor, no por LESFin. Puedes revocar cualquier key o conexión en cualquier momento desde la sección de asistente de IA de la app.',
      ],
    },
    {
      heading: 'Cuánto tiempo los conservamos',
      blocks: [
        'Conservamos tus datos mientras tu cuenta exista. Cuando pides borrar tu cuenta, eliminamos tu usuario y todos sus datos financieros de la base de datos de producción. Pueden quedar copias en los backups de nuestros proveedores por un tiempo limitado hasta que se sobrescriban, y Polar o nosotros podemos conservar registros de facturación cuando la ley lo exija.',
        'Las sesiones vencidas, los códigos OAuth y las keys revocadas dejan de funcionar de inmediato y se limpian con el tiempo.',
      ],
    },
    {
      heading: 'Tus derechos: acceso, exportación, corrección y borrado',
      blocks: [
        'Puedes ver, editar y borrar la mayoría de tus datos directamente en la app. Para pedir una exportación completa de tus datos, el borrado de tu cuenta o ejercer cualquier otro derecho que te dé la ley de protección de datos aplicable, escribe a ' +
          contactEmail +
          ' desde el correo de tu cuenta. Responderemos dentro de los plazos que fije la ley aplicable.',
      ],
    },
    {
      heading: 'Cookies y almacenamiento local',
      blocks: [
        'LESFin usa una cookie de sesión estrictamente necesaria para mantenerte conectado, y guarda tu preferencia de idioma en el almacenamiento local del navegador. No usamos cookies de publicidad ni de rastreo entre sitios.',
      ],
    },
    {
      heading: 'Seguridad',
      blocks: [
        'El tráfico va cifrado con HTTPS, las API keys y los tokens OAuth se guardan como hashes, y cada solicitud se valida contra tu sesión para que solo accedas a tus propios datos. Ningún sistema es completamente seguro; si nos enteramos de un incidente que afecte tus datos, te avisaremos.',
      ],
    },
    {
      heading: 'Edad',
      blocks: [
        'LESFin está pensado para adultos. No lo uses si eres menor de 18 años.',
      ],
    },
    {
      heading: 'Cambios a esta política',
      blocks: [
        'Si cambiamos esta política, actualizaremos la fecha al inicio de esta página. Si el cambio es importante, también te avisaremos en la app o por correo antes de que entre en vigor.',
      ],
    },
    {
      heading: 'Contacto',
      blocks: [`Preguntas sobre esta política: ${contactEmail}.`],
    },
  ],
}

const termsEn: LegalDocument = {
  title: 'Terms of Service',
  lastUpdatedLabel: 'Last updated',
  intro:
    'These terms govern your use of LESFin. By creating an account or using the app, you agree to them. If you do not agree, do not use LESFin.',
  sections: [
    {
      heading: 'Who operates LESFin',
      blocks: [
        `LESFin (www.lesfin.app) is an independent project run by its developer as an individual, not by a company. Contact: ${contactEmail}.`,
      ],
    },
    {
      heading: 'The service',
      blocks: [
        'LESFin is a tool to record and review your personal finances: accounts, transactions, transfers, budgets, debts, and subscriptions. It does not connect to banks, move money, or hold funds — balances only reflect what you or an assistant you connect enter.',
        'LESFin is for personal use. You need a Google account to sign in, and you are responsible for activity under your account, including the API keys and AI assistants you connect.',
      ],
    },
    {
      heading: 'Plans',
      blocks: [
        [
          'Free: free of charge, with no time limit and with the usage limits described on the pricing page.',
          'Pro: a monthly subscription that removes those limits, at the price shown on the pricing page. Payments are processed by Polar as merchant of record, which may add applicable taxes. The subscription renews automatically each month until you cancel it.',
        ],
        'We may change plans, limits, or prices. Price changes for an active Pro subscription apply from the next billing period and will be announced in advance.',
      ],
    },
    {
      heading: 'Cancellation and refunds',
      blocks: [
        'You can cancel Pro at any time from the Plan section of the app or the billing portal. Pro stays active until the end of the period you already paid for, and then your account returns to the Free plan. Cancelling never deletes your data; items above the Free limits are kept but may become read-only.',
        `Refunds: ${refundPolicy}.`,
      ],
    },
    {
      heading: 'Your data',
      blocks: [
        'The data you enter is yours. You grant us only the permission needed to store and process it to run the service, as described in the Privacy Policy. You can request an export or the deletion of your account at any time.',
      ],
    },
    {
      heading: 'Acceptable use',
      blocks: [
        [
          'Do not try to access other users’ data or bypass authentication, plan limits, or rate limits.',
          'Do not use LESFin to store illegal content or to launder money or commit fraud.',
          'Do not overload, attack, or reverse engineer the service, or resell it.',
        ],
      ],
    },
    {
      heading: 'Not financial advice',
      blocks: [
        'LESFin shows calculations, summaries, and trends based on the data you enter. None of it is financial, investment, tax, or legal advice. Decisions you make based on the app are your own responsibility; consult a qualified professional when you need advice.',
      ],
    },
    {
      heading: 'Availability and changes to the service',
      blocks: [
        'LESFin is provided "as is" and "as available". We work to keep it running and your data safe, but we do not guarantee it will be uninterrupted or error-free. We may change or discontinue features; if we shut down the service, we will give reasonable notice so you can export your data.',
      ],
    },
    {
      heading: 'Limitation of liability',
      blocks: [
        'To the maximum extent permitted by law, the operator of LESFin is not liable for indirect, incidental, or consequential damages, lost profits, or losses resulting from decisions made using the app, from data you entered incorrectly, or from third-party services such as connected AI assistants. Our total liability for any claim is limited to the amount you paid for LESFin in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited by law.',
      ],
    },
    {
      heading: 'Suspension and termination',
      blocks: [
        'You can stop using LESFin and request the deletion of your account at any time. We may suspend or close accounts that violate these terms, and we will tell you why unless the law prevents it.',
      ],
    },
    {
      heading: 'Governing law',
      blocks: [
        `These terms are governed by the laws of ${jurisdiction}. Any dispute will be handled by the competent courts of ${jurisdiction}, without prejudice to any consumer rights that the law of your country of residence grants you.`,
      ],
    },
    {
      heading: 'Changes to these terms',
      blocks: [
        'If we change these terms, we will update the date at the top of this page. If the change is significant, we will notify you in the app or by email before it takes effect. Continuing to use LESFin after that means you accept the new terms.',
      ],
    },
    {
      heading: 'Contact',
      blocks: [`Questions about these terms: ${contactEmail}.`],
    },
  ],
}

const termsEs: LegalDocument = {
  title: 'Términos del servicio',
  lastUpdatedLabel: 'Última actualización',
  intro:
    'Estos términos regulan el uso de LESFin. Al crear una cuenta o usar la app, los aceptas. Si no estás de acuerdo, no uses LESFin.',
  sections: [
    {
      heading: 'Quién opera LESFin',
      blocks: [
        `LESFin (www.lesfin.app) es un proyecto independiente operado por su desarrollador como persona natural, no por una empresa. Contacto: ${contactEmail}.`,
      ],
    },
    {
      heading: 'El servicio',
      blocks: [
        'LESFin es una herramienta para registrar y revisar tus finanzas personales: cuentas, transacciones, transferencias, presupuestos, deudas y suscripciones. No se conecta a bancos, no mueve dinero ni custodia fondos: los saldos solo reflejan lo que tú o un asistente que conectes ingresan.',
        'LESFin es para uso personal. Necesitas una cuenta de Google para entrar, y eres responsable de la actividad en tu cuenta, incluidas las API keys y los asistentes de IA que conectes.',
      ],
    },
    {
      heading: 'Planes',
      blocks: [
        [
          'Free: gratis, sin límite de tiempo y con los límites de uso descritos en la página de precios.',
          'Pro: una suscripción mensual que elimina esos límites, al precio que aparece en la página de precios. Los pagos los procesa Polar como merchant of record, que puede añadir los impuestos aplicables. La suscripción se renueva automáticamente cada mes hasta que la canceles.',
        ],
        'Podemos cambiar planes, límites o precios. Los cambios de precio de una suscripción Pro activa aplican desde el siguiente periodo de facturación y se anuncian con anticipación.',
      ],
    },
    {
      heading: 'Cancelación y reembolsos',
      blocks: [
        'Puedes cancelar Pro en cualquier momento desde la sección Plan de la app o desde el portal de facturación. Pro sigue activo hasta el final del periodo que ya pagaste y luego tu cuenta vuelve al plan Free. Cancelar nunca borra tus datos; lo que supere los límites de Free se conserva, pero puede quedar en solo lectura.',
        `Reembolsos: ${refundPolicy}.`,
      ],
    },
    {
      heading: 'Tus datos',
      blocks: [
        'Los datos que ingresas son tuyos. Solo nos das el permiso necesario para guardarlos y procesarlos para operar el servicio, como se describe en la Política de privacidad. Puedes pedir una exportación o el borrado de tu cuenta en cualquier momento.',
      ],
    },
    {
      heading: 'Uso aceptable',
      blocks: [
        [
          'No intentes acceder a datos de otros usuarios ni saltarte la autenticación, los límites del plan o los límites de uso.',
          'No uses LESFin para guardar contenido ilegal, lavar dinero ni cometer fraude.',
          'No sobrecargues, ataques ni hagas ingeniería inversa del servicio, ni lo revendas.',
        ],
      ],
    },
    {
      heading: 'No es asesoría financiera',
      blocks: [
        'LESFin muestra cálculos, resúmenes y tendencias con base en los datos que ingresas. Nada de eso es asesoría financiera, de inversión, tributaria ni legal. Las decisiones que tomes con base en la app son tu responsabilidad; consulta a un profesional cuando necesites asesoría.',
      ],
    },
    {
      heading: 'Disponibilidad y cambios del servicio',
      blocks: [
        'LESFin se ofrece "tal cual" y "según disponibilidad". Trabajamos para mantenerlo funcionando y tus datos seguros, pero no garantizamos que funcione sin interrupciones ni errores. Podemos cambiar o retirar funciones; si cerramos el servicio, avisaremos con tiempo razonable para que puedas exportar tus datos.',
      ],
    },
    {
      heading: 'Limitación de responsabilidad',
      blocks: [
        'En la máxima medida permitida por la ley, el operador de LESFin no responde por daños indirectos, incidentales o consecuentes, lucro cesante, ni por pérdidas derivadas de decisiones tomadas con la app, de datos ingresados incorrectamente o de servicios de terceros como asistentes de IA conectados. Nuestra responsabilidad total por cualquier reclamo se limita a lo que hayas pagado por LESFin en los 12 meses anteriores al reclamo. Nada en estos términos limita la responsabilidad que la ley no permita limitar.',
      ],
    },
    {
      heading: 'Suspensión y terminación',
      blocks: [
        'Puedes dejar de usar LESFin y pedir el borrado de tu cuenta cuando quieras. Podemos suspender o cerrar cuentas que incumplan estos términos, y te diremos el motivo salvo que la ley lo impida.',
      ],
    },
    {
      heading: 'Ley aplicable',
      blocks: [
        `Estos términos se rigen por las leyes de ${jurisdiction}. Cualquier disputa la resolverán los jueces competentes de ${jurisdiction}, sin perjuicio de los derechos de consumidor que te otorgue la ley de tu país de residencia.`,
      ],
    },
    {
      heading: 'Cambios a estos términos',
      blocks: [
        'Si cambiamos estos términos, actualizaremos la fecha al inicio de esta página. Si el cambio es importante, te avisaremos en la app o por correo antes de que entre en vigor. Seguir usando LESFin después de eso implica que aceptas los nuevos términos.',
      ],
    },
    {
      heading: 'Contacto',
      blocks: [`Preguntas sobre estos términos: ${contactEmail}.`],
    },
  ],
}

export const legalDocuments: Record<
  LegalDocumentKind,
  Record<Language, LegalDocument>
> = {
  privacy: { en: privacyEn, es: privacyEs },
  terms: { en: termsEn, es: termsEs },
}
