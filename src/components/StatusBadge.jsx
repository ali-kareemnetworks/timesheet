const CLASS = {
  draft: 'stamp-draft',
  pending_acknowledgment: 'stamp-submitted',
  submitted: 'stamp-submitted',
  approved: 'stamp-approved',
  rejected: 'stamp-rejected',
}

const LABEL = {
  pending_acknowledgment: 'needs your review',
}

export default function StatusBadge({ status }) {
  return <span className={CLASS[status] || 'stamp-draft'}>{LABEL[status] || status}</span>
}
