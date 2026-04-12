<script lang="ts">
  interface Props {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    confirmDanger?: boolean
    onconfirm: () => void
    oncancel: () => void
  }
  let {
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    confirmDanger = false,
    onconfirm,
    oncancel
  }: Props = $props()

  let dialogEl: HTMLDialogElement | undefined = $state()

  $effect(() => {
    if (open && dialogEl && !dialogEl.open) {
      dialogEl.showModal()
    } else if (!open && dialogEl?.open) {
      dialogEl.close()
    }
  })
</script>

<dialog bind:this={dialogEl} onclose={oncancel}>
  <h2>{title}</h2>
  <p class="message">{message}</p>
  <div class="actions">
    <button type="button" class="btn-cancel" onclick={oncancel}>Cancel</button>
    <button
      type="button"
      class="btn-confirm"
      class:danger={confirmDanger}
      onclick={onconfirm}
    >
      {confirmLabel}
    </button>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    font-family: inherit;
    margin: auto;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.4);
  }

  h2 {
    margin: 0 0 12px;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .message {
    font-size: 0.875rem;
    color: #555;
    line-height: 1.5;
    margin: 0 0 20px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn-cancel,
  .btn-confirm {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    border: none;
  }

  .btn-cancel {
    background: #f0f0f0;
    color: #555;
  }

  .btn-cancel:hover {
    background: #e0e0e0;
  }

  .btn-confirm {
    background: #0066cc;
    color: #fff;
  }

  .btn-confirm:hover {
    background: #0055aa;
  }

  .btn-confirm.danger {
    background: #d32f2f;
  }

  .btn-confirm.danger:hover {
    background: #b71c1c;
  }
</style>
