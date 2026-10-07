// Validación de cliente: mensajes claros bajo cada campo.
(() => {
  const MESSAGES = {
    valueMissing: 'Este campo es obligatorio',
    typeMismatch: 'Ingrese un email válido',
    tooShort: (f) => `Mínimo ${f.minLength} caracteres`,
    tooLong: (f) => `Máximo ${f.maxLength} caracteres`,
    patternMismatch: 'Formato inválido',
  };

  const validateField = (field) => {
    let msg = '';
    if (field.validity.valueMissing) msg = MESSAGES.valueMissing;
    else if (field.validity.typeMismatch) msg = MESSAGES.typeMismatch;
    else if (field.validity.tooShort) msg = MESSAGES.tooShort(field);
    else if (field.validity.tooLong) msg = MESSAGES.tooLong(field);
    else if (field.validity.patternMismatch) msg = MESSAGES.patternMismatch;

    if (!msg && field.dataset.match) {
      const other = field.form?.elements?.[field.dataset.match];
      if (other && field.value !== other.value) msg = 'Las contraseñas no coinciden';
    }

    const errorEl = field.parentElement?.querySelector('.field-error');
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.hidden = !msg;
    }
    field.classList.toggle('form-control--invalid', Boolean(msg));
    return !msg;
  };

  document.querySelectorAll('form[data-validate]').forEach((form) => {
    const fields = [...form.querySelectorAll('input')];
    fields.forEach((f) => f.addEventListener('blur', () => validateField(f)));
    form.addEventListener('input', (e) => {
      if (e.target.matches('input')) validateField(e.target);
    });
    form.addEventListener('submit', (e) => {
      const valid = fields.map(validateField).every(Boolean);
      if (!valid) {
        e.preventDefault();
        form.querySelector('.form-control--invalid')?.focus();
      }
    });
  });

  // Confirmaciones de borrado (data-confirm)
  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });

  // Formulario de transacción: filtrar categorías según tipo (income/expense)
  const txForm = document.querySelector('form[data-filter-categories]');
  if (txForm) {
    const catSelect = txForm.elements.categoryId;
    const syncCategories = () => {
      const selected = txForm.querySelector('input[name="type"]:checked')?.value;
      [...catSelect.options].forEach((opt) => {
        if (!opt.value) return;
        opt.hidden = opt.dataset.type !== selected;
      });
      if (catSelect.selectedOptions[0]?.hidden || !catSelect.value) {
        const first = [...catSelect.options].find((o) => o.value && !o.hidden);
        catSelect.value = first ? first.value : '';
      }
    };
    txForm.querySelectorAll('input[name="type"]').forEach((r) =>
      r.addEventListener('change', syncCategories)
    );
    catSelect.addEventListener('focus', syncCategories);
    syncCategories();
  }
})();
