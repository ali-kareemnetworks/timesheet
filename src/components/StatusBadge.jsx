const CLASS = {
  draft: 'stamp-draft',
  submitted: 'stamp-submitted',
  approved: 'stamp-approved',
  rejected: 'stamp-rejected',
}

export default function StatusBadge({ status }) {
  return <span className={CLASS[status] || 'stamp-draft'}>{status}</span>
}
