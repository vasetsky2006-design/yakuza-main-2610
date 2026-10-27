const filters = [...document.querySelectorAll('[data-filter]')];
const modules = [...document.querySelectorAll('[data-module]')];
const count = document.querySelector('[data-module-count]');
for (const button of filters) {
  button.addEventListener('click', () => {
    for (const option of filters) option.setAttribute('aria-pressed', String(option === button));
    for (const module of modules) module.hidden = button.dataset.filter !== 'all' && module.dataset.module !== button.dataset.filter;
    if (count) count.textContent = `Показано напрямів: ${modules.filter(module => !module.hidden).length}.`;
  });
}
for (const link of document.querySelectorAll('.mobile-nav a')) {
  link.addEventListener('click', () => link.closest('details').removeAttribute('open'));
}
