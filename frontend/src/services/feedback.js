import Swal from 'sweetalert2';

const ICONS = {
  success:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4m0 4h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  question:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
};

export function confirmDelete({
  title = 'Are you sure?',
  text = '',
  confirmText = 'Delete',
  danger = true,
  titleHtml,
}) {
  return Swal.fire({
    title: titleHtml || title,
    html: text,
    iconHtml: ICONS.trash,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    confirmButtonColor: danger ? '#E53935' : '#1565C8',
    focusCancel: true,
    reverseButtons: true,
    showCloseButton: true,
    buttonsStyling: false,
    customClass: {
      popup: `pangasin-swal-dialog pangasin-swal-dialog--${danger ? 'danger' : 'confirm'}`,
      icon: 'pangasin-swal-dialog-icon',
      title: 'pangasin-swal-title',
      htmlContainer: 'pangasin-swal-html',
      confirmButton: 'pangasin-swal-btn pangasin-swal-btn--confirm',
      cancelButton: 'pangasin-swal-btn pangasin-swal-btn--cancel',
      closeButton: 'pangasin-swal-close',
    },
  }).then((res) => res.isConfirmed);
}

export function confirmAction({
  title = 'Please confirm',
  text = '',
  confirmText = 'Continue',
  cancelText = 'Cancel',
  icon = 'question',
  danger = false,
}) {
  return Swal.fire({
    title,
    html: text,
    iconHtml: ICONS[icon] || ICONS.info,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? '#E53935' : '#1565C8',
    focusCancel: true,
    reverseButtons: true,
    showCloseButton: true,
    buttonsStyling: false,
    customClass: {
      popup: `pangasin-swal-dialog pangasin-swal-dialog--${danger ? 'danger' : 'confirm'}`,
      icon: 'pangasin-swal-dialog-icon',
      title: 'pangasin-swal-title',
      htmlContainer: 'pangasin-swal-html',
      confirmButton: 'pangasin-swal-btn pangasin-swal-btn--confirm',
      cancelButton: 'pangasin-swal-btn pangasin-swal-btn--cancel',
      closeButton: 'pangasin-swal-close',
    },
  }).then((res) => res.isConfirmed);
}

export { Swal };