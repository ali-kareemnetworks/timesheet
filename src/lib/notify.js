import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

// Sends a "timesheet rejected" email directly from the browser via EmailJS.
// If EmailJS isn't configured, this silently no-ops — the in-app status
// badge and rejection reason (stored on the timesheet) still notify the
// employee the next time they open the app, so nothing is lost.
export async function notifyRejection({ toEmail, toName, weekStart, reason }) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn('EmailJS not configured — skipping email, in-app notice still applies.')
    return { sent: false }
  }
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: toEmail,
        to_name: toName,
        week_start: weekStart,
        reason: reason || '(no reason given)',
      },
      { publicKey: PUBLIC_KEY }
    )
    return { sent: true }
  } catch (err) {
    console.error('EmailJS send failed:', err)
    return { sent: false, error: err }
  }
}
