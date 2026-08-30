/**
 * Lightweight i18n for AlisanPhysio (Turkish / English).
 * Pure + framework-agnostic so it works in both server and client components.
 * `getLang()` (server, cookie-based) lives in i18n-server.ts; the client
 * provider/hook + toggle live under src/app.
 */

export type Lang = "en" | "tr";
export const LANGS: Lang[] = ["en", "tr"];
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "tr";
}

/** Persist the session language in a cookie (client-side). */
export function setLangCookie(lang: Lang): void {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

type Dict = Record<string, string>;

const en: Dict = {
  // Common
  "common.signOut": "Sign out",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.saving": "Saving…",
  "common.optional": "(optional)",

  // Login
  "login.metaTitle": "Sign in",
  "login.tagline": "Your programs, all in one place",
  "login.heading": "Sign in to your account",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.submitting": "Signing in…",
  "login.error": "Incorrect email or password. Please try again.",
  "login.helper":
    "Accounts are created by your practitioner. Contact Alişan if you need access.",

  // Client dashboard
  "dash.welcomeName": "Welcome back, {name}",
  "dash.welcome": "Welcome back",
  "dash.subtitleClient": "Here's your program for this week.",
  "dash.subtitleAdmin": "You're signed in as an administrator.",
  "dash.thisWeek": "This week",
  "dash.pastPrograms": "Past programs",
  "dash.upcomingPrograms": "Upcoming programs",
  "dash.noThisWeekTitle": "No program scheduled for this week yet",
  "dash.noThisWeekBody": "Alişan will add your next program soon.",
  "dash.clientFallback": "Client",
  "dash.coachLine": "Coach: {name}",
  "dash.coachingSince": "Coaching since {date}",
  "dash.avatarLabel": "{name}'s initials",
  "dash.navigationLabel": "Client dashboard",
  "dash.tab.overview": "Overview",
  "dash.tab.programme": "Programme",
  "dash.tab.nutrition": "Nutrition",
  "dash.tab.progress": "Progress",
  "dash.tab.schedule": "Schedule",
  "dash.overviewEyebrow": "Your coaching",
  "dash.overviewBody":
    "Here is the shape of your current week and the next coaching touchpoint.",
  "dash.metric.trainingDays": "Training days this week",
  "dash.metric.exercises": "Exercises this week",
  "dash.metric.meals": "Meals in your plan",
  "dash.metric.measurements": "Progress entries",
  "dash.programmeReadyBody": "Your programme is ready to open.",
  "dash.openProgramme": "Open programme",
  "dash.appointmentEyebrow": "Next appointment",
  "dash.appointmentTitle": "Your next coaching session",
  "dash.noAppointmentTitle": "No appointment recorded yet",
  "dash.noAppointmentBody":
    "Sessions are arranged directly. If Alişan needs your availability, the request will appear in Schedule.",
  "dash.coachNoteEyebrow": "Coach note",
  "dash.coachNoteTitle": "A note for this week",
  "dash.noCoachNoteTitle": "No coach note yet",
  "dash.noCoachNoteBody": "Any programme note from Alişan will appear here.",
  "dash.checkInEyebrow": "Check-in",
  "dash.checkInTitle": "Weekly reflection",
  "dash.checkInBody": "Share how this training week went or update your check-in.",
  "dash.noCheckInBody": "Your next check-in will appear with an active programme week.",
  "dash.programmeEyebrow": "Training programme",
  "dash.programmeTitle": "Every training week, in one place.",
  "dash.programmeBody":
    "Open the current programme, look ahead, or revisit a previous week and its check-in.",

  // Buckets / lists
  "bucket.upcoming": "Upcoming",
  "bucket.past": "Past",
  "list.pastTitle": "Past programs",
  "list.pastSubtitle": "Your previous weeks, newest first.",
  "list.upcomingTitle": "Upcoming programs",
  "list.upcomingSubtitle": "What's coming next, soonest first.",
  "list.backToThisWeek": "Back to this week",
  "list.emptyPast": "No past programs yet.",
  "list.emptyUpcoming": "Nothing scheduled yet.",

  // Program detail (client)
  "prog.back": "Back to dashboard",
  "prog.notesFrom": "Notes from Alişan",
  "prog.exercises": "Exercises",
  "prog.watchDemo": "Watch demo",
  "prog.noExercises": "No exercises in this program yet.",
  "prog.day": "Day {n}",

  // Effort line
  "effort.setsReps": "{sets} sets × {reps}",
  "effort.sets": "{sets} sets",

  // Admin — header / nav
  "admin.clients": "Clients",
  "admin.library": "Library",
  "admin.refresh": "Refresh data",

  // Admin — clients list
  "admin.newClient": "New client",
  "admin.searchClients": "Search by name or username…",
  "admin.addName": "Add a name",
  "admin.noClients": "No clients yet. Add your first one.",
  "admin.noClientMatches": "No clients match your search.",

  // Admin — users list (3 tabs)
  "admin.usersHeading": "Users",
  "admin.tabAdmins": "Admins",
  "admin.tabManagers": "Managers",
  "admin.tabClients": "Clients",
  "admin.searchUsers": "Search by name or email…",
  "admin.noneInGroup": "No one in this group yet.",
  "admin.noUserMatches": "No matches for your search.",

  // Admin — assessment requests
  "requests.nav": "Requests",
  "requests.metaTitle": "Assessment requests",
  "requests.heading": "Assessment requests",
  "requests.subtitle": "Review new enquiries and track each conversation.",
  "requests.filterAll": "All",
  "requests.status.new": "New",
  "requests.status.contacted": "Contacted",
  "requests.status.accepted": "Accepted",
  "requests.status.declined": "Declined",
  "requests.created": "Received",
  "requests.name": "Name",
  "requests.email": "Email",
  "requests.phone": "Phone",
  "requests.country": "Country",
  "requests.city": "City",
  "requests.plan": "Plan",
  "requests.status": "Status",
  "requests.view": "View request",
  "requests.empty": "No assessment requests in this view.",
  "requests.back": "Back to requests",
  "requests.contactGroup": "Contact",
  "requests.profileGroup": "Body and goal",
  "requests.trainingGroup": "Training",
  "requests.healthGroup": "Health context",
  "requests.contextGroup": "Request context",
  "requests.fullName": "Full name",
  "requests.preferredLanguage": "Preferred language",
  "requests.language.en": "English",
  "requests.language.tr": "Turkish",
  "requests.birthYear": "Birth year",
  "requests.approxAge": "Approximate age",
  "requests.sex": "Sex",
  "requests.height": "Height",
  "requests.weight": "Weight",
  "requests.bmi": "BMI",
  "requests.primaryGoal": "Primary goal",
  "requests.experience": "Training experience",
  "requests.days": "Days per week",
  "requests.equipment": "Equipment access",
  "requests.injury": "Injury or pain history",
  "requests.medical": "Medical notes",
  "requests.message": "Visitor note",
  "requests.reviewedAt": "Last reviewed",
  "requests.notProvided": "Not provided",
  "requests.copyEmail": "Copy email address",
  "requests.copied": "Email copied",
  "requests.copyFailed": "Could not copy the email address.",
  "requests.workflowHeading": "Workflow",
  "requests.workflowSubtitle": "Update the status or keep a private note.",
  "requests.updateStatus": "Update status",
  "requests.updating": "Updating…",
  "requests.adminNote": "Private admin note",
  "requests.adminNotePlaceholder": "Conversation notes, follow-up details or next steps…",
  "requests.saveNote": "Save note",
  "requests.noteSaved": "Note saved",
  "requests.statusSaved": "Status updated",
  "requests.saveError": "The request could not be updated. Please try again.",

  // Roles
  "role.admin": "Admin",
  "role.manager": "Manager",
  "role.client": "Client",

  // Admin — client detail
  "admin.allClients": "All clients",
  "admin.manage": "Manage",
  "admin.resetPassword": "Reset password",
  "admin.newProgram": "New program",
  "admin.emptyCurrent": "No program for this week.",
  "admin.emptyUpcoming": "Nothing scheduled.",
  "admin.emptyPast": "No past programs.",

  // New program menu + copy modal
  "menu.startBlank": "Start blank",
  "menu.startBlankSub": "A fresh, empty program.",
  "menu.copyPrev": "Copy from previous week",
  "menu.copyPrevSub": "Duplicate a program's days & exercises.",
  "copy.title": "Copy from a previous program",
  "copy.subtitle":
    "Pick a week to duplicate its days and exercises into a new one.",
  "copy.empty": "No previous programs to copy yet.",
  "copy.startInstead": "Start blank instead",

  // Program editor
  "editor.newHeading": "New program",
  "editor.editHeading": "Edit program",
  "editor.backToClient": "Back to client",
  "editor.week": "Week",
  "editor.title": "Title",
  "editor.titleHint": "(auto-filled, editable)",
  "editor.notes": "Notes",
  "editor.notesPlaceholder": "A note for the week…",
  "editor.titlePlaceholder": "Week of Aug 4, 2026",
  "editor.hasProgram": "· has a program",
  "editor.dayLabel": "Day {n}",
  "editor.dayPlaceholder":
    "e.g. Chest Day, Leg Day, Knee Rehab — leave blank for a simple list",
  "editor.addDay": "Add day",
  "editor.addExercise": "Add exercise",
  "editor.sets": "Sets",
  "editor.reps": "Reps",
  "editor.instructions": "Instructions for this week (optional)",
  "editor.mediaUrl": "Media URL (optional) — demo video or image",
  "editor.videoOverride": "Video override (optional)",
  "editor.linkedNote": "▶ Linked to the library — the demo video comes from there.",
  "editor.saveToLibrary": "Also save this to my library for reuse",
  "editor.saveProgram": "Save program",
  "editor.deleteProgram": "Delete program",
  "editor.alreadyInDay": "Already in this day",
  "editor.confirmDeleteDay":
    "Delete this day and its exercises? This cannot be undone.",
  "editor.confirmDeleteProgram":
    "Delete this program and everything in it? This cannot be undone.",
  "editor.moveUp": "Move up",
  "editor.moveDown": "Move down",
  "editor.remove": "Remove",
  "editor.moveDayUp": "Move day up",
  "editor.moveDayDown": "Move day down",
  "editor.deleteDay": "Delete day",

  // Library combobox
  "combo.search": "Search the library or type a new name…",
  "combo.addNew": "Add “{q}” as a new exercise",
  "combo.noMatches": "No matches in the library.",
  "combo.linked": "linked",
  "combo.video": "video",

  // Library manager
  "lib.heading": "Exercise library",
  "lib.summary": "{n} exercises · {m} with a video",
  "lib.newExercise": "New exercise",
  "lib.search": "Search exercises…",
  "lib.hasVideo": "▶ Video",
  "lib.noVideo": "No video",
  "lib.preview": "▶ Preview",
  "lib.previewAria": "Preview {name}",
  "lib.empty": "The library is empty. Add your first exercise.",
  "lib.noMatches": "No exercises match your search.",
  "lib.name": "Name",
  "lib.youtubeUrl": "YouTube URL",
  "lib.defaultInstructions": "Default instructions",
  "lib.defaultInstructionsPlaceholder":
    "A coaching cue shown when this exercise is picked.",
  "lib.enterValidUrl": "Enter a valid YouTube link to preview.",
  "lib.confirmDelete": "Delete “{name}” from the library?",
  "lib.noValidVideo": "No valid video for this exercise.",
  "lib.editHeading": "Edit exercise",
  "lib.newHeading": "New exercise",

  // Exercise categories
  "cat.heading": "Categories",
  "cat.all": "All",
  "cat.add": "Add category",
  "cat.namePlaceholder": "Category name",
  "cat.create": "Add",
  "cat.rename": "Rename",
  "cat.renameHeading": "Rename category",
  "cat.save": "Save",
  "cat.delete": "Delete category",
  "cat.confirmDelete":
    "Delete the category “{name}”? The exercises stay — only the category and its tags are removed.",
  "cat.defaultLocked": "Default categories can't be renamed or deleted.",
  "cat.assignLabel": "Categories",
  "cat.assignHint": "Tag this exercise with one or more categories.",
  "cat.none": "Uncategorized",
  "cat.emptyGrid": "No exercises in this category yet.",
  "toast.categoryAdded": "Category added",
  "toast.categoryUpdated": "Category updated",
  "toast.categoryDeleted": "Category deleted",

  // Modals — new client
  "newClient.heading": "New client",
  "newClient.subtitle": "Creates a login they can use right away.",
  "newClient.fullName": "Full name",
  "newClient.username": "Username / email",
  "newClient.usernameHint":
    "Can be a real email, or a fake-but-valid one like name@alisanphysio.local — no inbox needed.",
  "newClient.initialPassword": "Initial password",
  "newClient.passwordHint": "At least 8 characters.",
  "newClient.create": "Create client",
  "newClient.creating": "Creating…",

  // Modal — manage client
  "manage.heading": "Manage client",
  "manage.subtitle": "Edit this client's name and login.",
  "manage.fullName": "Full name",
  "manage.email": "Email / username",
  "manage.emailHint": "Can be a fake-but-valid address (name@alisanphysio.local).",
  "manage.save": "Save changes",

  // Modal — reset password
  "reset.heading": "Reset password",
  "reset.subtitle": "Set a new password and share it with the client.",
  "reset.newPassword": "New password",
  "reset.confirm": "Confirm password",
  "reset.update": "Update password",
  "reset.updating": "Updating…",
  "reset.tooShort": "Password must be at least 8 characters.",
  "reset.mismatch": "Passwords don't match.",

  // Language field
  "lang.label": "Language",
  "lang.en": "English",
  "lang.tr": "Türkçe",

  // Theme toggle
  "theme.toDark": "Switch to dark mode",
  "theme.toLight": "Switch to light mode",
  "theme.toggle": "Toggle color theme",

  // Staff nav — personal program view
  "nav.personalExercises": "Personal Exercises",
  "nav.adminPanel": "Admin",
  "nav.templates": "Templates",

  // Day templates
  "tpl.heading": "Day templates",
  "tpl.subtitle": "Reusable day blueprints — build once, drop into any program.",
  "tpl.new": "New template",
  "tpl.empty": "No templates yet. Create your first day blueprint.",
  "tpl.newHeading": "New template",
  "tpl.editHeading": "Edit template",
  "tpl.backToList": "All templates",
  "tpl.titleLabel": "Template title",
  "tpl.titlePlaceholder": "e.g. Push Day, Leg Day, Knee Rehab",
  "tpl.exercisesHeading": "Exercises",
  "tpl.save": "Save template",
  "tpl.delete": "Delete template",
  "tpl.confirmDelete":
    "Delete this template? This can't be undone. Programs already built from it are unaffected.",
  "tpl.addFromTemplate": "Add from template",
  "tpl.addDayFromTemplate": "Add day from template",
  "tpl.overwriteWarn":
    "This day already has exercises. Applying a template here would overwrite them — add it as a new day instead.",
  "tpl.addAsNewDay": "Add as a new day",
  "tpl.noTemplatesHint": "No templates yet —",
  "tpl.createOne": "create one",
  "toast.templateSaved": "Template saved",
  "toast.templateDeleted": "Template deleted",

  // Weekly-review indicators + inline add-review
  "review.submitted": "Review submitted",
  "review.add": "Add review",

  // Notification categories (bell panel)
  "notif.cat.measurement": "Measurement request",
  "notif.cat.feedback": "Feedback request",
  "notif.cat.other": "Other",

  // Toasts
  "toast.programSaved": "Program saved",
  "toast.programDeleted": "Program deleted",
  "toast.clientCreated": "Client created",
  "toast.clientUpdated": "Client updated",
  "toast.clientDeleted": "Client deleted",
  "toast.roleUpdated": "Role updated",
  "toast.passwordUpdated": "Password updated",
  "toast.exerciseAdded": "Exercise added",
  "toast.exerciseSaved": "Exercise saved",
  "toast.exerciseDeleted": "Exercise deleted",
  "toast.profileSaved": "Profile updated",
  "toast.measurementAdded": "Measurement added",
  "toast.measurementDeleted": "Measurement deleted",
  "toast.noteAdded": "Note added",
  "toast.noteDeleted": "Note deleted",

  // Client Profile — header link + page chrome
  "profile.link": "My Profile",
  "profile.heading": "My Profile",
  "profile.subtitle": "Your account details, password and notes for Alişan.",
  "profile.clientDataHeading": "Client data",
  "profile.clientDataSubtitle": "A read-only view of what {name} sees.",

  // Profile — personal info
  "profile.personalHeading": "Personal information",
  "profile.fullName": "Full name",
  "profile.height": "Height (cm)",
  "profile.heightHint": "Used to calculate your BMI.",
  "profile.heightUnset": "Not set",
  "profile.timezone": "Time zone",
  "profile.timezoneUnset": "Not set",
  "profile.timezoneDetected": "Detected from this device: {timezone}",
  "profile.timezoneHint": "Use an IANA time zone such as Europe/Istanbul.",
  "profile.email": "Email / username",
  "profile.emailReadonlyHint":
    "This is your login. To change it, ask Alişan to update it for you.",
  "profile.savePersonal": "Save changes",

  // Profile — change password
  "profile.passwordHeading": "Change password",
  "profile.passwordSub": "Set a new password for your account.",
  "profile.newPassword": "New password",
  "profile.confirmPassword": "Confirm new password",
  "profile.updatePassword": "Update password",

  // Profile — measurements
  "profile.measurementsHeading": "Weekly measurements",
  "profile.measurementsSub":
    "Log your weight and body measurements to track your progress.",
  "profile.addMeasurement": "Add a measurement",
  "profile.date": "Date",
  "profile.weight": "Weight (kg)",
  "profile.waist": "Waist (cm)",
  "profile.hip": "Hip (cm)",
  "profile.arm": "Arm (cm)",
  "profile.chest": "Chest (cm)",
  "profile.noMeasurements": "No measurements yet. Add your first one above.",
  "profile.noMeasurementsReadonly": "No measurements recorded yet.",
  "profile.confirmDeleteMeasurement": "Delete this measurement?",
  "profile.colWeight": "Weight",
  "profile.colWaist": "Waist",
  "profile.colHip": "Hip",
  "profile.colArm": "Arm",
  "profile.colChest": "Chest",

  // Profile — chart
  "profile.chartWeight": "Weight",
  "profile.chartBmi": "BMI",
  "profile.chartKg": "kg",
  "profile.bmiNeedsHeight": "Add your height above to see your BMI trend.",
  "profile.bmiNeedsHeightReadonly": "No height set, so BMI can't be shown.",
  "profile.chartEmpty": "Add a measurement with a weight to see your trend.",
  "profile.chartEmptyReadonly": "No weight data to chart yet.",

  // Profile — complaints / notes
  "profile.complaintsHeading": "Complaints & notes",
  "profile.complaintsSub":
    "Tell Alişan how you're feeling — any pain or issues.",
  "profile.complaintPlaceholder":
    "How are you feeling? Any pain or issues this week?",
  "profile.addNote": "Add note",
  "profile.noComplaints": "No notes yet.",
  "profile.noComplaintsReadonly": "No notes from this client yet.",
  "profile.confirmDeleteComplaint": "Delete this note?",

  // Admin — view client data
  "admin.viewData": "View client data",
  "admin.backToClient": "Back to client",

  // Measurement optional-field hints
  "profile.weightRequiredHint": "Required",
  "profile.optional": "optional",

  // BMI classification (WHO) — category names + neutral one-liners
  "bmi.title": "Body Mass Index",
  "bmi.value": "BMI {value}",
  "bmi.underweight": "Below the reference range",
  "bmi.normal": "Within the reference range",
  "bmi.overweight": "Above the reference range",
  "bmi.obese": "Above the reference range",
  "bmi.note.underweight": "Below the reference range.",
  "bmi.note.normal": "Within the reference range.",
  "bmi.note.overweight": "Above the reference range.",
  "bmi.note.obese": "Above the reference range.",
  "bmi.basedOn": "Based on the latest measurement",
  "bmi.context":
    "BMI is one planning signal among many; training history, strength, energy and how you feel also matter.",

  // Membership
  "membership.label": "Membership",
  "membership.your": "Your membership",
  "membership.none": "No membership set",
  "membership.optionNone": "None",
  "membership.endDate": "Membership end date",
  "membership.endDateHint": "Optional — leave blank for no expiry.",
  "membership.until": "Valid until {date}",
  "membership.expired": "Expired {date}",
  "membership.noExpiry": "No expiry",

  // Membership-inactive (blocked) screen
  "inactive.title": "Your membership isn't active",
  "inactive.body":
    "Alişan hasn't set an active membership for you. Please contact him to get started.",

  // Role (admin-only)
  "manage.role": "Role",
  "manage.roleHint": "Only an admin can change roles.",

  // Delete client (admin, destructive)
  "manage.deleteClient": "Delete client",
  "manage.deleteHeading": "Delete this client?",
  "manage.deleteWarning":
    "This permanently deletes the client and all their data — programs, measurements and notes. This cannot be undone.",
  "manage.deleteConfirmCheck": "I understand this is permanent.",
  "manage.deleteConfirm": "Delete permanently",
  "manage.deleting": "Deleting…",

  // Notifications — bell + panel
  "notif.aria": "Notifications",
  "notif.title": "Notifications",
  "notif.empty": "You're all caught up.",
  "notif.markAllRead": "Mark all read",
  "notif.justNow": "just now",
  "notif.minutesAgo": "{n}m ago",
  "notif.hoursAgo": "{n}h ago",
  "notif.daysAgo": "{n}d ago",

  // System notifications (generated on load)
  "notif.missingInfo.title": "Add your height",
  "notif.missingInfo.body":
    "Please add your height so we can track your BMI.",
  "notif.expiry.titleSoon": "Your membership ends soon",
  "notif.expiry.titleEnded": "Your membership has ended",
  "notif.expiry.body": "Ends {date} — contact Alişan to renew.",
  "notif.review.title": "Your weekly review is ready",
  "notif.review.body": "Tell Alişan how last week went.",

  // Manual send (staff)
  "manage.sendNotification": "Send notification",
  "send.heading": "Send a notification",
  "send.subtitle": "It shows up in {name}'s notification bell.",
  "send.titleLabel": "Title",
  "send.bodyLabel": "Message",
  "send.bodyPlaceholder": "e.g. Your new program is ready 💪",
  "send.submit": "Send",
  "send.sending": "Sending…",
  "toast.notificationSent": "Notification sent",

  // Weekly review — form
  "review.link": "Weekly review",
  "review.heading": "Last week's review",
  "review.subtitle": "Tell Alişan how {range} went.",
  "review.daysAttended": "How many days did you train last week?",
  "review.programsDone": "Which programs did you do?",
  "review.hardExercises": "Which exercises were hard?",
  "review.hardHint": "Check the ones you struggled with.",
  "review.note": "Anything else for Alişan?",
  "review.notePlaceholder": "Optional — pain, energy, questions…",
  "review.submit": "Submit review",
  "review.update": "Update review",
  "review.none": "You had no program last week — nothing to review yet.",
  "toast.reviewSubmitted": "Review submitted",
  "err.reviewNoPrograms": "There's nothing to review for last week.",

  // Weekly review — staff view
  "review.staffHeading": "Weekly reviews",
  "review.staffEmpty": "No weekly reviews submitted yet.",
  "review.daysLabel": "Days trained",
  "review.programsLabel": "Programs done",
  "review.hardLabel": "Found hard",
  "review.noteLabel": "Note",
  "review.nonePicked": "None",

  // View as user
  "admin.viewAsUser": "View as user",

  // Whatsapp
  "wa.aria": "Chat on WhatsApp",
  "wa.title": "WhatsApp — coming soon",

  // Action errors
  "err.enterName": "Please enter the client's name.",
  "err.enterEmail": "Please enter a username / email.",
  "err.passwordShort": "Password must be at least 8 characters.",
  "err.emailTaken": "That username / email is already taken.",
  "err.emailInUse": "That email / username is already in use.",
  "err.emailInvalid": "Enter a valid email / username (e.g. name@example.com).",
  "err.giveTitle": "Give the program a title.",
  "err.pickDate": "Pick a valid week start date.",
  "err.giveExerciseName": "Give the exercise a name.",
  "err.notYouTube": "That doesn't look like a YouTube link.",
  "err.exerciseExists": "An exercise with that name already exists.",
  "err.heightRange": "Enter a valid height between 50 and 260 cm.",
  "err.measurementDate": "Pick a valid measurement date.",
  "err.numberRange": "Please enter valid numbers.",
  "err.emptyNote": "Write something before saving.",
  "err.weightRequired": "Please enter a weight for this measurement.",
  "err.endDate": "Pick a valid membership end date.",
  "err.notAClient": "This account can't be deleted here.",
  "err.cantChangeOwnRole": "You can't change your own role.",
  "err.invalidRole": "Pick a valid role.",
  "err.adminOnly": "Only an admin can do that.",
  "err.notifTitle": "Enter a title for the notification.",
  "err.giveCategoryName": "Give the category a name.",
  "err.categoryExists": "A category with that name already exists.",
  "err.cantEditDefault": "Default categories can't be renamed or deleted.",
  "err.giveTemplateTitle": "Give the template a title.",

  // Admin nav — grouped ("Content" dropdown)
  "nav.content": "Content",
  "nav.exerciseLibrary": "Exercise Library",
  "nav.foodLibrary": "Food Library",
  "nav.dayTemplates": "Day Templates",

  // Food library (admin)
  "food.heading": "Food library",
  "food.summary": "{n} foods",
  "food.newFood": "New food",
  "food.search": "Search foods…",
  "food.empty": "The food library is empty. Add your first food.",
  "food.noMatches": "No foods match your search.",
  "food.filterAll": "All",
  "food.filterTracked": "Nutrition tracked",
  "food.filterMissing": "Nutrition missing",
  "food.filterMissingEquivalent": "Gram equivalent missing",
  "food.name": "Name",
  "food.defaultPortion": "Default portion",
  "food.defaultPortionPlaceholder": "e.g. 1 cup, 150 g",
  "food.servingDetails": "Serving used for nutrition",
  "food.servingQty": "Serving quantity",
  "food.servingUnit": "Serving unit",
  "food.gramsPerUnit": "Grams per unit",
  "food.gramsPerUnitHint":
    "Needed when this serving may be entered in grams. Leave blank if it is not known.",
  "food.nutritionForServing": "The nutrition values below describe this serving.",
  "food.missingNutrition": "Nutrition data missing",
  "food.missingEquivalent": "Gram equivalent missing",
  "food.missingServing": "Structured serving missing",
  "food.legacyPortion": "Legacy portion label",
  "food.note": "Note",
  "food.notePlaceholder": "An optional note about this food.",
  "food.noPortion": "No default portion",
  "food.newHeading": "New food",
  "food.editHeading": "Edit food",
  "food.confirmDelete": "Delete “{name}” from the food library?",
  "food.invalidNutrition": "Enter valid non-negative nutrition values.",
  "food.invalidServing":
    "Enter a serving quantity greater than zero and choose its unit. Gram equivalents must also be greater than zero.",
  "food.nameEn": "English name",
  "food.nameTr": "Turkish name",
  "food.nutritionPerPortion": "Nutrition for this serving",
  "food.kcal": "kcal",
  "food.protein": "Protein",
  "food.carbs": "Carbs",
  "food.fat": "Fat",
  "food.proteinShort": "P",
  "food.carbsShort": "C",
  "food.fatShort": "F",
  "toast.foodAdded": "Food added",
  "toast.foodSaved": "Food saved",
  "toast.foodDeleted": "Food deleted",
  "err.giveFoodName": "Give the food a name.",
  "err.foodExists": "A food with that name already exists.",

  // Food combobox
  "foodCombo.search": "Search foods or type a new name…",
  "foodCombo.addNew": "Add “{q}” as a new food",

  // Nutrition plan editor (admin)
  "nutri.editHeading": "Nutrition plan",
  "nutri.editSubtitle": "Author {name}'s current nutrition plan.",
  "nutri.notes": "General notes",
  "nutri.notesPlaceholder": "Overall guidance — hydration, timing, anything…",
  "nutri.meals": "Meals",
  "nutri.mealLabel": "Meal {n}",
  "nutri.mealTitle": "Meal name",
  "nutri.mealTitlePlaceholder": "e.g. Breakfast, Lunch…",
  "nutri.presetsLabel": "Quick pick",
  "nutri.addMeal": "Add meal",
  "nutri.addItem": "Add food",
  "nutri.deleteMeal": "Delete meal",
  "nutri.moveMealUp": "Move meal up",
  "nutri.moveMealDown": "Move meal down",
  "nutri.confirmDeleteMeal": "Delete this meal and its foods?",
  "nutri.portion": "Portion",
  "nutri.itemNote": "Note (optional)",
  "nutri.saveToFoodLibrary": "Also save this to the food library",
  "nutri.noMeals": "No meals yet — add one to start the plan.",
  "nutri.save": "Save plan",
  "nutri.deletePlan": "Delete plan",
  "nutri.confirmDeletePlan":
    "Delete this nutrition plan and everything in it? This cannot be undone.",
  "nutri.invalidNutrition": "Enter valid non-negative nutrition values.",
  "nutri.invalidTarget": "Enter a daily kcal target greater than zero.",
  "nutri.invalidProteinTarget":
    "Enter a daily protein target greater than zero.",
  "nutri.invalidQuantity": "Enter a valid quantity greater than zero.",
  "nutri.invalidUnit": "Choose a valid unit.",
  "nutri.mealFallback": "Meal",
  "nutri.createPlanError": "The nutrition plan could not be created.",
  "nutri.saveMealError": "A meal could not be saved.",
  "nutri.dailyTarget": "Daily kcal target",
  "nutri.dailyProteinTarget": "Daily protein target",
  "nutri.dailyTotal": "Daily total",
  "nutri.quantity": "Quantity",
  "nutri.unit": "Unit",
  "nutri.unit.g": "g",
  "nutri.unit.ml": "ml",
  "nutri.unit.piece": "piece",
  "nutri.unit.piecePlural": "pieces",
  "nutri.unit.scoop": "scoop",
  "nutri.unit.scoopPlural": "scoops",
  "nutri.unit.tbsp": "tbsp",
  "nutri.unit.tsp": "tsp",
  "nutri.unit.cup": "cup",
  "nutri.unit.cupPlural": "cups",
  "nutri.calculatedNutrition": "Calculated nutrition",
  "nutri.manualOverride": "Manual override",
  "nutri.clearOverride": "Use calculated values",
  "nutri.overrideHint": "These values stay fixed when quantity changes.",
  "nutri.needsGramEquivalent":
    "Add a gram equivalent to this food-library entry to calculate this quantity.",
  "nutri.incompatibleUnits": "These serving units cannot be converted safely.",
  "nutri.missingServing":
    "Add a serving quantity and unit to this food-library entry.",
  "nutri.missingNutrition":
    "Add nutrition values to this food-library entry.",
  "nutri.legacyPortion": "Legacy portion: {portion}",
  "nutri.macrosForPortion": "Nutrition for this portion",
  "nutri.mealTotal": "Meal total",
  "nutri.trackedTotal": "Partial total",
  "nutri.kcal": "kcal",
  "nutri.protein": "Protein",
  "nutri.carbs": "Carbs",
  "nutri.fat": "Fat",
  "nutri.proteinShort": "P",
  "nutri.carbsShort": "C",
  "nutri.fatShort": "F",
  "nutri.managePlan": "Nutrition plan",
  "nutri.mealPreset.breakfast": "Breakfast",
  "nutri.mealPreset.lunch": "Lunch",
  "nutri.mealPreset.dinner": "Dinner",
  "nutri.mealPreset.snack": "Snack",
  "toast.nutritionSaved": "Nutrition plan saved",
  "toast.nutritionDeleted": "Nutrition plan deleted",

  // Nutrition — client-facing
  "nutriClient.card": "Nutrition",
  "nutriClient.empty": "No nutrition plan yet",
  "nutriClient.emptyHint": "Alişan will add one if it's part of your plan.",
  "nutriClient.heading": "Nutrition",
  "nutriClient.subtitle": "Your current nutrition plan.",
  "nutriClient.emptyFull": "You don't have a nutrition plan yet.",
  "nutriClient.emptyFullHint":
    "Alişan will add one when it's part of your plan.",
  "nutriClient.notesFrom": "Notes from Alişan",
  "nutriClient.viewPlan": "View plan",
  "nutriClient.eyebrow": "Your nutrition",
  "nutriClient.dailySummary": "Daily nutrition",
  "nutriClient.dailyTotal": "Daily total",
  "nutriClient.dailyTarget": "Daily target",
  "nutriClient.proteinTarget": "Protein target",
  "nutriClient.mealTotal": "Meal total",
  "nutriClient.trackedTotal": "Partial total",
  "nutriClient.emptyMeal": "No foods in this meal",
  "nutriClient.emptyMealHint": "Your coach can add foods when the plan is updated.",
  "nutriClient.kcal": "kcal",
  "nutriClient.protein": "Protein",
  "nutriClient.carbs": "Carbs",
  "nutriClient.fat": "Fat",
  "nutriClient.proteinShort": "P",
  "nutriClient.carbsShort": "C",
  "nutriClient.fatShort": "F",
  "profile.accountEyebrow": "Account settings",
  "progress.eyebrow": "Progress",
  "progress.title": "See the trend, not just one number.",
  "progress.body":
    "Add measurements, review your history and use weight or BMI as one part of the wider coaching picture.",

  // Mobile navigation (hamburger drawer)
  "nav.menu": "Menu",
  "nav.closeMenu": "Close menu",
  "nav.home": "Home",
  "nav.me": "Me",

  // PDF export (button + generated document)
  "export.pdf": "Save as PDF",
  "export.chooseLanguage": "PDF language",
  "export.generating": "Generating…",
  "export.failed": "Could not generate the PDF. Please try again.",
  "pdf.program": "Training Program",
  "pdf.preparedBy": "Prepared by {name}",
  "pdf.tagline": "Personal training & physiotherapy",
  "pdf.watchVideo": "Watch on YouTube",

  // Availability — nav + staff area
  "nav.availability": "Availability",
  "avail.staffHeading": "Availability",
  "avail.staffSubtitle":
    "Ask clients when they're free, then arrange the sessions yourself.",
  "avail.week": "Week",
  "avail.sendHeading": "Send a request",
  "avail.sendSubtitle": "Pick a week and ask clients when they're free.",
  "avail.sendAllActive": "Send to all active clients",
  "avail.sendAllActiveCount": "Send to all {n} active clients",
  "avail.sendSelected": "Send to selected",
  "avail.sendSelectedCount": "Send to {n} selected",
  "avail.selectClients": "Or pick individual clients",
  "avail.selectClientsHint":
    "Sending again for the same week is safe — clients already asked are skipped.",
  "avail.noActiveClients": "No clients yet — add clients first.",
  "avail.activeBadge": "Active",
  "avail.inactiveBadge": "Inactive",
  "avail.sending": "Sending…",
  "avail.responsesHeading": "Responses",
  "avail.responsesSubtitle": "What each client submitted for {range}.",
  "avail.noRequests": "No requests sent for this week yet.",
  "avail.responded": "Responded",
  "avail.notResponded": "Not responded yet",
  "avail.requestedOn": "Asked {date}",
  "toast.availabilitySent": "Requests sent",

  // Availability — client form
  "avail.clientHeading": "Your availability",
  "avail.clientSubtitle": "Let Alişan know when you're free for {range}.",
  "avail.clientIntro": "Tick the days you're free and add a time range.",
  "avail.available": "I'm available",
  "avail.from": "From",
  "avail.to": "To",
  "avail.timePlaceholderFrom": "e.g. 18:00",
  "avail.timePlaceholderTo": "e.g. 20:00",
  "avail.dayNote": "Note",
  "avail.dayNotePlaceholder": "e.g. after work, mornings only…",
  "avail.submit": "Submit availability",
  "avail.update": "Update availability",
  "avail.submittedBadge": "Submitted",
  "avail.submittedHint": "You can edit and resend anytime.",
  "avail.emptyTitle": "No availability request right now",
  "avail.emptyBody": "Alişan will ask when he needs to schedule sessions.",
  "schedule.eyebrow": "Schedule",
  "schedule.body": "Your sessions, booking options and appointment history.",
  "schedule.nav": "Schedule",
  "schedule.metaTitle": "Schedule",
  "schedule.clientTitle": "Your schedule",
  "schedule.clientBody":
    "Book a published time or propose one that works for you, then keep every appointment in one place.",
  "schedule.nextEyebrow": "Up next",
  "schedule.nextAppointment": "Next appointment",
  "schedule.noNextTitle": "No upcoming appointment",
  "schedule.noNextBody": "Your next confirmed or pending session will appear here.",
  "schedule.noAppointments": "No appointments yet",
  "schedule.noAppointmentsBody": "Book or propose a time from your schedule.",
  "schedule.viewSchedule": "View schedule",
  "schedule.appointmentFallbackTitle": "Coaching session",
  "schedule.duration": "{n} min",
  "schedule.durationLabel": "Duration (minutes)",
  "schedule.durationMinutes": "{n} min",
  "schedule.status.pending": "Pending",
  "schedule.status.confirmed": "Confirmed",
  "schedule.status.cancelled": "Cancelled",
  "schedule.status.completed": "Completed",
  "schedule.joinMeeting": "Join meeting",
  "schedule.meetingWindowHint":
    "The secure meeting link appears 30 minutes before a confirmed session.",
  "schedule.cancelAction": "Cancel appointment",
  "schedule.cancelHeading": "Cancel this appointment?",
  "schedule.cancelBody":
    "It will remain in your history and your coach will be notified.",
  "schedule.cancelReason": "Reason (optional)",
  "schedule.cancelReasonLabel": "Cancellation reason",
  "schedule.cancelReasonPlaceholder": "Add a short explanation if helpful…",
  "schedule.confirmCancel": "Cancel appointment",
  "schedule.cancelling": "Cancelling…",
  "schedule.cancelledToast": "Appointment cancelled",
  "schedule.timezonePromptTitle": "Confirm your time zone",
  "schedule.timezonePromptBody":
    "Times are currently shown in {zone}. Save your time zone in your profile before proposing a time.",
  "schedule.setTimezone": "Set time zone",
  "schedule.viewerZone": "Shown in {zone}",
  "schedule.pendingProposalsTitle": "Proposal awaiting review",
  "schedule.pendingProposalsBody":
    "Alişan will accept one of these times or let you know if another time is needed.",
  "schedule.calendarTitle": "Appointment calendar",
  "schedule.previousMonth": "Previous month",
  "schedule.nextMonth": "Next month",
  "schedule.calendarDaySlots": "{date}: {n} open times",
  "schedule.slotModeBody": "Choose an open time published by Alişan.",
  "schedule.proposalModeBody": "Choose a day, then propose one or more suitable times.",
  "schedule.availableTimes": "Available times for {date}",
  "schedule.noSlotsTitle": "No open times on this day",
  "schedule.noSlotsBody": "Choose another highlighted day or check again later.",
  "schedule.noSlotsPublishedTitle": "No times published yet",
  "schedule.noSlotsPublishedBody":
    "Alişan has not published an open time for this month. Check another month or come back later.",
  "schedule.bookSlot": "Book",
  "schedule.booking": "Booking…",
  "schedule.slotBookedToast": "Time requested — awaiting confirmation",
  "schedule.proposalDate": "Option {n}: date",
  "schedule.proposalTime": "Time",
  "schedule.addProposal": "Add another time",
  "schedule.removeProposal": "Remove proposed time",
  "schedule.proposalNote": "Note (optional)",
  "schedule.proposalNotePlaceholder": "Anything Alişan should consider…",
  "schedule.sendProposals": "Send proposed times",
  "schedule.proposalsSending": "Sending…",
  "schedule.proposalsSentToast": "{n} proposed times sent",
  "schedule.laterAppointments": "Later appointments",
  "schedule.historyTitle": "Appointment history",
  "schedule.noHistoryTitle": "No past appointments",
  "schedule.noHistoryBody": "Completed and cancelled sessions will stay here.",

  // Scheduling — coach panel
  "schedule.adminEyebrow": "Scheduling",
  "schedule.adminTitle": "Appointments and availability",
  "schedule.adminBody":
    "Publish, review and manage sessions. Coach-facing times use {timezone}.",
  "schedule.previousWeek": "Previous week",
  "schedule.nextWeek": "Next week",
  "schedule.settingsTitle": "Booking settings",
  "schedule.settingsBody":
    "Choose the active client flow without changing existing appointments.",
  "schedule.mode": "Booking mode",
  "schedule.mode.coachSlots": "Coach publishes times",
  "schedule.mode.clientProposal": "Clients propose times",
  "schedule.defaultDuration": "Default duration (minutes)",
  "schedule.coachTimezone": "Coach time zone",
  "schedule.saveSettings": "Save settings",
  "schedule.weekTitle": "Week view",
  "schedule.weekBody": "Slots and appointments in {timezone}.",
  "schedule.dayEmpty": "Nothing scheduled",
  "schedule.slotStatus.open": "Open",
  "schedule.slotStatus.booked": "Booked",
  "schedule.slotStatus.closed": "Closed",
  "schedule.closeSlot": "Close time",
  "schedule.reopenSlot": "Reopen time",
  "schedule.publishTitle": "Publish availability",
  "schedule.publishBody":
    "Add one or more local times in {timezone}; weekly repeats keep the same wall-clock time across DST.",
  "schedule.publishInactiveMode":
    "Published times are preserved, but clients cannot book them while proposal mode is active.",
  "schedule.firstDate": "First date",
  "schedule.repeatWeeks": "Repeat for weeks",
  "schedule.slotNumber": "Time {n}",
  "schedule.time": "Time",
  "schedule.slotNote": "Public note (optional)",
  "schedule.slotNotePlaceholder": "e.g. online session",
  "schedule.removeSlot": "Remove time",
  "schedule.addAnotherTime": "Add another time",
  "schedule.publish": "Publish times",
  "schedule.publishing": "Publishing…",
  "schedule.directTitle": "Create an appointment directly",
  "schedule.directBody": "Enter the appointment in {timezone}; the client sees it locally.",
  "schedule.client": "Client",
  "schedule.date": "Date",
  "schedule.agenda": "Agenda",
  "schedule.meetingUrl": "Meeting URL",
  "schedule.coachNote": "Private coach note",
  "schedule.createAppointment": "Create confirmed appointment",
  "schedule.noClients": "Add a client before creating an appointment.",
  "schedule.unnamedClient": "Unnamed client",
  "schedule.clientLocalTime": "Client: {time}",
  "schedule.pendingTitle": "Pending queue",
  "schedule.pendingBody":
    "Bookings and proposals remain here regardless of the active mode.",
  "schedule.pendingEmpty": "Nothing needs a decision.",
  "schedule.pendingBookings": "Bookings ({n})",
  "schedule.pendingProposals": "Proposals ({n})",
  "schedule.noPendingBookings": "No pending bookings.",
  "schedule.noPendingProposals": "No pending proposals.",
  "schedule.confirm": "Confirm",
  "schedule.decline": "Decline",
  "schedule.accept": "Accept",
  "schedule.declineReason": "Decline note (optional)",
  "schedule.declineReasonPlaceholder": "Optional reason for declining…",
  "schedule.saveDetails": "Save appointment details",
  "schedule.cancelAppointment": "Cancel appointment",
  "schedule.toast.settingsSaved": "Scheduling settings saved",
  "schedule.toast.slotsPublished": "{n} times published",
  "schedule.toast.slotClosed": "Time closed",
  "schedule.toast.slotOpened": "Time reopened",
  "schedule.toast.appointmentCreated": "Appointment created",
  "schedule.toast.detailsSaved": "Appointment details saved",
  "schedule.toast.cancelled": "Appointment cancelled",
  "schedule.toast.confirmed": "Appointment confirmed",
  "schedule.toast.declined": "Booking declined and time reopened",
  "schedule.toast.proposalAccepted": "Proposal accepted",
  "schedule.toast.proposalDeclined": "Proposal declined",
  "schedule.err.settingsInvalid": "Check the mode, duration and IANA time zone.",
  "schedule.err.slotInvalid": "Check the date, times, duration and repeat count.",
  "schedule.err.appointmentInvalid": "Check the client, date, time and duration.",
  "schedule.err.clientInvalid": "Choose a valid client.",
  "schedule.err.meetingUrl": "Meeting links must be complete https URLs.",
  "schedule.err.pastTime": "Choose a future time.",
  "schedule.err.dstGap": "That local time does not exist because of a daylight-saving change.",
  "schedule.err.dstAmbiguous":
    "That local time occurs twice because of a daylight-saving change. Choose another time.",
  "schedule.err.slotTaken": "That time was just taken. Please choose another.",
  "schedule.err.proposalDecided": "That proposal has already been decided.",
  "schedule.err.saveFailed": "The scheduling change could not be saved. Please try again.",
  "err.scheduleInvalid": "Check the scheduling details and try again.",
  "err.scheduleWrongMode": "The booking mode changed. Refresh and try again.",
  "err.scheduleSlotTaken": "That time was just taken. Please choose another.",
  "err.scheduleSave": "Your scheduling request could not be saved.",
  "err.scheduleTimezoneRequired": "Save your time zone in your profile first.",
  "err.scheduleInvalidTime": "Choose a valid date and time.",
  "err.scheduleAmbiguousTime":
    "That local time occurs twice because of a daylight-saving change. Choose another.",
  "err.scheduleNonexistentTime":
    "That local time does not exist because of a daylight-saving change.",
  "err.schedulePastTime": "Choose a future time.",
  "err.scheduleDuplicateTime": "Each proposed time must be different.",
  "err.scheduleCancel": "The appointment could not be cancelled.",
  "err.timezoneInvalid": "Enter a valid IANA time zone.",
  "toast.availabilitySaved": "Availability saved",

  // Availability — client dashboard entry point
  "avail.card": "Availability",
  "avail.cardPending": "Alişan asked when you're free",

  // Availability — notification (staff-sent) + bell category
  "notif.cat.availability": "Availability request",
  "notif.cat.appointment_reminder": "Appointment reminder",
  "notif.cat.appointment_cancelled": "Appointment update",
  "notif.availability.title": "When are you free?",
  "notif.availability.body": "Alişan wants your availability for {range}.",

  // Availability — errors
  "err.availWeek": "Pick a valid week.",
  "err.availNoClients": "Select at least one client.",
  "err.availNoRequest": "There's no availability request for this week.",
};

const tr: Dict = {
  // Common
  "common.signOut": "Çıkış yap",
  "common.cancel": "İptal",
  "common.save": "Kaydet",
  "common.edit": "Düzenle",
  "common.delete": "Sil",
  "common.saving": "Kaydediliyor…",
  "common.optional": "(isteğe bağlı)",

  // Login
  "login.metaTitle": "Giriş yap",
  "login.tagline": "Programlarınız, tek bir yerde",
  "login.heading": "Hesabınıza giriş yapın",
  "login.email": "E-posta",
  "login.password": "Şifre",
  "login.submit": "Giriş yap",
  "login.submitting": "Giriş yapılıyor…",
  "login.error": "E-posta veya şifre hatalı. Lütfen tekrar deneyin.",
  "login.helper":
    "Hesaplar uzmanınız tarafından oluşturulur. Erişim için Alişan ile iletişime geçin.",

  // Client dashboard
  "dash.welcomeName": "Tekrar hoş geldiniz, {name}",
  "dash.welcome": "Tekrar hoş geldiniz",
  "dash.subtitleClient": "Bu haftaki programınız burada.",
  "dash.subtitleAdmin": "Yönetici olarak giriş yaptınız.",
  "dash.thisWeek": "Bu hafta",
  "dash.pastPrograms": "Geçmiş programlar",
  "dash.upcomingPrograms": "Yaklaşan programlar",
  "dash.noThisWeekTitle": "Bu hafta için henüz bir program yok",
  "dash.noThisWeekBody": "Alişan yakında bir sonraki programınızı ekleyecek.",
  "dash.clientFallback": "Danışan",
  "dash.coachLine": "Koç: {name}",
  "dash.coachingSince": "{date} tarihinden beri koçluk alıyor",
  "dash.avatarLabel": "{name} için baş harfler",
  "dash.navigationLabel": "Danışan paneli",
  "dash.tab.overview": "Genel Bakış",
  "dash.tab.programme": "Program",
  "dash.tab.nutrition": "Beslenme",
  "dash.tab.progress": "İlerleme",
  "dash.tab.schedule": "Takvim",
  "dash.overviewEyebrow": "Koçluk planınız",
  "dash.overviewBody":
    "Bu haftanın genel görünümü ve sıradaki koçluk adımı burada.",
  "dash.metric.trainingDays": "Bu haftaki antrenman günleri",
  "dash.metric.exercises": "Bu haftaki egzersizler",
  "dash.metric.meals": "Planınızdaki öğünler",
  "dash.metric.measurements": "İlerleme kayıtları",
  "dash.programmeReadyBody": "Programınız görüntülenmeye hazır.",
  "dash.openProgramme": "Programı aç",
  "dash.appointmentEyebrow": "Sıradaki randevu",
  "dash.appointmentTitle": "Sıradaki koçluk seansınız",
  "dash.noAppointmentTitle": "Henüz kayıtlı bir randevu yok",
  "dash.noAppointmentBody":
    "Seanslar doğrudan planlanır. Alişan uygunluğunuzu istediğinde talep Takvim bölümünde görünür.",
  "dash.coachNoteEyebrow": "Koç notu",
  "dash.coachNoteTitle": "Bu hafta için not",
  "dash.noCoachNoteTitle": "Henüz koç notu yok",
  "dash.noCoachNoteBody": "Alişan'ın programa eklediği not burada görünür.",
  "dash.checkInEyebrow": "Haftalık değerlendirme",
  "dash.checkInTitle": "Haftayı değerlendirin",
  "dash.checkInBody": "Bu antrenman haftasının nasıl geçtiğini paylaşın veya kaydınızı güncelleyin.",
  "dash.noCheckInBody": "Sıradaki değerlendirme, aktif bir program haftasıyla birlikte görünür.",
  "dash.programmeEyebrow": "Antrenman programı",
  "dash.programmeTitle": "Tüm antrenman haftalarınız tek bir yerde.",
  "dash.programmeBody":
    "Güncel programınızı açın, sonraki haftalara bakın veya geçmiş bir haftayı ve değerlendirmesini yeniden inceleyin.",

  // Buckets / lists
  "bucket.upcoming": "Yaklaşan",
  "bucket.past": "Geçmiş",
  "list.pastTitle": "Geçmiş programlar",
  "list.pastSubtitle": "Önceki haftalarınız, en yeniden eskiye.",
  "list.upcomingTitle": "Yaklaşan programlar",
  "list.upcomingSubtitle": "Sırada ne var, en yakından uzağa.",
  "list.backToThisWeek": "Bu haftaya dön",
  "list.emptyPast": "Henüz geçmiş program yok.",
  "list.emptyUpcoming": "Henüz planlanmış bir şey yok.",

  // Program detail (client)
  "prog.back": "Panoya dön",
  "prog.notesFrom": "Alişan'dan notlar",
  "prog.exercises": "Egzersizler",
  "prog.watchDemo": "Videoyu izle",
  "prog.noExercises": "Bu programda henüz egzersiz yok.",
  "prog.day": "{n}. Gün",

  // Effort line
  "effort.setsReps": "{sets} set × {reps}",
  "effort.sets": "{sets} set",

  // Admin — header / nav
  "admin.clients": "Danışanlar",
  "admin.library": "Kütüphane",
  "admin.refresh": "Verileri yenile",

  // Admin — clients list
  "admin.newClient": "Yeni danışan",
  "admin.searchClients": "Ad veya kullanıcı adına göre ara…",
  "admin.addName": "Ad ekle",
  "admin.noClients": "Henüz danışan yok. İlk danışanınızı ekleyin.",
  "admin.noClientMatches": "Aramanızla eşleşen danışan yok.",

  // Admin — users list (3 tabs)
  "admin.usersHeading": "Kullanıcılar",
  "admin.tabAdmins": "Yöneticiler",
  "admin.tabManagers": "Sorumlular",
  "admin.tabClients": "Danışanlar",
  "admin.searchUsers": "Ad veya e-postaya göre ara…",
  "admin.noneInGroup": "Bu grupta henüz kimse yok.",
  "admin.noUserMatches": "Aramanızla eşleşen sonuç yok.",

  // Admin — assessment requests
  "requests.nav": "Talepler",
  "requests.metaTitle": "Değerlendirme talepleri",
  "requests.heading": "Değerlendirme talepleri",
  "requests.subtitle": "Yeni başvuruları inceleyin ve her görüşmenin durumunu takip edin.",
  "requests.filterAll": "Tümü",
  "requests.status.new": "Yeni",
  "requests.status.contacted": "İletişime geçildi",
  "requests.status.accepted": "Kabul edildi",
  "requests.status.declined": "Reddedildi",
  "requests.created": "Alınma tarihi",
  "requests.name": "Ad",
  "requests.email": "E-posta",
  "requests.phone": "Telefon",
  "requests.country": "Ülke",
  "requests.city": "Şehir",
  "requests.plan": "Plan",
  "requests.status": "Durum",
  "requests.view": "Talebi görüntüle",
  "requests.empty": "Bu görünümde değerlendirme talebi yok.",
  "requests.back": "Taleplere dön",
  "requests.contactGroup": "İletişim",
  "requests.profileGroup": "Beden ve hedef",
  "requests.trainingGroup": "Antrenman",
  "requests.healthGroup": "Sağlık bağlamı",
  "requests.contextGroup": "Talep bağlamı",
  "requests.fullName": "Ad soyad",
  "requests.preferredLanguage": "Tercih edilen dil",
  "requests.language.en": "İngilizce",
  "requests.language.tr": "Türkçe",
  "requests.birthYear": "Doğum yılı",
  "requests.approxAge": "Yaklaşık yaş",
  "requests.sex": "Cinsiyet",
  "requests.height": "Boy",
  "requests.weight": "Kilo",
  "requests.bmi": "VKİ",
  "requests.primaryGoal": "Ana hedef",
  "requests.experience": "Antrenman deneyimi",
  "requests.days": "Haftalık gün sayısı",
  "requests.equipment": "Ekipman erişimi",
  "requests.injury": "Sakatlık veya ağrı geçmişi",
  "requests.medical": "Tıbbi notlar",
  "requests.message": "Ziyaretçi notu",
  "requests.reviewedAt": "Son değerlendirme",
  "requests.notProvided": "Belirtilmedi",
  "requests.copyEmail": "E-posta adresini kopyala",
  "requests.copied": "E-posta kopyalandı",
  "requests.copyFailed": "E-posta adresi kopyalanamadı.",
  "requests.workflowHeading": "İş akışı",
  "requests.workflowSubtitle": "Durumu güncelleyin veya özel bir not tutun.",
  "requests.updateStatus": "Durumu güncelle",
  "requests.updating": "Güncelleniyor…",
  "requests.adminNote": "Özel yönetici notu",
  "requests.adminNotePlaceholder": "Görüşme notları, takip bilgileri veya sonraki adımlar…",
  "requests.saveNote": "Notu kaydet",
  "requests.noteSaved": "Not kaydedildi",
  "requests.statusSaved": "Durum güncellendi",
  "requests.saveError": "Talep güncellenemedi. Lütfen yeniden deneyin.",

  // Roles
  "role.admin": "Yönetici",
  "role.manager": "Sorumlu",
  "role.client": "Danışan",

  // Admin — client detail
  "admin.allClients": "Tüm danışanlar",
  "admin.manage": "Yönet",
  "admin.resetPassword": "Şifre sıfırla",
  "admin.newProgram": "Yeni program",
  "admin.emptyCurrent": "Bu hafta için program yok.",
  "admin.emptyUpcoming": "Planlanmış bir şey yok.",
  "admin.emptyPast": "Geçmiş program yok.",

  // New program menu + copy modal
  "menu.startBlank": "Boştan başla",
  "menu.startBlankSub": "Yeni, boş bir program.",
  "menu.copyPrev": "Önceki haftadan kopyala",
  "menu.copyPrevSub": "Bir programın günlerini ve egzersizlerini çoğaltın.",
  "copy.title": "Önceki bir programdan kopyala",
  "copy.subtitle":
    "Günlerini ve egzersizlerini yeni bir programa kopyalamak için bir hafta seçin.",
  "copy.empty": "Kopyalanacak önceki program yok.",
  "copy.startInstead": "Bunun yerine boştan başla",

  // Program editor
  "editor.newHeading": "Yeni program",
  "editor.editHeading": "Programı düzenle",
  "editor.backToClient": "Danışana dön",
  "editor.week": "Hafta",
  "editor.title": "Başlık",
  "editor.titleHint": "(otomatik dolar, düzenlenebilir)",
  "editor.notes": "Notlar",
  "editor.notesPlaceholder": "Haftaya dair bir not…",
  "editor.titlePlaceholder": "4 Ağu 2026 Haftası",
  "editor.hasProgram": "· programı var",
  "editor.dayLabel": "{n}. Gün",
  "editor.dayPlaceholder":
    "örn. Göğüs Günü, Bacak Günü, Diz Rehabilitasyonu — basit liste için boş bırakın",
  "editor.addDay": "Gün ekle",
  "editor.addExercise": "Egzersiz ekle",
  "editor.sets": "Set",
  "editor.reps": "Tekrar",
  "editor.instructions": "Bu hafta için talimatlar (isteğe bağlı)",
  "editor.mediaUrl": "Medya URL (isteğe bağlı) — demo video veya görsel",
  "editor.videoOverride": "Videoyu değiştir (isteğe bağlı)",
  "editor.linkedNote": "▶ Kütüphaneye bağlı — demo video oradan gelir.",
  "editor.saveToLibrary": "Tekrar kullanmak için kütüphaneme de kaydet",
  "editor.saveProgram": "Programı kaydet",
  "editor.deleteProgram": "Programı sil",
  "editor.alreadyInDay": "Bu güne zaten eklendi",
  "editor.confirmDeleteDay":
    "Bu gün ve egzersizleri silinsin mi? Bu işlem geri alınamaz.",
  "editor.confirmDeleteProgram":
    "Bu program ve içindeki her şey silinsin mi? Bu işlem geri alınamaz.",
  "editor.moveUp": "Yukarı taşı",
  "editor.moveDown": "Aşağı taşı",
  "editor.remove": "Kaldır",
  "editor.moveDayUp": "Günü yukarı taşı",
  "editor.moveDayDown": "Günü aşağı taşı",
  "editor.deleteDay": "Günü sil",

  // Library combobox
  "combo.search": "Kütüphanede ara veya yeni bir ad yaz…",
  "combo.addNew": "“{q}” adını yeni egzersiz olarak ekle",
  "combo.noMatches": "Kütüphanede eşleşme yok.",
  "combo.linked": "bağlı",
  "combo.video": "video",

  // Library manager
  "lib.heading": "Egzersiz kütüphanesi",
  "lib.summary": "{n} egzersiz · {m} tanesinde video var",
  "lib.newExercise": "Yeni egzersiz",
  "lib.search": "Egzersiz ara…",
  "lib.hasVideo": "▶ Video",
  "lib.noVideo": "Video yok",
  "lib.preview": "▶ Önizleme",
  "lib.previewAria": "{name} önizlemesi",
  "lib.empty": "Kütüphane boş. İlk egzersizinizi ekleyin.",
  "lib.noMatches": "Aramanızla eşleşen egzersiz yok.",
  "lib.name": "Ad",
  "lib.youtubeUrl": "YouTube URL",
  "lib.defaultInstructions": "Varsayılan talimatlar",
  "lib.defaultInstructionsPlaceholder":
    "Bu egzersiz seçildiğinde gösterilecek bir hatırlatma.",
  "lib.enterValidUrl": "Önizleme için geçerli bir YouTube bağlantısı girin.",
  "lib.confirmDelete": "“{name}” kütüphaneden silinsin mi?",
  "lib.noValidVideo": "Bu egzersiz için geçerli bir video yok.",
  "lib.editHeading": "Egzersizi düzenle",
  "lib.newHeading": "Yeni egzersiz",

  // Exercise categories
  "cat.heading": "Kategoriler",
  "cat.all": "Tümü",
  "cat.add": "Kategori ekle",
  "cat.namePlaceholder": "Kategori adı",
  "cat.create": "Ekle",
  "cat.rename": "Yeniden adlandır",
  "cat.renameHeading": "Kategoriyi yeniden adlandır",
  "cat.save": "Kaydet",
  "cat.delete": "Kategoriyi sil",
  "cat.confirmDelete":
    "“{name}” kategorisi silinsin mi? Egzersizler kalır — yalnızca kategori ve etiketleri kaldırılır.",
  "cat.defaultLocked":
    "Varsayılan kategoriler yeniden adlandırılamaz veya silinemez.",
  "cat.assignLabel": "Kategoriler",
  "cat.assignHint": "Bu egzersizi bir veya daha fazla kategoriyle etiketleyin.",
  "cat.none": "Kategorisiz",
  "cat.emptyGrid": "Bu kategoride henüz egzersiz yok.",
  "toast.categoryAdded": "Kategori eklendi",
  "toast.categoryUpdated": "Kategori güncellendi",
  "toast.categoryDeleted": "Kategori silindi",

  // Modals — new client
  "newClient.heading": "Yeni danışan",
  "newClient.subtitle": "Hemen kullanabilecekleri bir giriş oluşturur.",
  "newClient.fullName": "Ad soyad",
  "newClient.username": "Kullanıcı adı / e-posta",
  "newClient.usernameHint":
    "Gerçek bir e-posta ya da name@alisanphysio.local gibi geçerli-ama-sahte bir adres olabilir — gelen kutusu gerekmez.",
  "newClient.initialPassword": "İlk şifre",
  "newClient.passwordHint": "En az 8 karakter.",
  "newClient.create": "Danışan oluştur",
  "newClient.creating": "Oluşturuluyor…",

  // Modal — manage client
  "manage.heading": "Danışanı yönet",
  "manage.subtitle": "Bu danışanın adını ve girişini düzenleyin.",
  "manage.fullName": "Ad soyad",
  "manage.email": "E-posta / kullanıcı adı",
  "manage.emailHint":
    "name@alisanphysio.local gibi geçerli-ama-sahte bir adres olabilir.",
  "manage.save": "Değişiklikleri kaydet",

  // Modal — reset password
  "reset.heading": "Şifre sıfırla",
  "reset.subtitle": "Yeni bir şifre belirleyin ve danışanla paylaşın.",
  "reset.newPassword": "Yeni şifre",
  "reset.confirm": "Şifreyi onayla",
  "reset.update": "Şifreyi güncelle",
  "reset.updating": "Güncelleniyor…",
  "reset.tooShort": "Şifre en az 8 karakter olmalı.",
  "reset.mismatch": "Şifreler eşleşmiyor.",

  // Language field
  "lang.label": "Dil",
  "lang.en": "English",
  "lang.tr": "Türkçe",

  // Theme toggle
  "theme.toDark": "Koyu moda geç",
  "theme.toLight": "Açık moda geç",
  "theme.toggle": "Renk temasını değiştir",

  // Staff nav — personal program view
  "nav.personalExercises": "Kendi Programım",
  "nav.adminPanel": "Yönetim",
  "nav.templates": "Taslaklar",

  // Day templates
  "tpl.heading": "Gün taslakları",
  "tpl.subtitle":
    "Yeniden kullanılabilir gün planları — bir kez oluştur, herhangi bir programa ekle.",
  "tpl.new": "Yeni taslak",
  "tpl.empty": "Henüz taslak yok. İlk gün planınızı oluşturun.",
  "tpl.newHeading": "Yeni taslak",
  "tpl.editHeading": "Taslağı düzenle",
  "tpl.backToList": "Tüm taslaklar",
  "tpl.titleLabel": "Taslak başlığı",
  "tpl.titlePlaceholder": "örn. İtiş Günü, Bacak Günü, Diz Rehabilitasyonu",
  "tpl.exercisesHeading": "Egzersizler",
  "tpl.save": "Taslağı kaydet",
  "tpl.delete": "Taslağı sil",
  "tpl.confirmDelete":
    "Bu taslak silinsin mi? Bu işlem geri alınamaz. Ondan oluşturulmuş programlar etkilenmez.",
  "tpl.addFromTemplate": "Taslaktan ekle",
  "tpl.addDayFromTemplate": "Taslaktan gün ekle",
  "tpl.overwriteWarn":
    "Bu günde zaten egzersizler var. Buraya taslak uygulamak onların üzerine yazar — bunun yerine yeni bir gün olarak ekleyin.",
  "tpl.addAsNewDay": "Yeni gün olarak ekle",
  "tpl.noTemplatesHint": "Henüz taslak yok —",
  "tpl.createOne": "bir tane oluşturun",
  "toast.templateSaved": "Taslak kaydedildi",
  "toast.templateDeleted": "Taslak silindi",

  // Weekly-review indicators + inline add-review
  "review.submitted": "Değerlendirme gönderildi",
  "review.add": "Değerlendirme ekle",

  // Notification categories (bell panel)
  "notif.cat.measurement": "Ölçüm talebi",
  "notif.cat.feedback": "Değerlendirme talebi",
  "notif.cat.other": "Diğer",

  // Toasts
  "toast.programSaved": "Program kaydedildi",
  "toast.programDeleted": "Program silindi",
  "toast.clientCreated": "Danışan oluşturuldu",
  "toast.clientUpdated": "Danışan güncellendi",
  "toast.clientDeleted": "Danışan silindi",
  "toast.roleUpdated": "Rol güncellendi",
  "toast.passwordUpdated": "Şifre güncellendi",
  "toast.exerciseAdded": "Egzersiz eklendi",
  "toast.exerciseSaved": "Egzersiz kaydedildi",
  "toast.exerciseDeleted": "Egzersiz silindi",
  "toast.profileSaved": "Profil güncellendi",
  "toast.measurementAdded": "Ölçüm eklendi",
  "toast.measurementDeleted": "Ölçüm silindi",
  "toast.noteAdded": "Not eklendi",
  "toast.noteDeleted": "Not silindi",

  // Client Profile — header link + page chrome
  "profile.link": "Profilim",
  "profile.heading": "Profilim",
  "profile.subtitle": "Hesap bilgileriniz, şifreniz ve Alişan'a ilettiğiniz notlar.",
  "profile.clientDataHeading": "Danışan verileri",
  "profile.clientDataSubtitle": "{name} adlı danışanın gördüğü salt-okunur görünüm.",

  // Profile — personal info
  "profile.personalHeading": "Kişisel bilgiler",
  "profile.fullName": "Ad soyad",
  "profile.height": "Boy (cm)",
  "profile.heightHint": "Vücut kitle indeksinizi (VKİ) hesaplamak için kullanılır.",
  "profile.heightUnset": "Belirtilmemiş",
  "profile.timezone": "Saat dilimi",
  "profile.timezoneUnset": "Belirtilmemiş",
  "profile.timezoneDetected": "Bu cihazdan algılandı: {timezone}",
  "profile.timezoneHint": "Europe/Istanbul gibi bir IANA saat dilimi kullanın.",
  "profile.email": "E-posta / kullanıcı adı",
  "profile.emailReadonlyHint":
    "Bu, giriş bilginizdir. Değiştirmek için Alişan'dan güncellemesini isteyin.",
  "profile.savePersonal": "Değişiklikleri kaydet",

  // Profile — change password
  "profile.passwordHeading": "Şifre değiştir",
  "profile.passwordSub": "Hesabınız için yeni bir şifre belirleyin.",
  "profile.newPassword": "Yeni şifre",
  "profile.confirmPassword": "Yeni şifreyi onayla",
  "profile.updatePassword": "Şifreyi güncelle",

  // Profile — measurements
  "profile.measurementsHeading": "Haftalık ölçümler",
  "profile.measurementsSub":
    "İlerlemenizi takip etmek için kilonuzu ve vücut ölçülerinizi kaydedin.",
  "profile.addMeasurement": "Ölçüm ekle",
  "profile.date": "Tarih",
  "profile.weight": "Kilo (kg)",
  "profile.waist": "Bel (cm)",
  "profile.hip": "Kalça (cm)",
  "profile.arm": "Kol (cm)",
  "profile.chest": "Göğüs (cm)",
  "profile.noMeasurements": "Henüz ölçüm yok. İlk ölçümünüzü yukarıdan ekleyin.",
  "profile.noMeasurementsReadonly": "Henüz kaydedilmiş ölçüm yok.",
  "profile.confirmDeleteMeasurement": "Bu ölçüm silinsin mi?",
  "profile.colWeight": "Kilo",
  "profile.colWaist": "Bel",
  "profile.colHip": "Kalça",
  "profile.colArm": "Kol",
  "profile.colChest": "Göğüs",

  // Profile — chart
  "profile.chartWeight": "Kilo",
  "profile.chartBmi": "VKİ",
  "profile.chartKg": "kg",
  "profile.bmiNeedsHeight": "VKİ eğilimini görmek için yukarıdan boyunuzu ekleyin.",
  "profile.bmiNeedsHeightReadonly": "Boy belirtilmediği için VKİ gösterilemiyor.",
  "profile.chartEmpty": "Eğiliminizi görmek için kilo içeren bir ölçüm ekleyin.",
  "profile.chartEmptyReadonly": "Henüz grafik için kilo verisi yok.",

  // Profile — complaints / notes
  "profile.complaintsHeading": "Şikayetler ve notlar",
  "profile.complaintsSub":
    "Alişan'a nasıl hissettiğinizi anlatın — ağrı ya da herhangi bir sorun.",
  "profile.complaintPlaceholder":
    "Nasıl hissediyorsunuz? Bu hafta ağrı ya da bir sorun var mı?",
  "profile.addNote": "Not ekle",
  "profile.noComplaints": "Henüz not yok.",
  "profile.noComplaintsReadonly": "Bu danışandan henüz not yok.",
  "profile.confirmDeleteComplaint": "Bu not silinsin mi?",

  // Admin — view client data
  "admin.viewData": "Danışan verilerini görüntüle",
  "admin.backToClient": "Danışana dön",

  // Measurement optional-field hints
  "profile.weightRequiredHint": "Zorunlu",
  "profile.optional": "opsiyonel",

  // BMI classification (WHO) — category names + neutral one-liners
  "bmi.title": "Vücut Kitle İndeksi",
  "bmi.value": "VKİ {value}",
  "bmi.underweight": "Referans aralığının altında",
  "bmi.normal": "Referans aralığında",
  "bmi.overweight": "Referans aralığının üzerinde",
  "bmi.obese": "Referans aralığının üzerinde",
  "bmi.note.underweight": "Referans aralığının altında.",
  "bmi.note.normal": "Referans aralığında.",
  "bmi.note.overweight": "Referans aralığının üzerinde.",
  "bmi.note.obese": "Referans aralığının üzerinde.",
  "bmi.basedOn": "En son ölçüme göre",
  "bmi.context":
    "VKİ, planlamadaki birçok göstergeden yalnızca biridir; antrenman geçmişiniz, gücünüz, enerji düzeyiniz ve nasıl hissettiğiniz de önemlidir.",

  // Membership
  "membership.label": "Üyelik",
  "membership.your": "Üyeliğiniz",
  "membership.none": "Üyelik tanımlı değil",
  "membership.optionNone": "Yok",
  "membership.endDate": "Üyelik bitiş tarihi",
  "membership.endDateHint": "İsteğe bağlı — süresiz için boş bırakın.",
  "membership.until": "{date} tarihine kadar geçerli",
  "membership.expired": "{date} tarihinde sona erdi",
  "membership.noExpiry": "Süresiz",

  // Membership-inactive (blocked) screen
  "inactive.title": "Üyeliğiniz aktif değil",
  "inactive.body":
    "Alişan sizin için aktif bir üyelik tanımlamadı. Başlamak için lütfen onunla iletişime geçin.",

  // Role (admin-only)
  "manage.role": "Rol",
  "manage.roleHint": "Rolleri yalnızca bir yönetici değiştirebilir.",

  // Delete client (admin, destructive)
  "manage.deleteClient": "Danışanı sil",
  "manage.deleteHeading": "Bu danışan silinsin mi?",
  "manage.deleteWarning":
    "Bu işlem danışanı ve tüm verilerini — programlar, ölçümler ve notlar — kalıcı olarak siler. Bu işlem geri alınamaz.",
  "manage.deleteConfirmCheck": "Bunun kalıcı olduğunu anlıyorum.",
  "manage.deleteConfirm": "Kalıcı olarak sil",
  "manage.deleting": "Siliniyor…",

  // Notifications — bell + panel
  "notif.aria": "Bildirimler",
  "notif.title": "Bildirimler",
  "notif.empty": "Her şey güncel.",
  "notif.markAllRead": "Tümünü okundu işaretle",
  "notif.justNow": "az önce",
  "notif.minutesAgo": "{n} dk önce",
  "notif.hoursAgo": "{n} sa önce",
  "notif.daysAgo": "{n} gün önce",

  // System notifications (generated on load)
  "notif.missingInfo.title": "Boyunuzu ekleyin",
  "notif.missingInfo.body":
    "Vücut kitle indeksinizi (VKİ) takip edebilmemiz için lütfen boyunuzu ekleyin.",
  "notif.expiry.titleSoon": "Üyeliğiniz yakında sona eriyor",
  "notif.expiry.titleEnded": "Üyeliğiniz sona erdi",
  "notif.expiry.body": "{date} tarihinde bitiyor — yenilemek için Alişan ile iletişime geçin.",
  "notif.review.title": "Haftalık değerlendirmeniz hazır",
  "notif.review.body": "Alişan'a geçen haftanın nasıl geçtiğini anlatın.",

  // Manual send (staff)
  "manage.sendNotification": "Bildirim gönder",
  "send.heading": "Bildirim gönder",
  "send.subtitle": "{name} adlı kullanıcının bildirim zilinde görünür.",
  "send.titleLabel": "Başlık",
  "send.bodyLabel": "Mesaj",
  "send.bodyPlaceholder": "örn. Yeni programınız hazır 💪",
  "send.submit": "Gönder",
  "send.sending": "Gönderiliyor…",
  "toast.notificationSent": "Bildirim gönderildi",

  // Weekly review — form
  "review.link": "Haftalık değerlendirme",
  "review.heading": "Geçen haftanın değerlendirmesi",
  "review.subtitle": "Alişan'a {range} haftasının nasıl geçtiğini anlatın.",
  "review.daysAttended": "Geçen hafta kaç gün antrenman yaptınız?",
  "review.programsDone": "Hangi programları yaptınız?",
  "review.hardExercises": "Hangi egzersizler zorladı?",
  "review.hardHint": "Zorlandıklarınızı işaretleyin.",
  "review.note": "Alişan'a eklemek istediğiniz bir şey var mı?",
  "review.notePlaceholder": "İsteğe bağlı — ağrı, enerji, sorular…",
  "review.submit": "Değerlendirmeyi gönder",
  "review.update": "Değerlendirmeyi güncelle",
  "review.none": "Geçen hafta programınız yoktu — henüz değerlendirilecek bir şey yok.",
  "toast.reviewSubmitted": "Değerlendirme gönderildi",
  "err.reviewNoPrograms": "Geçen hafta için değerlendirilecek bir şey yok.",

  // Weekly review — staff view
  "review.staffHeading": "Haftalık değerlendirmeler",
  "review.staffEmpty": "Henüz haftalık değerlendirme gönderilmedi.",
  "review.daysLabel": "Antrenman günü",
  "review.programsLabel": "Yapılan programlar",
  "review.hardLabel": "Zorlayanlar",
  "review.noteLabel": "Not",
  "review.nonePicked": "Yok",

  // View as user
  "admin.viewAsUser": "Kullanıcı gibi görüntüle",

  // Whatsapp
  "wa.aria": "WhatsApp'tan yaz",
  "wa.title": "WhatsApp — yakında",

  // Action errors
  "err.enterName": "Lütfen danışanın adını girin.",
  "err.enterEmail": "Lütfen bir kullanıcı adı / e-posta girin.",
  "err.passwordShort": "Şifre en az 8 karakter olmalı.",
  "err.emailTaken": "Bu kullanıcı adı / e-posta zaten alınmış.",
  "err.emailInUse": "Bu e-posta / kullanıcı adı zaten kullanımda.",
  "err.emailInvalid":
    "Geçerli bir e-posta / kullanıcı adı girin (örn. name@example.com).",
  "err.giveTitle": "Programa bir başlık verin.",
  "err.pickDate": "Geçerli bir hafta başlangıç tarihi seçin.",
  "err.giveExerciseName": "Egzersize bir ad verin.",
  "err.notYouTube": "Bu bir YouTube bağlantısına benzemiyor.",
  "err.exerciseExists": "Bu adda bir egzersiz zaten var.",
  "err.heightRange": "50 ile 260 cm arasında geçerli bir boy girin.",
  "err.measurementDate": "Geçerli bir ölçüm tarihi seçin.",
  "err.numberRange": "Lütfen geçerli sayılar girin.",
  "err.emptyNote": "Kaydetmeden önce bir şeyler yazın.",
  "err.weightRequired": "Bu ölçüm için lütfen bir kilo girin.",
  "err.endDate": "Geçerli bir üyelik bitiş tarihi seçin.",
  "err.notAClient": "Bu hesap buradan silinemez.",
  "err.cantChangeOwnRole": "Kendi rolünüzü değiştiremezsiniz.",
  "err.invalidRole": "Geçerli bir rol seçin.",
  "err.adminOnly": "Bunu yalnızca bir yönetici yapabilir.",
  "err.notifTitle": "Bildirim için bir başlık girin.",
  "err.giveCategoryName": "Kategoriye bir ad verin.",
  "err.categoryExists": "Bu adda bir kategori zaten var.",
  "err.cantEditDefault":
    "Varsayılan kategoriler yeniden adlandırılamaz veya silinemez.",
  "err.giveTemplateTitle": "Taslağa bir başlık verin.",

  // Admin nav — grouped ("Content" dropdown)
  "nav.content": "İçerik",
  "nav.exerciseLibrary": "Egzersiz Kütüphanesi",
  "nav.foodLibrary": "Besin Kütüphanesi",
  "nav.dayTemplates": "Gün Taslakları",

  // Food library (admin)
  "food.heading": "Besin kütüphanesi",
  "food.summary": "{n} besin",
  "food.newFood": "Yeni besin",
  "food.search": "Besin ara…",
  "food.empty": "Besin kütüphanesi boş. İlk besininizi ekleyin.",
  "food.noMatches": "Aramanızla eşleşen besin yok.",
  "food.filterAll": "Tümü",
  "food.filterTracked": "Besin değerleri kayıtlı",
  "food.filterMissing": "Besin değerleri eksik",
  "food.filterMissingEquivalent": "Gram karşılığı eksik",
  "food.name": "Ad",
  "food.defaultPortion": "Varsayılan porsiyon",
  "food.defaultPortionPlaceholder": "örn. 1 su bardağı, 150 g",
  "food.servingDetails": "Besin değerlerinin ait olduğu porsiyon",
  "food.servingQty": "Porsiyon miktarı",
  "food.servingUnit": "Porsiyon birimi",
  "food.gramsPerUnit": "Birim başına gram",
  "food.gramsPerUnitHint":
    "Bu porsiyon gram cinsinden girilebilecekse gereklidir. Bilinmiyorsa boş bırakın.",
  "food.nutritionForServing": "Aşağıdaki besin değerleri bu porsiyona aittir.",
  "food.missingNutrition": "Besin değerleri eksik",
  "food.missingEquivalent": "Gram karşılığı eksik",
  "food.missingServing": "Yapılandırılmış porsiyon eksik",
  "food.legacyPortion": "Eski porsiyon etiketi",
  "food.note": "Not",
  "food.notePlaceholder": "Bu besin hakkında isteğe bağlı bir not.",
  "food.noPortion": "Varsayılan porsiyon yok",
  "food.newHeading": "Yeni besin",
  "food.editHeading": "Besini düzenle",
  "food.confirmDelete": "“{name}” besin kütüphanesinden silinsin mi?",
  "food.invalidNutrition": "Geçerli, negatif olmayan besin değerleri girin.",
  "food.invalidServing":
    "Sıfırdan büyük bir porsiyon miktarı girin ve birimini seçin. Gram karşılığı da sıfırdan büyük olmalıdır.",
  "food.nameEn": "İngilizce ad",
  "food.nameTr": "Türkçe ad",
  "food.nutritionPerPortion": "Bu porsiyonun besin değerleri",
  "food.kcal": "kcal",
  "food.protein": "Protein",
  "food.carbs": "Karbonhidrat",
  "food.fat": "Yağ",
  "food.proteinShort": "P",
  "food.carbsShort": "K",
  "food.fatShort": "Y",
  "toast.foodAdded": "Besin eklendi",
  "toast.foodSaved": "Besin kaydedildi",
  "toast.foodDeleted": "Besin silindi",
  "err.giveFoodName": "Besine bir ad verin.",
  "err.foodExists": "Bu adda bir besin zaten var.",

  // Food combobox
  "foodCombo.search": "Besin ara veya yeni bir ad yaz…",
  "foodCombo.addNew": "“{q}” adını yeni besin olarak ekle",

  // Nutrition plan editor (admin)
  "nutri.editHeading": "Beslenme planı",
  "nutri.editSubtitle": "{name} için güncel beslenme planını hazırlayın.",
  "nutri.notes": "Genel notlar",
  "nutri.notesPlaceholder":
    "Genel öneriler — su tüketimi, zamanlama, aklınıza gelen her şey…",
  "nutri.meals": "Öğünler",
  "nutri.mealLabel": "{n}. Öğün",
  "nutri.mealTitle": "Öğün adı",
  "nutri.mealTitlePlaceholder": "örn. Kahvaltı, Öğle…",
  "nutri.presetsLabel": "Hızlı seç",
  "nutri.addMeal": "Öğün ekle",
  "nutri.addItem": "Besin ekle",
  "nutri.deleteMeal": "Öğünü sil",
  "nutri.moveMealUp": "Öğünü yukarı taşı",
  "nutri.moveMealDown": "Öğünü aşağı taşı",
  "nutri.confirmDeleteMeal": "Bu öğün ve besinleri silinsin mi?",
  "nutri.portion": "Porsiyon",
  "nutri.itemNote": "Not (isteğe bağlı)",
  "nutri.saveToFoodLibrary": "Bunu besin kütüphanesine de kaydet",
  "nutri.noMeals": "Henüz öğün yok — plana başlamak için bir tane ekleyin.",
  "nutri.save": "Planı kaydet",
  "nutri.deletePlan": "Planı sil",
  "nutri.confirmDeletePlan":
    "Bu beslenme planı ve içindeki her şey silinsin mi? Bu işlem geri alınamaz.",
  "nutri.invalidNutrition": "Geçerli, negatif olmayan besin değerleri girin.",
  "nutri.invalidTarget": "Sıfırdan büyük bir günlük kcal hedefi girin.",
  "nutri.invalidProteinTarget":
    "Sıfırdan büyük bir günlük protein hedefi girin.",
  "nutri.invalidQuantity": "Sıfırdan büyük geçerli bir miktar girin.",
  "nutri.invalidUnit": "Geçerli bir birim seçin.",
  "nutri.mealFallback": "Öğün",
  "nutri.createPlanError": "Beslenme planı oluşturulamadı.",
  "nutri.saveMealError": "Bir öğün kaydedilemedi.",
  "nutri.dailyTarget": "Günlük kcal hedefi",
  "nutri.dailyProteinTarget": "Günlük protein hedefi",
  "nutri.dailyTotal": "Günlük toplam",
  "nutri.quantity": "Miktar",
  "nutri.unit": "Birim",
  "nutri.unit.g": "g",
  "nutri.unit.ml": "ml",
  "nutri.unit.piece": "adet",
  "nutri.unit.piecePlural": "adet",
  "nutri.unit.scoop": "ölçek",
  "nutri.unit.scoopPlural": "ölçek",
  "nutri.unit.tbsp": "yemek kaşığı",
  "nutri.unit.tsp": "çay kaşığı",
  "nutri.unit.cup": "su bardağı",
  "nutri.unit.cupPlural": "su bardağı",
  "nutri.calculatedNutrition": "Hesaplanan besin değerleri",
  "nutri.manualOverride": "Manuel düzenleme",
  "nutri.clearOverride": "Hesaplanan değerleri kullan",
  "nutri.overrideHint": "Miktar değiştiğinde bu değerler sabit kalır.",
  "nutri.needsGramEquivalent":
    "Bu miktarı hesaplamak için kütüphane kaydına gram karşılığı ekleyin.",
  "nutri.incompatibleUnits": "Bu porsiyon birimleri güvenli biçimde dönüştürülemez.",
  "nutri.missingServing":
    "Bu kütüphane kaydına porsiyon miktarı ve birimi ekleyin.",
  "nutri.missingNutrition":
    "Bu kütüphane kaydına besin değerlerini ekleyin.",
  "nutri.legacyPortion": "Eski porsiyon: {portion}",
  "nutri.macrosForPortion": "Bu porsiyonun besin değerleri",
  "nutri.mealTotal": "Öğün toplamı",
  "nutri.trackedTotal": "Kısmi toplam",
  "nutri.kcal": "kcal",
  "nutri.protein": "Protein",
  "nutri.carbs": "Karbonhidrat",
  "nutri.fat": "Yağ",
  "nutri.proteinShort": "P",
  "nutri.carbsShort": "K",
  "nutri.fatShort": "Y",
  "nutri.managePlan": "Beslenme planı",
  "nutri.mealPreset.breakfast": "Kahvaltı",
  "nutri.mealPreset.lunch": "Öğle Yemeği",
  "nutri.mealPreset.dinner": "Akşam Yemeği",
  "nutri.mealPreset.snack": "Ara Öğün",
  "toast.nutritionSaved": "Beslenme planı kaydedildi",
  "toast.nutritionDeleted": "Beslenme planı silindi",

  // Nutrition — client-facing
  "nutriClient.card": "Beslenme",
  "nutriClient.empty": "Henüz beslenme planı yok",
  "nutriClient.emptyHint": "Planınızın parçasıysa Alişan bir tane ekleyecek.",
  "nutriClient.heading": "Beslenme",
  "nutriClient.subtitle": "Güncel beslenme planınız.",
  "nutriClient.emptyFull": "Henüz bir beslenme planınız yok.",
  "nutriClient.emptyFullHint":
    "Planınızın parçası olduğunda Alişan bir tane ekleyecek.",
  "nutriClient.notesFrom": "Alişan'dan notlar",
  "nutriClient.viewPlan": "Planı gör",
  "nutriClient.eyebrow": "Beslenmeniz",
  "nutriClient.dailySummary": "Günlük beslenme",
  "nutriClient.dailyTotal": "Günlük toplam",
  "nutriClient.dailyTarget": "Günlük hedef",
  "nutriClient.proteinTarget": "Protein hedefi",
  "nutriClient.mealTotal": "Öğün toplamı",
  "nutriClient.trackedTotal": "Kısmi toplam",
  "nutriClient.emptyMeal": "Bu öğünde besin yok",
  "nutriClient.emptyMealHint": "Plan güncellendiğinde koçunuz besin ekleyebilir.",
  "nutriClient.kcal": "kcal",
  "nutriClient.protein": "Protein",
  "nutriClient.carbs": "Karbonhidrat",
  "nutriClient.fat": "Yağ",
  "nutriClient.proteinShort": "P",
  "nutriClient.carbsShort": "K",
  "nutriClient.fatShort": "Y",
  "profile.accountEyebrow": "Hesap ayarları",
  "progress.eyebrow": "İlerleme",
  "progress.title": "Tek bir sayıyı değil, gidişatı görün.",
  "progress.body":
    "Ölçümlerinizi ekleyin, geçmişinizi inceleyin ve kilo ya da VKİ'yi daha geniş koçluk tablosunun bir parçası olarak değerlendirin.",

  // Mobile navigation (hamburger drawer)
  "nav.menu": "Menü",
  "nav.closeMenu": "Menüyü kapat",
  "nav.home": "Ana sayfa",
  "nav.me": "Kendim",

  // PDF export (button + generated document)
  "export.pdf": "PDF olarak kaydet",
  "export.chooseLanguage": "PDF dili",
  "export.generating": "Oluşturuluyor…",
  "export.failed": "PDF oluşturulamadı. Lütfen tekrar deneyin.",
  "pdf.program": "Antrenman Programı",
  "pdf.preparedBy": "{name} tarafından hazırlandı",
  "pdf.tagline": "Kişisel antrenman & fizyoterapi",
  "pdf.watchVideo": "YouTube'da izle",

  // Availability — nav + staff area
  "nav.availability": "Uygunluk",
  "avail.staffHeading": "Uygunluk",
  "avail.staffSubtitle":
    "Danışanlara ne zaman müsait olduklarını sorun, seansları kendiniz ayarlayın.",
  "avail.week": "Hafta",
  "avail.sendHeading": "Uygunluk talebi gönder",
  "avail.sendSubtitle":
    "Bir hafta seçin ve danışanlara ne zaman müsait olduklarını sorun.",
  "avail.sendAllActive": "Tüm aktif danışanlara gönder",
  "avail.sendAllActiveCount": "Tüm aktif danışanlara gönder ({n})",
  "avail.sendSelected": "Seçilenlere gönder",
  "avail.sendSelectedCount": "{n} seçili danışana gönder",
  "avail.selectClients": "Ya da danışanları tek tek seçin",
  "avail.selectClientsHint":
    "Aynı hafta için tekrar göndermek güvenlidir — zaten sorulan danışanlar atlanır.",
  "avail.noActiveClients": "Henüz danışan yok — önce danışan ekleyin.",
  "avail.activeBadge": "Aktif",
  "avail.inactiveBadge": "Pasif",
  "avail.sending": "Gönderiliyor…",
  "avail.responsesHeading": "Yanıtlar",
  "avail.responsesSubtitle": "{range} için her danışanın gönderdikleri.",
  "avail.noRequests": "Bu hafta için henüz talep gönderilmedi.",
  "avail.responded": "Yanıtladı",
  "avail.notResponded": "Henüz yanıtlamadı",
  "avail.requestedOn": "{date} tarihinde soruldu",
  "toast.availabilitySent": "Talepler gönderildi",

  // Availability — client form
  "avail.clientHeading": "Uygunluğunuz",
  "avail.clientSubtitle":
    "Alişan'a {range} için ne zaman müsait olduğunuzu bildirin.",
  "avail.clientIntro": "Müsait olduğunuz günleri işaretleyip bir saat aralığı ekleyin.",
  "avail.available": "Müsaitim",
  "avail.from": "Başlangıç",
  "avail.to": "Bitiş",
  "avail.timePlaceholderFrom": "örn. 18:00",
  "avail.timePlaceholderTo": "örn. 20:00",
  "avail.dayNote": "Not",
  "avail.dayNotePlaceholder": "örn. iş sonrası, sadece sabahları…",
  "avail.submit": "Uygunluğu gönder",
  "avail.update": "Uygunluğu güncelle",
  "avail.submittedBadge": "Gönderildi",
  "avail.submittedHint": "İstediğiniz zaman düzenleyip tekrar gönderebilirsiniz.",
  "avail.emptyTitle": "Şu anda uygunluk talebi yok",
  "avail.emptyBody": "Alişan seans planlaması gerektiğinde soracaktır.",
  "schedule.eyebrow": "Takvim",
  "schedule.body": "Seanslarınız, randevu seçenekleriniz ve geçmişiniz.",
  "schedule.nav": "Takvim",
  "schedule.metaTitle": "Takvim",
  "schedule.clientTitle": "Randevu takviminiz",
  "schedule.clientBody":
    "Yayımlanmış bir saati seçin veya size uygun saatleri önerin; tüm randevularınızı tek yerde takip edin.",
  "schedule.nextEyebrow": "Sıradaki",
  "schedule.nextAppointment": "Sıradaki randevu",
  "schedule.noNextTitle": "Yaklaşan randevu yok",
  "schedule.noNextBody": "Onaylanan veya bekleyen bir sonraki seansınız burada görünür.",
  "schedule.noAppointments": "Henüz randevu yok",
  "schedule.noAppointmentsBody": "Takvimden bir saat seçin veya saat önerin.",
  "schedule.viewSchedule": "Takvimi gör",
  "schedule.appointmentFallbackTitle": "Koçluk seansı",
  "schedule.duration": "{n} dk",
  "schedule.durationLabel": "Süre (dakika)",
  "schedule.durationMinutes": "{n} dk",
  "schedule.status.pending": "Onay bekliyor",
  "schedule.status.confirmed": "Onaylandı",
  "schedule.status.cancelled": "İptal edildi",
  "schedule.status.completed": "Tamamlandı",
  "schedule.joinMeeting": "Görüşmeye katıl",
  "schedule.meetingWindowHint":
    "Güvenli görüşme bağlantısı, onaylanmış seanstan 30 dakika önce görünür.",
  "schedule.cancelAction": "Randevuyu iptal et",
  "schedule.cancelHeading": "Bu randevu iptal edilsin mi?",
  "schedule.cancelBody": "Randevu geçmişinizde kalır ve koçunuza bildirim gönderilir.",
  "schedule.cancelReason": "Sebep (isteğe bağlı)",
  "schedule.cancelReasonLabel": "İptal sebebi",
  "schedule.cancelReasonPlaceholder": "Yararlı olacaksa kısa bir açıklama ekleyin…",
  "schedule.confirmCancel": "Randevuyu iptal et",
  "schedule.cancelling": "İptal ediliyor…",
  "schedule.cancelledToast": "Randevu iptal edildi",
  "schedule.timezonePromptTitle": "Saat diliminizi doğrulayın",
  "schedule.timezonePromptBody":
    "Saatler şu anda {zone} diliminde gösteriliyor. Saat önermeden önce profilinize saat diliminizi kaydedin.",
  "schedule.setTimezone": "Saat dilimini ayarla",
  "schedule.viewerZone": "{zone} diliminde gösteriliyor",
  "schedule.pendingProposalsTitle": "Değerlendirme bekleyen öneri",
  "schedule.pendingProposalsBody":
    "Alişan bu saatlerden birini kabul edecek veya başka bir saat gerekirse size bildirecek.",
  "schedule.calendarTitle": "Randevu takvimi",
  "schedule.previousMonth": "Önceki ay",
  "schedule.nextMonth": "Sonraki ay",
  "schedule.calendarDaySlots": "{date}: {n} açık saat",
  "schedule.slotModeBody": "Alişan'ın yayımladığı açık saatlerden birini seçin.",
  "schedule.proposalModeBody": "Bir gün seçip size uygun bir veya daha fazla saat önerin.",
  "schedule.availableTimes": "{date} için uygun saatler",
  "schedule.noSlotsTitle": "Bu günde açık saat yok",
  "schedule.noSlotsBody": "Vurgulanan başka bir günü seçin veya daha sonra tekrar bakın.",
  "schedule.noSlotsPublishedTitle": "Henüz uygun saat yayımlanmadı",
  "schedule.noSlotsPublishedBody":
    "Alişan bu ay için henüz açık bir saat yayımlamadı. Başka bir aya bakın veya daha sonra tekrar kontrol edin.",
  "schedule.bookSlot": "Seç",
  "schedule.booking": "Seçiliyor…",
  "schedule.slotBookedToast": "Saat talep edildi — onay bekleniyor",
  "schedule.proposalDate": "{n}. seçenek: tarih",
  "schedule.proposalTime": "Saat",
  "schedule.addProposal": "Başka bir saat ekle",
  "schedule.removeProposal": "Önerilen saati kaldır",
  "schedule.proposalNote": "Not (isteğe bağlı)",
  "schedule.proposalNotePlaceholder": "Alişan'ın dikkate alması gereken bir şey varsa…",
  "schedule.sendProposals": "Saat önerilerini gönder",
  "schedule.proposalsSending": "Gönderiliyor…",
  "schedule.proposalsSentToast": "{n} saat önerisi gönderildi",
  "schedule.laterAppointments": "Sonraki randevular",
  "schedule.historyTitle": "Randevu geçmişi",
  "schedule.noHistoryTitle": "Geçmiş randevu yok",
  "schedule.noHistoryBody": "Tamamlanan ve iptal edilen seanslar burada kalır.",

  // Scheduling — coach panel
  "schedule.adminEyebrow": "Randevu planlama",
  "schedule.adminTitle": "Randevular ve uygunluk",
  "schedule.adminBody":
    "Seansları yayımlayın, değerlendirin ve yönetin. Koç saatleri {timezone} dilimindedir.",
  "schedule.previousWeek": "Önceki hafta",
  "schedule.nextWeek": "Sonraki hafta",
  "schedule.settingsTitle": "Randevu ayarları",
  "schedule.settingsBody":
    "Mevcut randevuları değiştirmeden danışanların kullanacağı akışı seçin.",
  "schedule.mode": "Randevu yöntemi",
  "schedule.mode.coachSlots": "Koç uygun saatleri yayımlar",
  "schedule.mode.clientProposal": "Danışanlar saat önerir",
  "schedule.defaultDuration": "Varsayılan süre (dakika)",
  "schedule.coachTimezone": "Koçun saat dilimi",
  "schedule.saveSettings": "Ayarları kaydet",
  "schedule.weekTitle": "Hafta görünümü",
  "schedule.weekBody": "{timezone} dilimindeki saatler ve randevular.",
  "schedule.dayEmpty": "Planlanmış bir şey yok",
  "schedule.slotStatus.open": "Açık",
  "schedule.slotStatus.booked": "Rezerve edildi",
  "schedule.slotStatus.closed": "Kapalı",
  "schedule.closeSlot": "Saati kapat",
  "schedule.reopenSlot": "Saati yeniden aç",
  "schedule.publishTitle": "Uygun saat yayımla",
  "schedule.publishBody":
    "{timezone} diliminde bir veya daha fazla saat ekleyin; haftalık tekrarlar yaz saati değişiminde aynı yerel saati korur.",
  "schedule.publishInactiveMode":
    "Yayımlanmış saatler korunur ancak saat önerme yöntemi açıkken danışanlar bunları seçemez.",
  "schedule.firstDate": "İlk tarih",
  "schedule.repeatWeeks": "Tekrarlanacak hafta",
  "schedule.slotNumber": "{n}. saat",
  "schedule.time": "Saat",
  "schedule.slotNote": "Danışana görünen not (isteğe bağlı)",
  "schedule.slotNotePlaceholder": "örn. çevrim içi seans",
  "schedule.removeSlot": "Saati kaldır",
  "schedule.addAnotherTime": "Başka bir saat ekle",
  "schedule.publish": "Saatleri yayımla",
  "schedule.publishing": "Yayımlanıyor…",
  "schedule.directTitle": "Doğrudan randevu oluştur",
  "schedule.directBody":
    "Randevuyu {timezone} diliminde girin; danışan kendi yerel saatinde görür.",
  "schedule.client": "Danışan",
  "schedule.date": "Tarih",
  "schedule.agenda": "Gündem",
  "schedule.meetingUrl": "Görüşme bağlantısı",
  "schedule.coachNote": "Özel koç notu",
  "schedule.createAppointment": "Onaylanmış randevu oluştur",
  "schedule.noClients": "Randevu oluşturmadan önce bir danışan ekleyin.",
  "schedule.unnamedClient": "İsimsiz danışan",
  "schedule.clientLocalTime": "Danışan: {time}",
  "schedule.pendingTitle": "Bekleyenler",
  "schedule.pendingBody":
    "Randevu talepleri ve saat önerileri, etkin yöntemden bağımsız olarak burada kalır.",
  "schedule.pendingEmpty": "Karar bekleyen bir şey yok.",
  "schedule.pendingBookings": "Randevu talepleri ({n})",
  "schedule.pendingProposals": "Saat önerileri ({n})",
  "schedule.noPendingBookings": "Bekleyen randevu talebi yok.",
  "schedule.noPendingProposals": "Bekleyen saat önerisi yok.",
  "schedule.confirm": "Onayla",
  "schedule.decline": "Reddet",
  "schedule.accept": "Kabul et",
  "schedule.declineReason": "Ret notu (isteğe bağlı)",
  "schedule.declineReasonPlaceholder": "İsteğe bağlı ret sebebi…",
  "schedule.saveDetails": "Randevu ayrıntılarını kaydet",
  "schedule.cancelAppointment": "Randevuyu iptal et",
  "schedule.toast.settingsSaved": "Randevu ayarları kaydedildi",
  "schedule.toast.slotsPublished": "{n} saat yayımlandı",
  "schedule.toast.slotClosed": "Saat kapatıldı",
  "schedule.toast.slotOpened": "Saat yeniden açıldı",
  "schedule.toast.appointmentCreated": "Randevu oluşturuldu",
  "schedule.toast.detailsSaved": "Randevu ayrıntıları kaydedildi",
  "schedule.toast.cancelled": "Randevu iptal edildi",
  "schedule.toast.confirmed": "Randevu onaylandı",
  "schedule.toast.declined": "Randevu reddedildi ve saat yeniden açıldı",
  "schedule.toast.proposalAccepted": "Saat önerisi kabul edildi",
  "schedule.toast.proposalDeclined": "Saat önerisi reddedildi",
  "schedule.err.settingsInvalid": "Yöntemi, süreyi ve IANA saat dilimini kontrol edin.",
  "schedule.err.slotInvalid": "Tarihi, saatleri, süreyi ve tekrar sayısını kontrol edin.",
  "schedule.err.appointmentInvalid": "Danışanı, tarihi, saati ve süreyi kontrol edin.",
  "schedule.err.clientInvalid": "Geçerli bir danışan seçin.",
  "schedule.err.meetingUrl": "Görüşme bağlantısı eksiksiz bir https adresi olmalıdır.",
  "schedule.err.pastTime": "Gelecekte bir saat seçin.",
  "schedule.err.dstGap": "Yaz saati değişimi nedeniyle bu yerel saat mevcut değil.",
  "schedule.err.dstAmbiguous":
    "Yaz saati değişimi nedeniyle bu yerel saat iki kez yaşanıyor. Başka bir saat seçin.",
  "schedule.err.slotTaken": "Bu saat az önce alındı. Lütfen başka bir saat seçin.",
  "schedule.err.proposalDecided": "Bu saat önerisi için zaten karar verilmiş.",
  "schedule.err.saveFailed": "Randevu değişikliği kaydedilemedi. Lütfen tekrar deneyin.",
  "err.scheduleInvalid": "Randevu bilgilerini kontrol edip tekrar deneyin.",
  "err.scheduleWrongMode": "Randevu yöntemi değişti. Sayfayı yenileyip tekrar deneyin.",
  "err.scheduleSlotTaken": "Bu saat az önce alındı. Lütfen başka bir saat seçin.",
  "err.scheduleSave": "Randevu talebiniz kaydedilemedi.",
  "err.scheduleTimezoneRequired": "Önce profilinize saat diliminizi kaydedin.",
  "err.scheduleInvalidTime": "Geçerli bir tarih ve saat seçin.",
  "err.scheduleAmbiguousTime":
    "Yaz saati değişimi nedeniyle bu yerel saat iki kez yaşanıyor. Başka bir saat seçin.",
  "err.scheduleNonexistentTime": "Yaz saati değişimi nedeniyle bu yerel saat mevcut değil.",
  "err.schedulePastTime": "Gelecekte bir saat seçin.",
  "err.scheduleDuplicateTime": "Önerilen her saat farklı olmalıdır.",
  "err.scheduleCancel": "Randevu iptal edilemedi.",
  "err.timezoneInvalid": "Geçerli bir IANA saat dilimi girin.",
  "toast.availabilitySaved": "Uygunluk kaydedildi",

  // Availability — client dashboard entry point
  "avail.card": "Uygunluk",
  "avail.cardPending": "Alişan ne zaman müsait olduğunuzu sordu",

  // Availability — notification (staff-sent) + bell category
  "notif.cat.availability": "Uygunluk talebi",
  "notif.cat.appointment_reminder": "Randevu hatırlatması",
  "notif.cat.appointment_cancelled": "Randevu güncellemesi",
  "notif.availability.title": "Ne zaman müsaitsiniz?",
  "notif.availability.body": "Alişan {range} için uygunluğunuzu öğrenmek istiyor.",

  // Availability — errors
  "err.availWeek": "Geçerli bir hafta seçin.",
  "err.availNoClients": "En az bir danışan seçin.",
  "err.availNoRequest": "Bu hafta için uygunluk talebi yok.",
};

const MESSAGES: Record<Lang, Dict> = { en, tr };

/** Translate a key with optional {param} interpolation. */
export function t(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  let s = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

/**
 * Deterministic short month names. Dates are formatted from explicit parts with
 * these — NOT via toLocaleDateString/Intl.formatRange — because the environment's
 * ICU output (separator character, spacing, non-breaking spaces) differs between
 * Node and the browser and produces server/client hydration mismatches. These
 * strings match the ICU "short" month names for each locale.
 */
const MONTHS_SHORT: Record<Lang, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
};

/** A plain localized calendar date, e.g. "Aug 31, 2026" / "31 Ağu 2026". */
export function formatDay(iso: string, lang: Lang): string {
  const [y, m, d] = ymd(iso);
  const mon = MONTHS_SHORT[lang][m - 1];
  return lang === "tr" ? `${d} ${mon} ${y}` : `${mon} ${d}, ${y}`;
}

/** Short weekday names, index 0 = Monday … 6 = Sunday (deterministic — see note). */
const WEEKDAYS_SHORT: Record<Lang, readonly string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  tr: ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"],
};

/** A weekday + day/month, e.g. "Mon, Jul 6" / "Pzt, 6 Tem" (no year, no drift). */
export function formatDayWithWeekday(iso: string, lang: Lang): string {
  const [y, m, d] = ymd(iso);
  const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0=Mon
  const mon = MONTHS_SHORT[lang][m - 1];
  const dayMon = lang === "tr" ? `${d} ${mon}` : `${mon} ${d}`;
  return `${WEEKDAYS_SHORT[lang][wd]}, ${dayMon}`;
}

/** "N day(s) available" — Turkish doesn't pluralize after numbers. */
export function availDaysCount(lang: Lang, n: number): string {
  return lang === "tr"
    ? `${n} gün müsait`
    : `${n} ${n === 1 ? "day" : "days"} available`;
}

// ---- Localized count helpers (Turkish doesn't pluralize after numbers) ----
export function exercisesCount(lang: Lang, n: number): string {
  return lang === "tr"
    ? `${n} egzersiz`
    : `${n} ${n === 1 ? "exercise" : "exercises"}`;
}
export function daysCount(lang: Lang, n: number): string {
  return lang === "tr" ? `${n} gün` : `${n} ${n === 1 ? "day" : "days"}`;
}
export function programsCount(lang: Lang, n: number): string {
  return lang === "tr"
    ? `${n} program`
    : `${n} ${n === 1 ? "program" : "programs"}`;
}
export function reviewsCount(lang: Lang, n: number): string {
  return lang === "tr"
    ? `${n} değerlendirme`
    : `${n} ${n === 1 ? "review" : "reviews"}`;
}
export function clientsCount(lang: Lang, n: number): string {
  return lang === "tr"
    ? `${n} danışan`
    : `${n} ${n === 1 ? "client" : "clients"}`;
}
export function mealsCount(lang: Lang, n: number): string {
  return lang === "tr" ? `${n} öğün` : `${n} ${n === 1 ? "meal" : "meals"}`;
}

/**
 * Display names for the seeded default categories (is_default=true), keyed by
 * the English name stored in the DB (see migration 0010). Custom categories
 * Alişan adds are shown exactly as typed, so they don't appear here.
 */
const DEFAULT_CATEGORY_NAMES: Record<Lang, Record<string, string>> = {
  en: {
    Chest: "Chest",
    Back: "Back",
    Legs: "Legs",
    Shoulders: "Shoulders",
    Arms: "Arms",
    Core: "Core",
    "Full Body": "Full Body",
    Mobility: "Mobility",
    Rehab: "Rehab",
  },
  tr: {
    Chest: "Göğüs",
    Back: "Sırt",
    Legs: "Bacak",
    Shoulders: "Omuz",
    Arms: "Kol",
    Core: "Kor",
    "Full Body": "Tüm Vücut",
    Mobility: "Mobilite",
    Rehab: "Rehabilitasyon",
  },
};

/** A category's display name: translated for defaults, as-typed for custom. */
export function categoryLabel(
  lang: Lang,
  category: { name: string; is_default: boolean },
): string {
  if (category.is_default) {
    return DEFAULT_CATEGORY_NAMES[lang][category.name] ?? category.name;
  }
  return category.name;
}

// ---- Localized dates (deterministic — see MONTHS_SHORT note above) ----
function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/** The Sunday (Monday + 6) that ends a program week, as [y, m, d] (UTC). */
function weekEnd(iso: string): [number, number, number] {
  const [y, m, d] = ymd(iso);
  const e = new Date(Date.UTC(y, m - 1, d + 6));
  return [e.getUTCFullYear(), e.getUTCMonth() + 1, e.getUTCDate()];
}

/**
 * Monday–Sunday range, deterministic + localized:
 *   en: "Jul 6 – 12, 2026" / "Jun 29 – Jul 5, 2026" / "Dec 28, 2026 – Jan 3, 2027"
 *   tr: "6 – 12 Tem 2026"  / "29 Haz – 5 Tem 2026"   / "28 Ara 2026 – 3 Oca 2027"
 */
export function formatWeekRange(iso: string, lang: Lang): string {
  const [sy, sm, sd] = ymd(iso);
  const [ey, em, ed] = weekEnd(iso);
  const sMon = MONTHS_SHORT[lang][sm - 1];
  const eMon = MONTHS_SHORT[lang][em - 1];

  if (lang === "tr") {
    if (sy !== ey) return `${sd} ${sMon} ${sy} – ${ed} ${eMon} ${ey}`;
    if (sm !== em) return `${sd} ${sMon} – ${ed} ${eMon} ${sy}`;
    return `${sd} – ${ed} ${sMon} ${sy}`;
  }
  if (sy !== ey) return `${sMon} ${sd}, ${sy} – ${eMon} ${ed}, ${ey}`;
  if (sm !== em) return `${sMon} ${sd} – ${eMon} ${ed}, ${sy}`;
  return `${sMon} ${sd} – ${ed}, ${sy}`;
}

/** A default program title: "Week of Jul 6, 2026" / "6 Tem 2026 Haftası". */
export function weekTitle(iso: string, lang: Lang): string {
  const date = formatDay(iso, lang);
  return lang === "tr" ? `${date} Haftası` : `Week of ${date}`;
}

/** Dropdown label: "Week of Jul 6, 2026 (Jul 6 – 12)" — range without the year. */
export function weekLabel(iso: string, lang: Lang): string {
  const [, sm, sd] = ymd(iso);
  const [, em, ed] = weekEnd(iso);
  const sMon = MONTHS_SHORT[lang][sm - 1];
  const eMon = MONTHS_SHORT[lang][em - 1];
  let range: string;
  if (lang === "tr") {
    range = sm !== em ? `${sd} ${sMon} – ${ed} ${eMon}` : `${sd} – ${ed} ${sMon}`;
  } else {
    range = sm !== em ? `${sMon} ${sd} – ${eMon} ${ed}` : `${sMon} ${sd} – ${ed}`;
  }
  return `${weekTitle(iso, lang)} (${range})`;
}
