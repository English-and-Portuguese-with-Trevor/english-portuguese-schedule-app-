// Site text in each site language (see SITE_LANGUAGES in src/lib/prefs.ts),
// keyed by the English original. src/i18n/i18n.test.ts fails if a key is
// missing. Trevor's admin pages stay in English.
export const STRINGS = {
  es: {
    "English & Portuguese with Trevor, main website":
      "English & Portuguese with Trevor, sitio principal",
    "{day} at {time}": "{day} a las {time}",
    "Hi, {name}": "Hola, {name}",
    Account: "Cuenta",
    Home: "Inicio",
    Lessons: "Lecciones",
    Flashcards: "Flashcards",
    Activities: "Actividades",
    "Schedule a class": "Reservar una clase",
    Learn: "Aprender",
    "Daily puzzles": "Juegos diarios",
    "Get the app": "Descargar la app",
    "App start": "Inicio de la app",
    Settings: "Configuración",
    "Log out": "Cerrar sesión",
    "Loading…": "Cargando…",
    "My bookings": "Mis reservas",
    "You have no upcoming classes yet.": "Todavía no tienes clases próximas.",
    "Reschedule request": "Solicitud de cambio de horario",
    "English / Portuguese class": "Clase de inglés / portugués",
    "Moving from {time}": "Se mueve desde el {time}",
    "Reschedule requested": "Cambio de horario solicitado",
    Confirmed: "Confirmada",
    "Waiting for approval": "Esperando aprobación",
    "Join Meet": "Unirse a Meet",
    Reschedule: "Cambiar horario",
    Cancel: "Cancelar",
    "Pick a new time": "Elige un nuevo horario",
    "Book a class": "Reservar una clase",
    "Moving your class on {time}. It stays booked until Trevor approves the new time.":
      "Cambiando tu clase del {time}. Sigue reservada hasta que Trevor apruebe el nuevo horario.",
    Stop: "Dejar",
    "Request sent — Trevor needs to approve it.":
      "Solicitud enviada: Trevor tiene que aprobarla.",
    "Class booked.": "Clase reservada.",
    "Pick the class to move first.":
      "Primero elige la clase que quieres mover.",
    "Reschedule request sent — Trevor needs to approve it.":
      "Solicitud de cambio enviada: Trevor tiene que aprobarla.",
    "Booking canceled.": "Reserva cancelada.",
    "your local time": "tu hora local",
    "Times shown in {zone}.": "Horarios en {zone}.",
    "{n} open": "{n} libres",
    "no availability": "sin disponibilidad",
    Booked: "Reservado",
    "No availability on this day.": "No hay disponibilidad este día.",
    "{time}, needs approval": "{time}, necesita aprobación",
    "Dashed times are less than 72 hours away. You can still request them, but Trevor needs to approve them first.":
      "Los horarios con borde punteado son en menos de 72 horas. Puedes solicitarlos, pero Trevor tiene que aprobarlos primero.",
    "Request this new time?": "¿Solicitar este nuevo horario?",
    "Request this class?": "¿Solicitar esta clase?",
    "Book this class?": "¿Reservar esta clase?",
    "Your class on {time} stays booked until Trevor approves the change.":
      "Tu clase del {time} sigue reservada hasta que Trevor apruebe el cambio.",
    "It's less than 72 hours away, so it stays pending until Trevor approves it.":
      "Es en menos de 72 horas, así que queda pendiente hasta que Trevor la apruebe.",
    "It's confirmed as soon as you book.": "Se confirma en cuanto reservas.",
    "Are you looking for English or Portuguese lessons?":
      "¿Buscas clases de inglés o de portugués?",
    English: "Inglés",
    Portuguese: "Portugués",
    "WhatsApp number": "Número de WhatsApp",
    "(optional)": "(opcional)",
    "Include your country code.": "Incluye el código de tu país.",
    "That doesn't look like a phone number.":
      "Eso no parece un número de teléfono.",
    Back: "Volver",
    "Sending…": "Enviando…",
    Request: "Solicitar",
    Book: "Reservar",
    "Withdraw this request?": "¿Retirar esta solicitud?",
    "Cancel this class?": "¿Cancelar esta clase?",
    "This class starts in less than {hours} hours, so it still counts as a class.":
      "Esta clase empieza en menos de {hours} horas, así que contará como clase igualmente.",
    "The time will open up for other students.":
      "El horario quedará libre para otros alumnos.",
    "Keep it": "Mantenerla",
    "Canceling…": "Cancelando…",
    "Withdraw request": "Retirar solicitud",
    "Cancel anyway": "Cancelar de todos modos",
    "Cancel class": "Cancelar clase",
    "Lifetime lesson access": "Acceso a las lecciones de por vida",
    "Every lesson on the lessons site is yours for good. Obrigado for learning with Trevor!":
      "Todas las lecciones del sitio son tuyas para siempre. ¡Obrigado por aprender con Trevor!",
    "You qualify for lifetime lesson access!":
      "¡Tienes derecho al acceso de por vida a las lecciones!",
    "You've finished {sets} sets of {size} classes. Trevor will set up lifetime access to every lesson for you.":
      "Terminaste {sets} paquetes de {size} clases. Trevor te dará acceso de por vida a todas las lecciones.",
    "Toward lifetime lesson access": "Hacia el acceso de por vida",
    "Finish {sets} sets of {size} classes to qualify for lifetime access to every lesson.":
      "Termina {sets} paquetes de {size} clases para tener acceso de por vida a todas las lecciones.",
    "Classes toward lifetime lesson access":
      "Clases hacia el acceso de por vida",
    "{done} of {needed} classes · {setsDone} of {sets} sets":
      "{done} de {needed} clases · {setsDone} de {sets} paquetes",
    Preferences: "Preferencias",
    "These follow you to the home, lessons and flashcards sites too.":
      "Se aplican también en el inicio, las lecciones y las flashcards.",
    "Site language": "Idioma del sitio",
    "Dark mode": "Modo oscuro",
    "I'm learning": "Estoy aprendiendo",
    "Choose…": "Elegir…",
    "The same account works on the lessons, flashcards and schedule sites.":
      "La misma cuenta sirve para las lecciones, las flashcards y la agenda.",
    Name: "Nombre",
    Email: "Correo electrónico",
    "Lessons & subscription": "Lecciones y suscripción",
    "Opening…": "Abriendo…",
    "Manage subscription": "Gestionar suscripción",
    "Delete account": "Eliminar cuenta",
    "Change your card, see receipts, or cancel. Handled securely by Stripe.":
      "Cambia tu tarjeta, consulta tus recibos o cancela. Gestionado de forma segura por Stripe.",
    "Billing is unavailable right now. Please try again.":
      "La facturación no está disponible ahora. Inténtalo de nuevo.",
    "This deletes your account on every Trevor site.":
      "Esto elimina tu cuenta en todos los sitios de Trevor.",
    "Admin accounts can't be deleted from the app, since that would remove the account that manages the schedule, lessons and instructor decks.":
      "Las cuentas de administrador no se pueden eliminar desde la app, porque se borraría la cuenta que gestiona la agenda, las lecciones y los mazos del profesor.",
    "This permanently deletes your account, your class history, your flashcard decks and study progress, and cancels any lesson subscription. Cancel upcoming classes first. This can't be undone.":
      "Esto elimina para siempre tu cuenta, tu historial de clases, tus mazos de flashcards y tu progreso, y cancela cualquier suscripción a las lecciones. Cancela primero tus próximas clases. No se puede deshacer.",
    "Type DELETE to confirm": "Escribe DELETE para confirmar",
    "Keep my account": "Conservar mi cuenta",
    "Deleting…": "Eliminando…",
    "Permanently delete my account": "Eliminar mi cuenta para siempre",
    "Admin: every lesson is open.":
      "Admin: todas las lecciones están abiertas.",
    "Lifetime access: every lesson is yours for good.":
      "Acceso de por vida: todas las lecciones son tuyas para siempre.",
    "Student access from Trevor: every lesson is included with your classes.":
      "Acceso de alumno de Trevor: todas las lecciones están incluidas con tus clases.",
    "Subscriber. Your last payment didn't go through; please update your card.":
      "Suscriptor. Tu último pago no se realizó; actualiza tu tarjeta.",
    "Subscriber. Canceled; your lessons stay open until {date}.":
      "Suscriptor. Cancelada; tus lecciones siguen abiertas hasta el {date}.",
    "Subscriber: every Portuguese lesson is open. Renews on {date}.":
      "Suscriptor: todas las lecciones de portugués están abiertas. Se renueva el {date}.",
    "Subscriber: every Portuguese lesson is open.":
      "Suscriptor: todas las lecciones de portugués están abiertas.",
    "Free lessons: lessons 1–4 are open. Subscribe on the lessons site, or ask Trevor for student access.":
      "Lecciones gratis: las lecciones 1–4 están abiertas. Suscríbete en el sitio de lecciones o pídele a Trevor acceso de alumno.",
    "That time overlaps an existing class. Please pick another time.":
      "Ese horario se superpone con otra clase. Elige otro.",
    "Something went wrong. Please try again.": "Algo salió mal. Inténtalo de nuevo.",
    "That time overlaps your current class. Pick a time that doesn't overlap it.":
      "Ese horario se superpone con tu clase actual. Elige un horario que no se superponga con ella.",
    "Classes can be booked up to 60 days ahead.":
      "Las clases se pueden reservar con hasta 60 días de anticipación.",
    "You already have 10 upcoming classes. Cancel one to book another.":
      "Ya tienes 10 clases próximas. Cancela una para reservar otra.",
    Close: "Cerrar",
    Welcome: "Bienvenido",
    "Log in with your Google account or your email and password.":
      "Inicia sesión con tu cuenta de Google o con tu correo y contraseña.",
    "Redirecting...": "Redirigiendo...",
    "Log in with Google": "Iniciar sesión con Google",
    "That time was just taken. Please pick another.":
      "Alguien acaba de reservar ese horario. Elige otro.",
    "Please choose English or Portuguese.": "Elige inglés o portugués.",
    "Please enter a valid WhatsApp number.":
      "Escribe un número de WhatsApp válido.",
    "Booking not found.": "No se encontró la reserva.",
    "Classes must be requested at least 72 hours in advance.":
      "Las clases se deben solicitar con al menos 72 horas de antelación.",
    "Only a confirmed lesson can be rescheduled.":
      "Solo se puede cambiar el horario de una clase confirmada.",
    "Sessions must be requested at least 72 hours in advance.":
      "Las clases se deben solicitar con al menos 72 horas de antelación.",
    "That class is no longer available.": "Esa clase ya no está disponible.",
    "That slot is no longer available.": "Ese horario ya no está disponible.",
    "That time has already passed.": "Ese horario ya pasó.",
    "This lesson has already started.": "Esta clase ya empezó.",
    "You already asked to reschedule this lesson.":
      "Ya pediste cambiar el horario de esta clase.",
    "Admin accounts can't be self-deleted from the app.":
      "Las cuentas de administrador no se pueden eliminar desde la app.",
    "You have an upcoming class booked. Cancel it in the schedule app first, then delete your account.":
      "Tienes una clase reservada próximamente. Cancélala primero en la agenda y después elimina tu cuenta.",
    "Please log in first.": "Primero inicia sesión.",
    "Something went wrong with billing. Please try again.":
      "Algo salió mal con la facturación. Inténtalo de nuevo.",
    "Page not found":
      "Página no encontrada",
    "This page doesn't exist or has moved.":
      "Esta página no existe o se ha movido.",
    "Something went wrong":
      "Algo salió mal",
    "Please try again in a moment. If it keeps happening, let Trevor know.":
      "Inténtalo de nuevo en un momento. Si sigue pasando, avísale a Trevor.",
    "We're updating the site":
      "Estamos actualizando el sitio",
    "Scheduling will be back in a few minutes. Your bookings are safe.":
      "La agenda volverá en unos minutos. Tus reservas están a salvo.",
    "Try again":
      "Intentar de nuevo",
    "Go to the home page":
      "Ir a la página de inicio",
  },
  pt: {
    "English & Portuguese with Trevor, main website":
      "English & Portuguese with Trevor, site principal",
    "{day} at {time}": "{day} às {time}",
    "Hi, {name}": "Olá, {name}",
    Account: "Conta",
    Home: "Início",
    Lessons: "Aulas",
    Flashcards: "Flashcards",
    Activities: "Atividades",
    "Schedule a class": "Agendar uma aula",
    Learn: "Aprender",
    "Daily puzzles": "Desafios diários",
    "Get the app": "Baixar o app",
    "App start": "Início do app",
    Settings: "Configurações",
    "Log out": "Sair",
    "Loading…": "Carregando…",
    "My bookings": "Minhas aulas agendadas",
    "You have no upcoming classes yet.": "Você ainda não tem aulas agendadas.",
    "Reschedule request": "Pedido de remarcação",
    "English / Portuguese class": "Aula de inglês / português",
    "Moving from {time}": "Mudando de {time}",
    "Reschedule requested": "Remarcação solicitada",
    Confirmed: "Confirmada",
    "Waiting for approval": "Aguardando aprovação",
    "Join Meet": "Entrar no Meet",
    Reschedule: "Remarcar",
    Cancel: "Cancelar",
    "Pick a new time": "Escolha um novo horário",
    "Book a class": "Agendar uma aula",
    "Moving your class on {time}. It stays booked until Trevor approves the new time.":
      "Remarcando sua aula de {time}. Ela continua agendada até o Trevor aprovar o novo horário.",
    Stop: "Parar",
    "Request sent — Trevor needs to approve it.":
      "Pedido enviado: o Trevor precisa aprovar.",
    "Class booked.": "Aula agendada.",
    "Pick the class to move first.": "Primeiro escolha a aula que quer mudar.",
    "Reschedule request sent — Trevor needs to approve it.":
      "Pedido de remarcação enviado: o Trevor precisa aprovar.",
    "Booking canceled.": "Agendamento cancelado.",
    "your local time": "seu horário local",
    "Times shown in {zone}.": "Horários em {zone}.",
    "{n} open": "{n} livres",
    "no availability": "sem horários",
    Booked: "Agendado",
    "No availability on this day.": "Não há horários neste dia.",
    "{time}, needs approval": "{time}, precisa de aprovação",
    "Dashed times are less than 72 hours away. You can still request them, but Trevor needs to approve them first.":
      "Os horários tracejados são daqui a menos de 72 horas. Você ainda pode pedir, mas o Trevor precisa aprovar antes.",
    "Request this new time?": "Pedir este novo horário?",
    "Request this class?": "Pedir esta aula?",
    "Book this class?": "Agendar esta aula?",
    "Your class on {time} stays booked until Trevor approves the change.":
      "Sua aula de {time} continua agendada até o Trevor aprovar a mudança.",
    "It's less than 72 hours away, so it stays pending until Trevor approves it.":
      "É daqui a menos de 72 horas, então fica pendente até o Trevor aprovar.",
    "It's confirmed as soon as you book.":
      "Fica confirmada assim que você agenda.",
    "Are you looking for English or Portuguese lessons?":
      "Você procura aulas de inglês ou de português?",
    English: "Inglês",
    Portuguese: "Português",
    "WhatsApp number": "Número de WhatsApp",
    "(optional)": "(opcional)",
    "Include your country code.": "Inclua o código do país.",
    "That doesn't look like a phone number.":
      "Isso não parece um número de telefone.",
    Back: "Voltar",
    "Sending…": "Enviando…",
    Request: "Pedir",
    Book: "Agendar",
    "Withdraw this request?": "Retirar este pedido?",
    "Cancel this class?": "Cancelar esta aula?",
    "This class starts in less than {hours} hours, so it still counts as a class.":
      "Esta aula começa em menos de {hours} horas, então ainda vai contar como aula.",
    "The time will open up for other students.":
      "O horário fica livre para outros alunos.",
    "Keep it": "Manter",
    "Canceling…": "Cancelando…",
    "Withdraw request": "Retirar pedido",
    "Cancel anyway": "Cancelar mesmo assim",
    "Cancel class": "Cancelar aula",
    "Lifetime lesson access": "Acesso vitalício às aulas",
    "Every lesson on the lessons site is yours for good. Obrigado for learning with Trevor!":
      "Todas as aulas do site de aulas são suas para sempre. Obrigado por aprender com o Trevor!",
    "You qualify for lifetime lesson access!":
      "Você conquistou o acesso vitalício às aulas!",
    "You've finished {sets} sets of {size} classes. Trevor will set up lifetime access to every lesson for you.":
      "Você concluiu {sets} pacotes de {size} aulas. O Trevor vai liberar para você o acesso vitalício a todas as aulas.",
    "Toward lifetime lesson access": "Rumo ao acesso vitalício",
    "Finish {sets} sets of {size} classes to qualify for lifetime access to every lesson.":
      "Conclua {sets} pacotes de {size} aulas para ganhar acesso vitalício a todas as aulas.",
    "Classes toward lifetime lesson access": "Aulas rumo ao acesso vitalício",
    "{done} of {needed} classes · {setsDone} of {sets} sets":
      "{done} de {needed} aulas · {setsDone} de {sets} pacotes",
    Preferences: "Preferências",
    "These follow you to the home, lessons and flashcards sites too.":
      "Valem também para o início, as aulas e os flashcards.",
    "Site language": "Idioma do site",
    "Dark mode": "Modo escuro",
    "I'm learning": "Estou aprendendo",
    "Choose…": "Escolher…",
    "The same account works on the lessons, flashcards and schedule sites.":
      "A mesma conta vale para as aulas, os flashcards e a agenda.",
    Name: "Nome",
    Email: "E-mail",
    "Lessons & subscription": "Aulas e assinatura",
    "Opening…": "Abrindo…",
    "Manage subscription": "Gerenciar assinatura",
    "Delete account": "Excluir conta",
    "Change your card, see receipts, or cancel. Handled securely by Stripe.":
      "Troque seu cartão, veja recibos ou cancele. Com segurança pelo Stripe.",
    "Billing is unavailable right now. Please try again.":
      "A cobrança não está disponível agora. Tente novamente.",
    "This deletes your account on every Trevor site.":
      "Isso exclui sua conta em todos os sites do Trevor.",
    "Admin accounts can't be deleted from the app, since that would remove the account that manages the schedule, lessons and instructor decks.":
      "Contas de administrador não podem ser excluídas pelo app, porque isso removeria a conta que gerencia a agenda, as aulas e os baralhos do professor.",
    "This permanently deletes your account, your class history, your flashcard decks and study progress, and cancels any lesson subscription. Cancel upcoming classes first. This can't be undone.":
      "Isso exclui permanentemente sua conta, seu histórico de aulas, seus baralhos de flashcards e seu progresso, e cancela qualquer assinatura de aulas. Cancele as próximas aulas antes. Isso não pode ser desfeito.",
    "Type DELETE to confirm": "Digite DELETE para confirmar",
    "Keep my account": "Manter minha conta",
    "Deleting…": "Excluindo…",
    "Permanently delete my account": "Excluir minha conta permanentemente",
    "Admin: every lesson is open.": "Admin: todas as aulas estão liberadas.",
    "Lifetime access: every lesson is yours for good.":
      "Acesso vitalício: todas as aulas são suas para sempre.",
    "Student access from Trevor: every lesson is included with your classes.":
      "Acesso de aluno do Trevor: todas as aulas estão incluídas nas suas aulas particulares.",
    "Subscriber. Your last payment didn't go through; please update your card.":
      "Assinante. Seu último pagamento não foi aprovado; atualize seu cartão.",
    "Subscriber. Canceled; your lessons stay open until {date}.":
      "Assinante. Cancelada; suas aulas ficam liberadas até {date}.",
    "Subscriber: every Portuguese lesson is open. Renews on {date}.":
      "Assinante: todas as aulas de português estão liberadas. Renova em {date}.",
    "Subscriber: every Portuguese lesson is open.":
      "Assinante: todas as aulas de português estão liberadas.",
    "Free lessons: lessons 1–4 are open. Subscribe on the lessons site, or ask Trevor for student access.":
      "Aulas grátis: as aulas 1–4 estão liberadas. Assine no site de aulas ou peça ao Trevor acesso de aluno.",
    "That time overlaps an existing class. Please pick another time.":
      "Esse horário coincide com outra aula. Escolha outro.",
    "Something went wrong. Please try again.": "Algo deu errado. Tente de novo.",
    "That time overlaps your current class. Pick a time that doesn't overlap it.":
      "Esse horário coincide com a sua aula atual. Escolha um horário que não coincida com ela.",
    "Classes can be booked up to 60 days ahead.":
      "As aulas podem ser agendadas com até 60 dias de antecedência.",
    "You already have 10 upcoming classes. Cancel one to book another.":
      "Você já tem 10 aulas agendadas. Cancele uma para agendar outra.",
    Close: "Fechar",
    Welcome: "Bem-vindo",
    "Log in with your Google account or your email and password.":
      "Entre com a sua conta do Google ou com o seu e-mail e senha.",
    "Redirecting...": "Redirecionando...",
    "Log in with Google": "Entrar com o Google",
    "That time was just taken. Please pick another.":
      "Esse horário acabou de ser reservado. Escolha outro.",
    "Please choose English or Portuguese.": "Escolha inglês ou português.",
    "Please enter a valid WhatsApp number.":
      "Digite um número de WhatsApp válido.",
    "Booking not found.": "Agendamento não encontrado.",
    "Classes must be requested at least 72 hours in advance.":
      "As aulas precisam ser pedidas com pelo menos 72 horas de antecedência.",
    "Only a confirmed lesson can be rescheduled.":
      "Só dá para remarcar uma aula confirmada.",
    "Sessions must be requested at least 72 hours in advance.":
      "As aulas precisam ser pedidas com pelo menos 72 horas de antecedência.",
    "That class is no longer available.": "Essa aula não está mais disponível.",
    "That slot is no longer available.":
      "Esse horário não está mais disponível.",
    "That time has already passed.": "Esse horário já passou.",
    "This lesson has already started.": "Esta aula já começou.",
    "You already asked to reschedule this lesson.":
      "Você já pediu para remarcar esta aula.",
    "Admin accounts can't be self-deleted from the app.":
      "Contas de administrador não podem ser excluídas pelo app.",
    "You have an upcoming class booked. Cancel it in the schedule app first, then delete your account.":
      "Você tem uma aula agendada. Cancele-a primeiro na agenda e depois exclua sua conta.",
    "Please log in first.": "Entre na sua conta primeiro.",
    "Something went wrong with billing. Please try again.":
      "Algo deu errado com a cobrança. Tente novamente.",
    "Page not found":
      "Página não encontrada",
    "This page doesn't exist or has moved.":
      "Esta página não existe ou mudou de endereço.",
    "Something went wrong":
      "Algo deu errado",
    "Please try again in a moment. If it keeps happening, let Trevor know.":
      "Tente de novo daqui a pouco. Se continuar acontecendo, avise o Trevor.",
    "We're updating the site":
      "Estamos atualizando o site",
    "Scheduling will be back in a few minutes. Your bookings are safe.":
      "A agenda volta em alguns minutos. Suas reservas estão seguras.",
    "Try again":
      "Tentar de novo",
    "Go to the home page":
      "Ir para a página inicial",
  },
  fr: {
    "English & Portuguese with Trevor, main website":
      "English & Portuguese with Trevor, site principal",
    "{day} at {time}": "{day} à {time}",
    "Hi, {name}": "Bonjour, {name}",
    Account: "Compte",
    Home: "Accueil",
    Lessons: "Leçons",
    Flashcards: "Flashcards",
    Activities: "Activités",
    "Schedule a class": "Réserver un cours",
    Learn: "Apprendre",
    "Daily puzzles": "Jeux quotidiens",
    "Get the app": "Télécharger l'appli",
    "App start": "Démarrage",
    Settings: "Paramètres",
    "Log out": "Se déconnecter",
    "Loading…": "Chargement…",
    "My bookings": "Mes réservations",
    "You have no upcoming classes yet.":
      "Vous n'avez pas encore de cours à venir.",
    "Reschedule request": "Demande de changement d'horaire",
    "English / Portuguese class": "Cours d'anglais / de portugais",
    "Moving from {time}": "Déplacé depuis le {time}",
    "Reschedule requested": "Changement d'horaire demandé",
    Confirmed: "Confirmé",
    "Waiting for approval": "En attente d'approbation",
    "Join Meet": "Rejoindre Meet",
    Reschedule: "Changer l'horaire",
    Cancel: "Annuler",
    "Pick a new time": "Choisissez un nouvel horaire",
    "Book a class": "Réserver un cours",
    "Moving your class on {time}. It stays booked until Trevor approves the new time.":
      "Déplacement de votre cours du {time}. Il reste réservé jusqu'à ce que Trevor approuve le nouvel horaire.",
    Stop: "Arrêter",
    "Request sent — Trevor needs to approve it.":
      "Demande envoyée : Trevor doit l'approuver.",
    "Class booked.": "Cours réservé.",
    "Pick the class to move first.": "Choisissez d'abord le cours à déplacer.",
    "Reschedule request sent — Trevor needs to approve it.":
      "Demande de changement envoyée : Trevor doit l'approuver.",
    "Booking canceled.": "Réservation annulée.",
    "your local time": "votre heure locale",
    "Times shown in {zone}.": "Horaires en {zone}.",
    "{n} open": "{n} libres",
    "no availability": "aucune disponibilité",
    Booked: "Réservé",
    "No availability on this day.": "Aucune disponibilité ce jour-là.",
    "{time}, needs approval": "{time}, à faire approuver",
    "Dashed times are less than 72 hours away. You can still request them, but Trevor needs to approve them first.":
      "Les horaires en pointillés sont dans moins de 72 heures. Vous pouvez les demander, mais Trevor doit d'abord les approuver.",
    "Request this new time?": "Demander ce nouvel horaire ?",
    "Request this class?": "Demander ce cours ?",
    "Book this class?": "Réserver ce cours ?",
    "Your class on {time} stays booked until Trevor approves the change.":
      "Votre cours du {time} reste réservé jusqu'à ce que Trevor approuve le changement.",
    "It's less than 72 hours away, so it stays pending until Trevor approves it.":
      "C'est dans moins de 72 heures, donc le cours reste en attente jusqu'à ce que Trevor l'approuve.",
    "It's confirmed as soon as you book.":
      "Le cours est confirmé dès la réservation.",
    "Are you looking for English or Portuguese lessons?":
      "Vous cherchez des cours d'anglais ou de portugais ?",
    English: "Anglais",
    Portuguese: "Portugais",
    "WhatsApp number": "Numéro WhatsApp",
    "(optional)": "(facultatif)",
    "Include your country code.": "Indiquez l'indicatif de votre pays.",
    "That doesn't look like a phone number.":
      "Cela ne ressemble pas à un numéro de téléphone.",
    Back: "Retour",
    "Sending…": "Envoi…",
    Request: "Demander",
    Book: "Réserver",
    "Withdraw this request?": "Retirer cette demande ?",
    "Cancel this class?": "Annuler ce cours ?",
    "This class starts in less than {hours} hours, so it still counts as a class.":
      "Ce cours commence dans moins de {hours} heures, il comptera donc quand même comme un cours.",
    "The time will open up for other students.":
      "Le créneau se libérera pour d'autres élèves.",
    "Keep it": "La garder",
    "Canceling…": "Annulation…",
    "Withdraw request": "Retirer la demande",
    "Cancel anyway": "Annuler quand même",
    "Cancel class": "Annuler le cours",
    "Lifetime lesson access": "Accès à vie aux leçons",
    "Every lesson on the lessons site is yours for good. Obrigado for learning with Trevor!":
      "Toutes les leçons du site sont à vous pour toujours. Obrigado d'apprendre avec Trevor !",
    "You qualify for lifetime lesson access!":
      "Vous avez droit à l'accès à vie aux leçons !",
    "You've finished {sets} sets of {size} classes. Trevor will set up lifetime access to every lesson for you.":
      "Vous avez terminé {sets} séries de {size} cours. Trevor va vous ouvrir l'accès à vie à toutes les leçons.",
    "Toward lifetime lesson access": "Vers l'accès à vie",
    "Finish {sets} sets of {size} classes to qualify for lifetime access to every lesson.":
      "Terminez {sets} séries de {size} cours pour obtenir l'accès à vie à toutes les leçons.",
    "Classes toward lifetime lesson access": "Cours vers l'accès à vie",
    "{done} of {needed} classes · {setsDone} of {sets} sets":
      "{done} cours sur {needed} · {setsDone} séries sur {sets}",
    Preferences: "Préférences",
    "These follow you to the home, lessons and flashcards sites too.":
      "Ils s'appliquent aussi à l'accueil, aux leçons et aux flashcards.",
    "Site language": "Langue du site",
    "Dark mode": "Mode sombre",
    "I'm learning": "J'apprends",
    "Choose…": "Choisir…",
    "The same account works on the lessons, flashcards and schedule sites.":
      "Le même compte fonctionne pour les leçons, les flashcards et la réservation.",
    Name: "Nom",
    Email: "E-mail",
    "Lessons & subscription": "Leçons et abonnement",
    "Opening…": "Ouverture…",
    "Manage subscription": "Gérer l'abonnement",
    "Delete account": "Supprimer le compte",
    "Change your card, see receipts, or cancel. Handled securely by Stripe.":
      "Changez de carte, consultez vos reçus ou annulez. Géré en toute sécurité par Stripe.",
    "Billing is unavailable right now. Please try again.":
      "La facturation est indisponible pour le moment. Veuillez réessayer.",
    "This deletes your account on every Trevor site.":
      "Cela supprime votre compte sur tous les sites de Trevor.",
    "Admin accounts can't be deleted from the app, since that would remove the account that manages the schedule, lessons and instructor decks.":
      "Les comptes administrateur ne peuvent pas être supprimés depuis l'app, car cela supprimerait le compte qui gère l'agenda, les leçons et les paquets du professeur.",
    "This permanently deletes your account, your class history, your flashcard decks and study progress, and cancels any lesson subscription. Cancel upcoming classes first. This can't be undone.":
      "Cela supprime définitivement votre compte, votre historique de cours, vos paquets de flashcards et votre progression, et annule tout abonnement aux leçons. Annulez d'abord vos prochains cours. Cette action est irréversible.",
    "Type DELETE to confirm": "Tapez DELETE pour confirmer",
    "Keep my account": "Garder mon compte",
    "Deleting…": "Suppression…",
    "Permanently delete my account": "Supprimer définitivement mon compte",
    "Admin: every lesson is open.": "Admin : toutes les leçons sont ouvertes.",
    "Lifetime access: every lesson is yours for good.":
      "Accès à vie : toutes les leçons sont à vous pour toujours.",
    "Student access from Trevor: every lesson is included with your classes.":
      "Accès élève offert par Trevor : toutes les leçons sont incluses avec vos cours.",
    "Subscriber. Your last payment didn't go through; please update your card.":
      "Abonné. Votre dernier paiement n'est pas passé ; veuillez mettre à jour votre carte.",
    "Subscriber. Canceled; your lessons stay open until {date}.":
      "Abonné. Annulé ; vos leçons restent ouvertes jusqu'au {date}.",
    "Subscriber: every Portuguese lesson is open. Renews on {date}.":
      "Abonné : toutes les leçons de portugais sont ouvertes. Se renouvelle le {date}.",
    "Subscriber: every Portuguese lesson is open.":
      "Abonné : toutes les leçons de portugais sont ouvertes.",
    "Free lessons: lessons 1–4 are open. Subscribe on the lessons site, or ask Trevor for student access.":
      "Leçons gratuites : les leçons 1 à 4 sont ouvertes. Abonnez-vous sur le site des leçons, ou demandez à Trevor un accès élève.",
    "That time overlaps an existing class. Please pick another time.":
      "Cet horaire chevauche un autre cours. Choisissez-en un autre.",
    "Something went wrong. Please try again.": "Une erreur s'est produite. Réessayez.",
    "That time overlaps your current class. Pick a time that doesn't overlap it.":
      "Cet horaire chevauche votre cours actuel. Choisissez un horaire qui ne le chevauche pas.",
    "Classes can be booked up to 60 days ahead.":
      "Les cours peuvent être réservés jusqu'à 60 jours à l'avance.",
    "You already have 10 upcoming classes. Cancel one to book another.":
      "Vous avez déjà 10 cours à venir. Annulez-en un pour en réserver un autre.",
    Close: "Fermer",
    Welcome: "Bienvenue",
    "Log in with your Google account or your email and password.":
      "Connectez-vous avec votre compte Google ou avec votre e-mail et votre mot de passe.",
    "Redirecting...": "Redirection...",
    "Log in with Google": "Se connecter avec Google",
    "That time was just taken. Please pick another.":
      "Cet horaire vient d'être pris. Choisissez-en un autre.",
    "Please choose English or Portuguese.": "Choisissez anglais ou portugais.",
    "Please enter a valid WhatsApp number.":
      "Saisissez un numéro WhatsApp valide.",
    "Booking not found.": "Réservation introuvable.",
    "Classes must be requested at least 72 hours in advance.":
      "Les cours doivent être demandés au moins 72 heures à l'avance.",
    "Only a confirmed lesson can be rescheduled.":
      "Seul un cours confirmé peut changer d'horaire.",
    "Sessions must be requested at least 72 hours in advance.":
      "Les cours doivent être demandés au moins 72 heures à l'avance.",
    "That class is no longer available.": "Ce cours n'est plus disponible.",
    "That slot is no longer available.": "Ce créneau n'est plus disponible.",
    "That time has already passed.": "Cet horaire est déjà passé.",
    "This lesson has already started.": "Ce cours a déjà commencé.",
    "You already asked to reschedule this lesson.":
      "Vous avez déjà demandé à changer l'horaire de ce cours.",
    "Admin accounts can't be self-deleted from the app.":
      "Les comptes administrateur ne peuvent pas être supprimés depuis l'app.",
    "You have an upcoming class booked. Cancel it in the schedule app first, then delete your account.":
      "Vous avez un cours réservé à venir. Annulez-le d'abord dans l'agenda, puis supprimez votre compte.",
    "Please log in first.": "Connectez-vous d'abord.",
    "Something went wrong with billing. Please try again.":
      "Un problème est survenu avec la facturation. Veuillez réessayer.",
    "Page not found":
      "Page introuvable",
    "This page doesn't exist or has moved.":
      "Cette page n'existe pas ou a été déplacée.",
    "Something went wrong":
      "Une erreur s'est produite",
    "Please try again in a moment. If it keeps happening, let Trevor know.":
      "Réessayez dans un instant. Si le problème continue, prévenez Trevor.",
    "We're updating the site":
      "Nous mettons le site à jour",
    "Scheduling will be back in a few minutes. Your bookings are safe.":
      "L'agenda sera de retour dans quelques minutes. Vos réservations sont en sécurité.",
    "Try again":
      "Réessayer",
    "Go to the home page":
      "Aller à la page d'accueil",
  },
} as const;
