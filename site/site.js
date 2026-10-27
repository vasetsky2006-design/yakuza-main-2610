(function () {
  "use strict";

  if (typeof document !== "undefined") document.documentElement.classList.add("js");

  function requestFrame(callback) {
    if (typeof window === "undefined") return 0;
    if (typeof window.requestAnimationFrame === "function") return window.requestAnimationFrame(callback);
    return window.setTimeout(callback, 16);
  }

  function toFiniteNumber(value) {
    const parsed = Number.parseFloat(String(value).replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function calculateOpportunity(values) {
    const leads = toFiniteNumber(values.leads);
    const averageDeal = toFiniteNumber(values.averageDeal);
    const conversion = Math.min(toFiniteNumber(values.conversion), 100);
    const uplift = Math.min(toFiniteNumber(values.uplift), 100 - conversion);
    const additionalDeals = leads * (uplift / 100);
    const monthlyOpportunity = additionalDeals * averageDeal;
    return { leads, averageDeal, conversion, uplift, additionalDeals, monthlyOpportunity };
  }

  function formatCurrency(value) {
    return `${Math.round(value).toLocaleString("uk-UA")} грн`;
  }

  function formatDeals(value) {
    return Number.isInteger(value) ? String(value) : value.toLocaleString("uk-UA", { maximumFractionDigits: 1 });
  }

  function getCheckedValues(form, name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
  }

  function evaluateAuditFit(values) {
    const lowVolume = values.teamSize === "1–4" || values.dialogs === "до 100";
    const legalBlocked = values.dataRights === "Не підтверджено";
    const missingOwner = values.changeOwner === "Ще не призначено";

    if (legalBlocked) {
      return {
        code: "NOT_READY",
        label: "Ще не готові до передачі даних",
        nextStep: "Спочатку підтвердьте законну підставу та право передавати погоджену вибірку."
      };
    }
    if (lowVolume) {
      return {
        code: "LOW_FIT",
        label: "Потрібно коротко звірити формат",
        nextStep: "Перевіримо, чи вистачить обсягу сигналу або чи краще почати з іншого формату."
      };
    }
    if (values.dataRights === "Перевіряємо" || missingOwner) {
      return {
        code: "CONDITIONAL_FIT",
        label: "Формат підійде після двох уточнень",
        nextStep: "До старту закрийте право на дані та призначте керівника, який впроваджуватиме зміни."
      };
    }
    return {
      code: "STRONG_FIT",
      label: "Схоже, аудит вам підійде",
      nextStep: "Погодьте обсяг робіт, безпечний канал і критерій приймання — лише потім передавайте мінімальну вибірку."
    };
  }

  function pluralDeals(n) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return "угода";
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "угоди";
    return "угод";
  }

  function initStoryMoments() {
    const grid = document.querySelector("[data-moments-grid]");
    const toggle = document.querySelector("[data-moments-toggle]");
    if (!grid || !toggle) return;
    // Кадри поза таймлайном цінні, але 1400px на мобільному між історією і заявкою — ні.
    let open = false;
    toggle.addEventListener("click", () => {
      open = !open;
      grid.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Згорнути кадри" : "Показати 4 кадри";
    });
  }

  function initDisclosure(gridSelector, toggleSelector, labels) {
    const grid = document.querySelector(gridSelector);
    const toggle = document.querySelector(toggleSelector);
    if (!grid || !toggle) return;
    let open = false;
    toggle.addEventListener("click", () => {
      open = !open;
      grid.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? labels[1] : labels[0];
    });
  }

  function initCalculator() {
    const form = document.querySelector("#revenue-calculator");
    if (!form) return;
    const output = document.querySelector("#monthly-opportunity");
    const detail = document.querySelector("#calculation-detail");
    const payback = document.querySelector("#calculation-payback");
    // Ціна аудиту «Рентген відділу продажів» за погодженою лінійкою (17.10.2026):
    // 24 000 грн — до 5 менеджерів, 36 000 грн — 6–15 менеджерів.
    const AUDIT_PRICES = { "24000": 24000, "36000": 36000 };
    const DEFAULT_AUDIT_PRICE = 24000;

    const update = () => {
      const values = Object.fromEntries(new FormData(form).entries());
      const result = calculateOpportunity(values);
      const AUDIT_PRICE = AUDIT_PRICES[String(values.team || "")] || DEFAULT_AUDIT_PRICE;
      const nextOutput = formatCurrency(result.monthlyOpportunity);
      if (output.textContent !== nextOutput) {
        output.classList.remove("is-updating");
        void output.offsetWidth;
        output.classList.add("is-updating");
      }
      output.textContent = nextOutput;
      detail.textContent = `${formatDeals(result.additionalDeals)} додаткових угод × ${formatCurrency(result.averageDeal)}`;
      if (payback) {
        const deals = Number(result.additionalDeals) || 0;
        const cheque = Number(result.averageDeal) || 0;
        if (deals <= 0 || cheque <= 0) {
          payback.hidden = true;
        } else {
          payback.hidden = false;
          payback.innerHTML = `Це додаткова виручка до витрат, а не прибуток. Чи є підстави для такого сценарію у ваших даних, покаже <strong>аудит за ${formatCurrency(AUDIT_PRICE)}</strong>.`;
        }
      }
    };

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();
  }

  function initScan() {
    const root = document.querySelector("#scan");
    const options = [...document.querySelectorAll(".scan-option")];
    const label = document.querySelector("#scan-result-label");
    const title = document.querySelector("#scan-result-title");
    const copy = document.querySelector("#scan-result-copy");
    const effect = document.querySelector("#scan-result-effect");
    const action = document.querySelector("#scan-result-action");
    const meter = document.querySelector("#scan-meter");
    const meterFill = document.querySelector("#scan-meter-fill");
    const meterValue = document.querySelector("#scan-meter-value");
    const artifact = document.querySelector("#scan-artifact");
    const scanCta = document.querySelector("#scan-cta");
    // Блок «Що ви отримаєте» має відповідати обраній сфері, а не завжди показувати продажі.
    const resultScope = document.querySelector("#result-scope");
    const resultPain = document.querySelector("#result-pain-text");
    const resultSlots = [1, 2, 3].map((i) => ({
      title: document.querySelector(`#result-${i}-title`),
      copy: document.querySelector(`#result-${i}-copy`)
    }));
    const form = document.querySelector("#lead-form");
    const segmentField = form?.querySelector('input[name="segment"]');
    const needField = form?.querySelector('select[name="need"]');
    const contextHint = form?.querySelector("#form-context-hint");
    const contextLabel = contextHint?.querySelector("strong");
    if (!root || options.length === 0 || !label || !title || !copy || !effect || !action) return;

    const scenarios = {
      sales: {
        pain: "угоди зриваються, а в CRM усе виглядає нормально.",
        scope: "Продажі",
        result: [
          ["Де губляться угоди", "Повторювані моменти, коли клієнт не переходить до наступного кроку."],
          ["Де це видно", "Цитати з переписок і таймкоди дзвінків, щоб ви самі перевірили кожен висновок."],
          ["Що відбувається в розмові", "Чи менеджер почув потребу, пояснив цінність, відповів на сумнів і домовився про наступну дію."]
        ],
        label: "СИГНАЛ · ПРОДАЖІ",
        title: "Менеджери говорять по-різному, а причина втрати лишається невидимою.",
        copy: "Звірити 10–20 діалогів на одному етапі воронки й знайти повторюваний момент перед наступною дією.",
        effect: "Наслідок: керівник бачить тільки фінал.",
        action: "Почнемо з одного етапу.",
        risk: 72,
        artifact: "Карта етапу воронки",
        segment: "Відділ продажів",
        need: "Продажі та конверсію"
      },
      service: {
        pain: "одне й те саме питання приходить по колу, а команда горить.",
        scope: "Клієнтський сервіс",
        result: [
          ["Де клієнт повертається двічі", "Звернення, які закриваються з першого разу, і ті, що повертаються з тим самим питанням."],
          ["Де це видно", "Ланцюжки звернень і час до першої відповіді за кожною темою."],
          ["Що відбувається у відповіді", "Чи людина зрозуміла питання, дала повну відповідь і закрила причину, а не симптом."]
        ],
        label: "СИГНАЛ · СЕРВІС",
        title: "Відповідь залежить від людини, а клієнт повторює одне й те саме.",
        copy: "Взяти типові звернення, розкласти їх за темами й домовитися про єдиний маршрут відповіді.",
        effect: "Наслідок: повторні звернення з'їдають час команди.",
        action: "Почнемо з трьох типових звернень.",
        risk: 64,
        artifact: "Матриця звернень і відповідей",
        segment: "Клієнтський сервіс",
        need: "Клієнтський сервіс"
      },
      operations: {
        pain: "проблему видно вже після того, як гроші втрачені.",
        scope: "Операції та звіти",
        result: [
          ["Де звіт розходиться з реальністю", "Місця, де цифра збирається вручну і встигає застаріти до наради."],
          ["Де це видно", "Джерела даних, власник кожного числа і момент, коли воно востаннє оновлювалось."],
          ["Що відбувається між звітами", "Хто помічає відхилення першим і скільки часу минає до рішення."]
        ],
        label: "СИГНАЛ · ОПЕРАЦІЇ",
        title: "Звіт збирають вручну, тому проблема видно вже після втрати.",
        copy: "Описати джерела даних, відповідального і момент, коли керівник має побачити відхилення.",
        effect: "Наслідок: рішення приймаються із запізненням.",
        action: "Намалюємо один маршрут звіту.",
        risk: 81,
        artifact: "Карта джерел і контрольних точок",
        segment: "Операційна команда",
        need: "Операції та звіти"
      },
      automation: {
        pain: "команда обслуговує таблиці замість того, щоб працювати з клієнтами.",
        scope: "Ручні таблиці",
        result: [
          ["Де час іде на копіювання", "Дії, які повторюються щотижня і не потребують людського рішення."],
          ["Де це видно", "Скільки разів на місяць повторюється операція і скільки годин вона забирає."],
          ["Що можна віддати правилу", "Що автоматизується без ризику, а де людина лишається точкою погодження."]
        ],
        label: "СИГНАЛ · АВТОМАТИЗАЦІЯ",
        title: "Одна й та сама таблиця повертається щотижня — і все одно не сходиться.",
        copy: "Відокремити правило від ручної дії, перевірити винятки й залишити людині точку погодження.",
        effect: "Наслідок: час іде на копіювання, а не на рішення.",
        action: "Зафіксуємо одну повторювану дію.",
        risk: 88,
        artifact: "Схема правила та винятків",
        segment: "Команди з ручним Excel",
        need: "Операції та звіти"
      }
    };

    let activeScenario = scenarios[options[0].dataset.scan] || scenarios.sales;
    const setScenario = (key, moveFocus = false) => {
      const scenario = scenarios[key] || scenarios.sales;
      activeScenario = scenario;
      options.forEach((option) => {
        const selected = option.dataset.scan === key;
        option.classList.toggle("is-active", selected);
        option.setAttribute("aria-selected", String(selected));
        option.tabIndex = selected ? 0 : -1;
        if (selected && option.id) root.querySelector("#scan-result")?.setAttribute("aria-labelledby", option.id);
      });
      label.textContent = scenario.label;
      title.textContent = scenario.title;
      copy.textContent = scenario.copy;
      effect.textContent = scenario.effect;
      action.textContent = scenario.action;
      const risk = Math.max(0, Math.min(100, Number(scenario.risk) || 0));
      if (meter) meter.setAttribute("aria-valuenow", String(risk));
      if (meterFill) meterFill.style.transform = `scaleX(${risk / 100})`;
      if (meterValue) meterValue.textContent = `${risk} / 100`;
      if (artifact) artifact.textContent = scenario.artifact;
      if (resultScope && scenario.scope) resultScope.textContent = `· ${scenario.scope}`;
      if (resultPain && scenario.pain) resultPain.textContent = scenario.pain;
      if (Array.isArray(scenario.result)) {
        resultSlots.forEach((slot, i) => {
          const item = scenario.result[i];
          if (!item) return;
          if (slot.title) slot.title.textContent = item[0];
          if (slot.copy) slot.copy.textContent = item[1];
        });
      }
      if (segmentField) segmentField.value = scenario.segment;
      if (contextHint && contextLabel) {
        contextLabel.textContent = scenario.segment;
        contextHint.hidden = false;
      }
      // Перемикання має відчуватися як новий сигнал, а не як стрибок тексту.
      // Перезапускаємо клас через animation frame, без таймерів і мережевих викликів.
      root.classList.remove("is-refreshing");
      requestFrame(() => root.classList.add("is-refreshing"));
      if (moveFocus) document.querySelector("#scan-result")?.focus({ preventScroll: true });
    };

    options.forEach((option, index) => {
      option.addEventListener("click", () => setScenario(option.dataset.scan));
      option.addEventListener("keydown", (event) => {
        const navKeys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
        if (!navKeys.includes(event.key)) return;
        event.preventDefault();
        let next;
        if (event.key === "Home") next = options[0];
        else if (event.key === "End") next = options[options.length - 1];
        else {
          const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
          next = options[(index + delta + options.length) % options.length];
        }
        setScenario(next.dataset.scan);
        next.focus();
      });
    });
    scanCta?.addEventListener("click", () => {
      if (needField && !String(needField.value || "").trim() && activeScenario.need) {
        needField.value = activeScenario.need;
        needField.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    setScenario(options[0].dataset.scan);
  }

  function initOutputExplorer() {
    const root = document.querySelector("[data-output-explorer]");
    const panel = document.querySelector("#output-panel");
    const tabs = [...document.querySelectorAll("[data-output-view]")];
    if (!root || !panel || tabs.length === 0) return;

    const kicker = document.querySelector("#output-panel-kicker");
    const title = document.querySelector("#output-panel-title");
    const copy = document.querySelector("#output-panel-copy");
    const metaLeft = document.querySelector("#output-panel-meta-left");
    const metaRight = document.querySelector("#output-panel-meta-right");
    const panelItems = [...document.querySelectorAll("[data-output-item]")];
    const views = {
      report: {
        kicker: "Докази й пріоритети",
        title: "Знаєте, де саме губиться наступний крок.",
        copy: "Кожен сигнал прив'язаний до фрагмента розмови, етапу воронки та дії, яку можна перевірити.",
        left: "6 блоків доказів",
        right: "для керівника",
        items: [["Фрагмент розмови", "цитата"], ["Критерій оцінки", "перевірено"], ["Наступна дія", "узгодити"]]
      },
      portal: {
        kicker: "Регулярний контроль",
        title: "Бачите динаміку, а не разовий PDF.",
        copy: "У кабінеті з'являються статуси змін, повторні перевірки, відповідальні та історія рішень — коли регулярний формат справді потрібен.",
        left: "статуси й історія",
        right: "для команди",
        items: [["Власник зміни", "призначено"], ["Статус команди", "у роботі"], ["Історія перевірок", "видно"]]
      },
      roadmap: {
        kicker: "План впровадження",
        title: "Три зміни, які команда встигає зробити за 30 днів.",
        copy: "Кожна зміна має власника, стартову точку й дату перевірки. Спочатку впроваджуємо найменший крок, що дає вимірюваний сигнал.",
        left: "3 пріоритети",
        right: "30 днів",
        items: [["День 01 · старт", "обрати"], ["День 14 · звірка", "перевірити"], ["День 30 · рішення", "повторити"]]
      }
    };

    const setView = (key, moveFocus = false) => {
      const view = views[key] || views.report;
      tabs.forEach((tab) => {
        const selected = tab.dataset.outputView === key;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
      if (kicker) kicker.textContent = view.kicker;
      if (title) title.textContent = view.title;
      if (copy) copy.textContent = view.copy;
      if (metaLeft) metaLeft.textContent = view.left;
      if (metaRight) metaRight.textContent = view.right;
      panelItems.forEach((item, index) => {
        const data = view.items?.[index] || views.report.items[index];
        const itemLabel = item.querySelector("[data-output-item-label]");
        const itemStatus = item.querySelector("[data-output-item-status]");
        if (itemLabel) itemLabel.textContent = data[0];
        if (itemStatus) itemStatus.textContent = data[1];
        item.classList.toggle("is-current", index === 0);
      });
      const activeTab = tabs.find((tab) => tab.dataset.outputView === key) || tabs[0];
      panel.setAttribute("aria-labelledby", activeTab.id);
      panel.dataset.view = key;
      panel.classList.remove("is-refreshing");
      window.requestAnimationFrame?.(() => panel.classList.add("is-refreshing"));
      if (moveFocus) activeTab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => setView(tab.dataset.outputView));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + delta + tabs.length) % tabs.length;
        setView(tabs[nextIndex].dataset.outputView, true);
      });
    });
    setView(tabs.find((tab) => tab.getAttribute("aria-selected") === "true")?.dataset.outputView || "report");
  }

  function initAssistant() {
    const root = document.querySelector("#assistant");
    const answer = document.querySelector("#assistant-answer");
    const prompts = [...document.querySelectorAll(".assistant-prompt")];
    if (!root || !answer || prompts.length === 0) return;
    const queryForm = document.querySelector("#assistant-form");
    const queryInput = document.querySelector("#assistant-question");

    const responses = {
      result: "Після короткої перевірки команда отримує звіт із доказами: карту втрат по етапах, приклади діалогів, пріоритети, відповідальних і план змін на 30 днів. Ми не підміняємо висновок красивою оцінкою — кожен важливий сигнал можна звірити.",
      automation: "Автоматизуємо повторювані дії: збір даних, звіти, маршрутизацію звернень, контроль чеклістів, контент-календарі та звірки. Бот або скрипт працює в межах правил, а людина погоджує запуск, перевіряє результат і може зупинити процес.",
      price: "Стратегічна сесія — 4 000 грн (60 хв, Zoom). Аудит «Рентген відділу продажів» — 24 000 грн (до 5 менеджерів) або 36 000 грн (6–15). Впровадження «Система продажів + AI» — 45 000 грн (Старт) або 80 000 грн (Повне), оплата 50/50. Супровід — 12 000, 30 000 або 50 000 грн/міс. Коучинг «Керівник продажів за 6 тижнів» — 36 000 грн. Почати можна із сесії. Спершу погоджуємо задачу й час → оплата погодженим способом → після перевірки надходження підтверджуємо слот або старт роботи.",
      human: "Так. ШІ допомагає знайти повторення й підготувати варіанти, але не приймає кадрових, фінансових чи інших важливих рішень самостійно. У системі є межі, журнал дій, перевірка та право людини вимкнути процес."
    };

    prompts.forEach((prompt) => {
      prompt.addEventListener("click", () => {
        const key = prompt.dataset.assistantQuestion;
        answer.textContent = responses[key] || responses.result;
        prompts.forEach((item) => item.classList.toggle("is-active", item === prompt));
      });
    });

    queryForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = String(queryInput?.value || "").trim();
      if (!query) {
        answer.textContent = "Напишіть коротко, який процес буксує. Наприклад: «де губляться угоди?» або «що можна автоматизувати?».";
        queryInput?.focus();
        return;
      }
      const normalized = query.toLocaleLowerCase("uk-UA");
      const key = /ціну|кошту|варт|бюджет/u.test(normalized) ? "price"
        : /результат|отрима|звіт|кабінет|після аудит|як виглядає|план/u.test(normalized) ? "result"
        : /людин|контрол|рішенн|шi|ші/u.test(normalized) ? "human"
        : /автомат|бот|скрипт|таблиц|процес/u.test(normalized) ? "automation"
        : /продаж|сервіс|якість|hr|команд/u.test(normalized) ? "result"
        : null;
      answer.textContent = key ? responses[key] : "Цього немає в моїх погоджених матеріалах. Опишіть процес без імен, контактів, записів і секретів — консультант підкаже безпечний маршрут.";
      prompts.forEach((item) => item.classList.remove("is-active"));
    });
  }

  // v7.0.4: обов'язковий контакт — телефон, Telegram або Instagram.
  // Ті самі правила дублюються на сервері (netlify/functions/lead-intake.mjs).
  const CONTACT_ERROR_EMPTY = "Вкажіть телефон, Telegram або Instagram — інакше ми не зможемо відповісти.";
  const CONTACT_ERROR_FORMAT = "Вкажіть номер телефону (наприклад, +380 67 123 45 67), @нік у Telegram/Instagram або посилання t.me/…";

  function classifyContact(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (raw.length > 120) return "";
    const digits = raw.replace(/[\s().\-]/g, "");
    if (/^\+?\d{9,15}$/.test(digits)) return "phone";
    if (/^@[A-Za-z0-9_.]{3,32}$/.test(raw)) return "handle";
    if (/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_+]{3,64}\/?$/i.test(raw)) return "telegram_link";
    if (/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|ig\.me\/m)\/[A-Za-z0-9_.]{1,30}\/?(?:\?\S*)?$/i.test(raw)) return "instagram_link";
    return "";
  }

  function contactValidationMessage(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return CONTACT_ERROR_EMPTY;
    return classifyContact(raw) ? "" : CONTACT_ERROR_FORMAT;
  }

  function initLeadForm() {
    const form = document.querySelector("#lead-form");
    const status = document.querySelector("#form-status");
    if (!form || !status) return;
    const localBonusLink = form.querySelector(".form-bonus-link");
    const contextHint = form.querySelector("#form-context-hint");
    const contextLabel = contextHint?.querySelector("strong");
    const needField = form.querySelector('select[name="need"]');
    const segmentNeeds = {
      "Відділ продажів": "Продажі та конверсію",
      "Клієнтський сервіс": "Клієнтський сервіс",
      "Контроль якості": "Контроль якості",
      "Операційна команда": "Операції та звіти",
      "Логістика й автопарки": "Логістику або автопарк",
      "Маркетинг і соцмережі": "Маркетинг і соцмережі",
      "Команди з ручним Excel": "Операції та звіти",
      "Виробництво та зміни": "Операції та звіти",
      "Фінанси та звірки": "Операції та звіти",
      "Онлайн-продажі та підтримка": "Клієнтський сервіс",
      "Проєктні команди": "Операції та звіти"
    };

    const shortQuestions = Array.from(form.querySelectorAll('select[required]'));
    const progress = form.querySelector(".form-progress");
    const progressFill = progress?.querySelector("span");
    const progressLabel = form.querySelector(".form-progress-label");
    const updateProgress = () => {
      const answered = shortQuestions.filter((field) => String(field.value || "").trim()).length;
      if (progress) progress.setAttribute("aria-valuenow", String(answered));
      if (progressFill) progressFill.style.transform = `scaleX(${shortQuestions.length ? answered / shortQuestions.length : 0})`;
      if (progressLabel) progressLabel.textContent = `${answered} / ${shortQuestions.length} відповідей`;
    };
    shortQuestions.forEach((field) => field.addEventListener("change", updateProgress));
    updateProgress();

    const contactField = form.querySelector('input[name="lead_contact"]');
    const syncContactValidity = () => {
      if (!contactField) return;
      contactField.setCustomValidity(contactValidationMessage(contactField.value));
    };
    if (contactField) {
      contactField.addEventListener("input", () => {
        syncContactValidity();
        if (contactField.getAttribute("aria-invalid") === "true" && contactField.checkValidity()) {
          contactField.removeAttribute("aria-invalid");
          const note = form.querySelector("#lead_contact-error");
          if (note) note.textContent = "";
        }
      });
      syncContactValidity();
    }

    // Дзеркало в Netlify Forms (data-netlify="true" у HTML): best-effort копія заявки.
    const mirrorToNetlifyForms = (formData) => {
      const body = new URLSearchParams();
      formData.forEach((value, key) => {
        if (key === "consent") return;
        body.append(key, typeof value === "string" ? value : "");
      });
      body.set("form-name", form.getAttribute("name") || "lead-intake");
      if (formData.has("consent")) body.set("consent", "true");
      const mirrorController = typeof AbortController === "function" ? new AbortController() : null;
      const mirrorTimeout = mirrorController ? window.setTimeout(() => mirrorController.abort(), 4000) : 0;
      return fetch("/", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: mirrorController ? mirrorController.signal : undefined
      })
        .then((response) => response.ok)
        .catch(() => false)
        .finally(() => window.clearTimeout(mirrorTimeout));
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      status.classList.remove("is-error", "is-notice");

      form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
      form.querySelectorAll(".field-error").forEach((note) => { note.textContent = ""; });
      syncContactValidity();
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((field) => field.willValidate && !field.checkValidity());
        invalid.forEach((field) => {
          field.setAttribute("aria-invalid", "true");
          const errorId = `${field.name || field.id || "field"}-error`;
          let note = form.querySelector(`#${CSS.escape(errorId)}`);
          if (!note) {
            note = document.createElement("small");
            note.id = errorId;
            note.className = "field-error";
            (field.closest("label") || field.parentElement)?.appendChild(note);
          }
          note.textContent = field.validationMessage || "Це поле обов'язкове.";
          const described = (field.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
          if (!described.includes(errorId)) field.setAttribute("aria-describedby", [...described, errorId].join(" "));
        });
        status.textContent = `Потрібно заповнити або виправити полів: ${invalid.length}. Перевірте позначені поля нижче.`;
        status.classList.add("is-error");
        if (localBonusLink) localBonusLink.hidden = true;
        invalid[0]?.focus({ preventScroll: false });
        return;
      }

      if (form.dataset.legalGate !== "open") {
        status.textContent = form.dataset.flow === "brief"
          ? "Бриф підготовлено локально. Приймання контактів ще вимкнене до закриття юридичних умов — дані нікуди не відправлено."
          : "Коротка заявка підготовлена локально. Приймання контактів ще вимкнене до закриття юридичних умов — дані нікуди не відправлено.";
        status.classList.add("is-notice");
        if (localBonusLink) {
          localBonusLink.hidden = false;
          localBonusLink.focus({ preventScroll: true });
        }
        return;
      }

      if (localBonusLink) localBonusLink.hidden = true;

      // Захист від подвійної відправки: поки запит у дорозі або після успіху
      // повторний submit ігнорується. Автоматичних повторів немає.
      if (form.dataset.sending === "true" || form.dataset.sent === "true") return;

      const submitButton = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const payload = { flow: form.dataset.flow || "short" };
      formData.forEach((value, key) => {
        if (key === "channel") return;
        if (key === "consent") return;
        payload[key] = value;
      });
      const channelValues = formData.getAll("channel").filter(Boolean);
      if (channelValues.length) payload.channel = channelValues;
      payload.consent = formData.has("consent");

      status.textContent = "Надсилаємо заявку…";
      form.dataset.sending = "true";
      form.setAttribute("aria-busy", "true");
      if (submitButton) submitButton.disabled = true;

      // Без таймауту зависле з'єднання лишало статус «Надсилаємо…» назавжди.
      const SUBMIT_TIMEOUT_MS = 15000;
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutId = controller ? window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS) : 0;
      const finish = () => {
        window.clearTimeout(timeoutId);
        delete form.dataset.sending;
        form.removeAttribute("aria-busy");
      };

      const acceptLead = () => {
        finish();
        form.dataset.sent = "true";
        form.classList.add("is-submitted");
        status.textContent = "Заявку прийнято. Повертаємося до сторінки подяки.";
        window.setTimeout(() => { window.location.href = "thank-you.html"; }, 160);
      };

      fetch(form.getAttribute("action"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      })
        .then((response) => {
          if (!response.ok) {
            const error = new Error(`lead-intake responded ${response.status}`);
            error.httpStatus = response.status;
            throw error;
          }
          // Основний запис — у Google Sheet через функцію; копія — у Netlify Forms.
          return mirrorToNetlifyForms(formData).then(() => acceptLead());
        })
        .catch((error) => {
          // Сервер відхилив дані (4xx) — не дублюємо їх у Netlify Forms.
          if (error && error.httpStatus && error.httpStatus < 500) throw error;
          // Збій приймача/мережі (5xx, таймаут): Netlify Forms як резервний запис заявки.
          return mirrorToNetlifyForms(formData).then((mirrored) => {
            if (mirrored) { acceptLead(); return; }
            throw error;
          });
        })
        .catch((error) => {
          finish();
          if (submitButton) submitButton.disabled = false;
          status.textContent = error && error.name === "AbortError"
            ? "Сервер не відповів вчасно — заявка могла вже дійти. Спробуйте ще раз або напишіть на yakuzasalesbot@gmail.com."
            : error && error.httpStatus === 400
              ? "Заявку не прийнято: перевірте контакт (телефон, @нік у Telegram/Instagram або посилання t.me/…) і обов'язкові поля."
              : "Не вдалося надіслати заявку. Спробуйте ще раз або напишіть на yakuzasalesbot@gmail.com.";
          status.classList.add("is-error");
        });
    });

    document.querySelectorAll(".segment-cta").forEach((link) => {
      link.addEventListener("click", () => {
        const segment = link.dataset.segment || "";
        const field = form.querySelector('input[name="segment"]');
        if (field) field.value = segment;
        const mappedNeed = segmentNeeds[segment];
        if (needField && mappedNeed && !String(needField.value || "").trim()) {
          needField.value = mappedNeed;
          needField.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (contextHint && contextLabel && segment) {
          contextLabel.textContent = segment;
          contextHint.hidden = false;
        }
        const heading = form.closest(".brief-grid")?.querySelector("h2");
        if (heading && segment) heading.dataset.segmentHint = segment;
      });
    });
  }

  function initAudienceFilter() {
    const root = document.querySelector("[data-audience-filter]");
    const grid = document.querySelector("#audience-grid");
    const buttons = root ? Array.from(root.querySelectorAll("[data-audience-filter-value]")) : [];
    const cards = grid ? Array.from(grid.querySelectorAll(".audience-card[data-category]")) : [];
    const count = root?.querySelector("[data-audience-count]");
    if (!root || !grid || buttons.length === 0 || cards.length === 0) return;

    const toggle = document.querySelector("[data-audience-toggle]");
    const LIMIT = 6;
    let collapsed = true;
    let current = "all";

    const update = (value) => {
      current = value;
      const matched = cards.filter((card) => value === "all" || card.dataset.category === value);
      // 15 карток одразу — стіна майже на 3000px. Показуємо шість, решту відкриває користувач.
      const visible = collapsed ? matched.slice(0, LIMIT) : matched;
      cards.forEach((card) => {
        card.hidden = !visible.includes(card);
      });
      if (toggle) {
        const hiddenCount = matched.length - visible.length;
        // Ховаємо обгортку <p class="audience-more">, а не тільки кнопку:
        // інакше лишається порожній блок із власними відступами.
        const toggleWrap = toggle.closest(".audience-more") || toggle;
        toggleWrap.hidden = matched.length <= LIMIT;
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.textContent = collapsed ? `Показати ще ${hiddenCount}` : "Згорнути список";
      }
      buttons.forEach((button) => {
        const active = button.dataset.audienceFilterValue === value;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      if (count) count.textContent = `Показано ${visible.length} з ${cards.length} напрямів`;
    };

    toggle?.addEventListener("click", () => {
      collapsed = !collapsed;
      update(current);
      if (collapsed) toggle.scrollIntoView({ block: "center", behavior: "auto" });
    });

    buttons.forEach((button) => {
      button.addEventListener("click", () => update(button.dataset.audienceFilterValue || "all"));
    });
    update("all");
  }

  function initAutomationConsole() {
    const root = document.querySelector("[data-automation-console]");
    const start = root?.querySelector("[data-automation-start]");
    const status = root?.querySelector("[data-automation-status]");
    const stages = root ? Array.from(root.querySelectorAll("[data-stage]")) : [];
    if (!root || !start || !status || stages.length === 0) return;

    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const messages = [
      "Сигнал отримано. Процес починається з чіткої події.",
      "Бот зібрав лише потрібний контекст — без зайвих даних.",
      "Звіт готовий: висновок, доказ і наступна дія.",
      "Людина перевірила результат і підтвердила запуск."
    ];
    let running = false;
    let timer = 0;

    const reset = () => {
      stages.forEach((stage, index) => stage.classList.toggle("is-active", index === 0));
      stages.forEach((stage) => stage.classList.remove("is-complete"));
      start.disabled = false;
      start.innerHTML = 'Запустити процес <span aria-hidden="true">→</span>';
      status.textContent = "Готово. Натисніть «Запустити процес», щоб побачити контроль у дії.";
      running = false;
    };

    const run = (index = 0) => {
      if (index >= stages.length) {
        running = false;
        start.disabled = false;
        start.innerHTML = 'Повторити демо <span aria-hidden="true">↻</span>';
        status.textContent = "Готово. Останнє слово залишається за людиною.";
        return;
      }
      stages.forEach((stage, stageIndex) => {
        stage.classList.toggle("is-active", stageIndex === index);
        stage.classList.toggle("is-complete", stageIndex < index);
      });
      status.textContent = messages[index];
      timer = window.setTimeout(() => run(index + 1), reduced ? 80 : 760);
    };

    start.addEventListener("click", () => {
      if (running) return;
      if (timer) window.clearTimeout(timer);
      running = true;
      start.disabled = true;
      start.textContent = "Процес працює…";
      run(0);
    });

    window.addEventListener("pagehide", () => { if (timer) window.clearTimeout(timer); }, { passive: true });
    reset();
  }

  function initMobileMenu() {
    const toggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector("#mobile-menu");
    if (!toggle || !menu) return;
    const links = Array.from(menu.querySelectorAll("a"));
    let restoreFocus = null;

    const setOpen = (open, moveFocus = true) => {
      toggle.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
      document.body.classList.toggle("menu-open", open);
      if (open) {
        restoreFocus = document.activeElement;
        if (moveFocus && links[0]) links[0].focus();
      } else if (restoreFocus && typeof restoreFocus.focus === "function") {
        restoreFocus.focus();
        restoreFocus = null;
      }
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    links.forEach((link) => link.addEventListener("click", () => {
      setOpen(false, false);
      toggle.focus();
    }));
    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || !links.length || toggle.getAttribute("aria-expanded") !== "true") return;
      const first = links[0];
      const last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setOpen(false);
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 960 && toggle.getAttribute("aria-expanded") === "true") setOpen(false, false);
    }, { passive: true });
  }

  function initYear() {
    const year = document.querySelector("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function initSectionSpy() {
    if (typeof window === "undefined" || !window.IntersectionObserver) return;
    const navs = Array.from(document.querySelectorAll(".nav-wrap > nav, .mobile-menu nav"));
    const links = navs.flatMap((nav) => Array.from(nav.querySelectorAll("a[href^='#']")));
    const sections = Array.from(new Set(links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean)));
    if (!sections.length) return;
    const visible = new Map();
    const clearActive = () => links.forEach((link) => link.removeAttribute("aria-current"));
    const setActive = () => {
      // Hero не має окремого пункту меню: після повернення нагору
      // активний пункт попередньої секції не повинен «залипати».
      if (window.scrollY < 80) {
        clearActive();
        return;
      }
      const active = sections
        .map((section) => ({ section, ratio: visible.get(section.id) || 0 }))
        .sort((a, b) => b.ratio - a.ratio)[0];
      if (!active || active.ratio <= 0) {
        clearActive();
        return;
      }
      links.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${active.section.id}`;
        if (isActive) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0));
      setActive();
    }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, .2, .5, .8, 1] });
    sections.forEach((section) => observer.observe(section));
    // Скрол-слухач тут не потрібен: обсерватор вище викликає setActive на кожному переході.
    // Лишаємо лише окремий дешевий випадок «повернулись у самий верх».
    let topTicking = false;
    window.addEventListener("scroll", () => {
      if (window.scrollY >= 80 || topTicking) return;
      topTicking = true;
      requestFrame(() => { clearActive(); topTicking = false; });
    }, { passive: true });
    setActive();
  }

  function initHeaderState() {
    const header = document.querySelector(".site-header");
    if (!header || typeof window === "undefined") return;
    let ticking = false;
    const update = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 18);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (ticking) return;
      requestFrame(update);
      ticking = true;
    }, { passive: true });
    update();
  }

  function initReveal() {
    const items = document.querySelectorAll(".section-head, .signal-list, .deliverable, .timeline li, .product-card, .automation-manifesto, .audience-card, .audience-note, .faq-grid > *, .brief-grid > *, .story-card, .story-ribbon, .story-quote, .story-path, .story-path li, .story-rail-head, .story-truth-note, .story-line, .story-facts, .story-moments, .story-cta");
    if (typeof window === "undefined") return;
    if (!window.IntersectionObserver) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    items.forEach((item) => { item.classList.add("reveal"); observer.observe(item); });
  }

  function initMotion() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const progress = document.createElement("div");
    progress.className = "scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    document.body.appendChild(progress);

    let ticking = false;
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${scrollable > 0 ? window.scrollY / scrollable : 0})`;
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestFrame(updateProgress);
        ticking = true;
      }
    }, { passive: true });
    updateProgress();

    const glowTargets = document.querySelectorAll(".offer-card, .product-card, .deliverable, .report-mockup, .output-explorer, .output-card, .audience-card, .automation-shot, .story-card, .story-ribbon, .story-cta");
    glowTargets.forEach((card) => {
      card.classList.add("tilt-card");
      // Геометрію читаємо один раз на вхід курсора, записи — у кадрі:
      // інакше кожен pointermove робив read→write і форсував reflow.
      let bounds = null;
      let pending = null;
      let frameQueued = false;
      const paint = () => {
        frameQueued = false;
        if (!pending || !bounds) return;
        const x = (pending.x - bounds.left) / bounds.width;
        const y = (pending.y - bounds.top) / bounds.height;
        card.style.setProperty("--mx", `${x * 100}%`);
        card.style.setProperty("--my", `${y * 100}%`);
        card.style.setProperty("--ry", `${(x - 0.5) * 5}deg`);
        card.style.setProperty("--rx", `${(0.5 - y) * 5}deg`);
        card.style.setProperty("--lift", "-5px");
      };
      card.addEventListener("pointerenter", () => {
        bounds = card.getBoundingClientRect();
        card.classList.add("glow-active");
      });
      card.addEventListener("pointermove", (event) => {
        if (!bounds) bounds = card.getBoundingClientRect();
        pending = { x: event.clientX, y: event.clientY };
        card.classList.add("glow-active");
        if (frameQueued) return;
        frameQueued = true;
        requestFrame(paint);
      });
      card.addEventListener("pointerleave", () => {
        bounds = null;
        pending = null;
        card.classList.remove("glow-active");
        card.style.removeProperty("--mx");
        card.style.removeProperty("--my");
        card.style.removeProperty("--ry");
        card.style.removeProperty("--rx");
        card.style.removeProperty("--lift");
      });
    });

    const hero = document.querySelector(".hero");
    const finePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    if (hero && finePointer) {
      hero.addEventListener("pointermove", (event) => {
        const bounds = hero.getBoundingClientRect();
        hero.style.setProperty("--spot-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
        hero.style.setProperty("--spot-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
      });
      hero.addEventListener("pointerleave", () => {
        hero.style.removeProperty("--spot-x");
        hero.style.removeProperty("--spot-y");
      });
    }
  }

  function initMagneticButtons() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const finePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return;
    document.querySelectorAll(".button-primary").forEach((button) => {
      button.classList.add("magnetic-button");
      const reset = () => {
        button.style.removeProperty("--mag-x");
        button.style.removeProperty("--mag-y");
      };
      button.addEventListener("pointermove", (event) => {
        const bounds = button.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        button.style.setProperty("--mag-x", `${(x * 7).toFixed(2)}px`);
        button.style.setProperty("--mag-y", `${(y * 5).toFixed(2)}px`);
      });
      button.addEventListener("pointerleave", reset);
      button.addEventListener("blur", reset);
    });
  }

  function initCursorAura() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const finePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return;
    const aura = document.createElement("div");
    aura.className = "cursor-aura";
    aura.setAttribute("aria-hidden", "true");
    document.body.appendChild(aura);
    let raf = 0;
    let nextX = 0;
    let nextY = 0;
    const paint = () => {
      aura.style.setProperty("--cursor-x", `${nextX}px`);
      aura.style.setProperty("--cursor-y", `${nextY}px`);
      raf = 0;
    };
    window.addEventListener("pointermove", (event) => {
      nextX = event.clientX;
      nextY = event.clientY;
      aura.classList.add("is-visible");
      if (!raf) raf = requestFrame(paint);
    }, { passive: true });
    window.addEventListener("pointerleave", () => aura.classList.remove("is-visible"), { passive: true });
    document.querySelectorAll("a, button, .glow-card").forEach((target) => {
      target.addEventListener("pointerenter", () => aura.classList.add("is-target"), { passive: true });
      target.addEventListener("pointerleave", () => aura.classList.remove("is-target"), { passive: true });
    });
  }

  function initMotionToggle() {
    const toggle = document.querySelector(".motion-toggle");
    if (!toggle || typeof document === "undefined") return;
    const root = document.documentElement;
    const setPaused = (paused) => {
      root.classList.toggle("motion-paused", paused);
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.textContent = paused ? "Увімкнути рух" : "Пауза руху";
      toggle.setAttribute("aria-label", paused ? "Увімкнути анімації" : "Поставити анімації на паузу");
    };
    toggle.addEventListener("click", () => setPaused(!root.classList.contains("motion-paused")));
    setPaused(false);
  }

  function initStoryRail() {
    const rail = document.querySelector(".story-line");
    if (!rail) return;
    const cards = Array.from(rail.children);
    const prev = document.querySelector("[data-story-prev]");
    const next = document.querySelector("[data-story-next]");
    const progress = document.querySelector(".story-progress");
    const fill = progress?.querySelector("span");
    const label = document.querySelector(".story-progress-label");
    if (!cards.length) return;
    let index = 0;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Клік/клавіша запускає плавний скрол; поки він триває, scroll-подія від
    // ЦІЄЇ Ж анімації встигає долетіти до syncFromScroll із проміжним (ще не
    // фінальним) scrollLeft і відкочує index назад — картка блимає до попередньої.
    // Тому на час програмного скролу sync від scroll-подій приглушуємо.
    let suppressSync = false;
    let suppressTimer = null;
    const setIndex = (nextIndex, move = true) => {
      index = Math.max(0, Math.min(cards.length - 1, nextIndex));
      const card = cards[index];
      if (move && card) {
        suppressSync = true;
        if (suppressTimer) window.clearTimeout(suppressTimer);
        suppressTimer = window.setTimeout(() => { suppressSync = false; }, 900);
        rail.scrollTo({ left: card.offsetLeft - rail.offsetLeft, behavior: reduced ? "auto" : "smooth" });
      }
      if (progress) progress.setAttribute("aria-valuenow", String(index + 1));
      if (progress) {
        const time = card?.querySelector("time")?.textContent?.replace(/\s+/gu, " ").trim();
        const description = card?.querySelector("figcaption span")?.textContent?.replace(/\s+/gu, " ").trim();
        const caption = [time, description].filter(Boolean).join(" — ");
        if (caption) progress.setAttribute("aria-valuetext", caption);
      }
      if (fill) fill.style.transform = `scaleX(${cards.length > 1 ? index / (cards.length - 1) : 1})`;
      if (label) label.textContent = `${String(index + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
      cards.forEach((item, i) => {
        const active = i === index;
        item.classList.toggle("is-active", active);
        if (active) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      });
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === cards.length - 1;
    };
    // Геометрію карток міряємо один раз (і на resize), а не 27 разів за подію скролу.
    let railLeft = 0;
    let cardOffsets = [];
    let railWidth = 0;
    const measureRail = () => {
      railLeft = rail.offsetLeft;
      railWidth = rail.clientWidth;
      cardOffsets = cards.map((card) => card.offsetLeft);
    };
    measureRail();
    window.addEventListener("resize", measureRail, { passive: true });
    let railTicking = false;
    const syncFromScroll = () => {
      if (suppressSync) return;
      if (railTicking) return;
      railTicking = true;
      requestFrame(() => {
        railTicking = false;
        if (!cardOffsets.length) measureRail();
        const center = rail.scrollLeft + railWidth * .28;
        let closest = 0;
        for (let i = 0; i < cardOffsets.length; i += 1) {
          if (Math.abs(cardOffsets[i] - railLeft - center) < Math.abs(cardOffsets[closest] - railLeft - center)) closest = i;
        }
        setIndex(closest, false);
      });
    };
    prev?.addEventListener("click", () => setIndex(index - 1));
    next?.addEventListener("click", () => setIndex(index + 1));
    rail.addEventListener("scroll", syncFromScroll, { passive: true });
    rail.addEventListener("scrollend", () => {
      suppressSync = false;
      if (suppressTimer) window.clearTimeout(suppressTimer);
    }, { passive: true });
    rail.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); setIndex(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); setIndex(index + 1); }
    });
    setIndex(0, false);
  }

  function initPhotoLightbox() {
    const dialog = document.querySelector("#photo-lightbox");
    const image = dialog?.querySelector("img");
    const caption = dialog?.querySelector("figcaption");
    const close = dialog?.querySelector(".lightbox-close");
    if (!dialog || !image || !caption || !close) return;
    const sources = document.querySelectorAll("#story img");
    let lastSource = null;
    sources.forEach((source) => {
      source.setAttribute("tabindex", "0");
      source.setAttribute("role", "button");
      source.setAttribute("aria-label", `Відкрити фото: ${source.alt}`);
      const open = () => {
        lastSource = source;
        image.src = source.currentSrc || source.src;
        image.alt = source.alt;
        caption.textContent = source.closest("figure")?.querySelector("figcaption")?.textContent || source.alt;
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
        close.focus();
      };
      source.addEventListener("click", open);
      source.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
    close.addEventListener("click", () => dialog.close?.());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close?.(); });
    dialog.addEventListener("close", () => lastSource?.focus());
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    });
  }

  function initMobileQuickbar() {
    const bar = document.querySelector(".mobile-quickbar");
    if (!bar || typeof window === "undefined") return;
    const mobile = window.matchMedia && window.matchMedia("(max-width: 680px)").matches;
    if (!mobile) return;
    // scrollHeight у скрол-хендлері форсував layout на кожну подію — кешуємо.
    let bottomLimit = 0;
    const measure = () => { bottomLimit = document.documentElement.scrollHeight - window.innerHeight - 80; };
    // Поки на екрані згода або submit лід-форми, панель ховаємо, щоб вона їх не перекривала.
    let formInView = false;
    const apply = () => bar.classList.toggle("is-visible", !formInView && window.scrollY > 520 && window.scrollY < bottomLimit);
    const forms = document.querySelectorAll('.lead-form [type="submit"], .lead-form input[type="checkbox"]');
    if (forms.length && typeof IntersectionObserver === "function") {
      const seen = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) seen.add(entry.target); else seen.delete(entry.target); });
        formInView = seen.size > 0;
        apply();
      });
      forms.forEach((form) => io.observe(form));
    }
    let ticking = false;
    const update = () => {
      if (ticking) return;
      ticking = true;
      requestFrame(() => { apply(); ticking = false; });
    };
    measure();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", () => { measure(); apply(); }, { passive: true });
    apply();
  }

  if (typeof document !== "undefined") {
    initDisclosure("[data-gallery-grid]", "[data-gallery-toggle]", ["Показати приклади автоматизацій", "Згорнути приклади"]);
    initStoryMoments();
    initCalculator();
    initScan();
    initOutputExplorer();
    initAssistant();
    initAutomationConsole();
    initLeadForm();
    initAudienceFilter();
    initMobileMenu();
    initYear();
    initSectionSpy();
    initHeaderState();
    initReveal();
    initMotion();
    initMagneticButtons();
    initCursorAura();
    initMotionToggle();
    initStoryRail();
    initPhotoLightbox();
    initMobileQuickbar();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      toFiniteNumber,
      calculateOpportunity,
      formatCurrency,
      formatDeals,
      evaluateAuditFit,
      classifyContact,
      contactValidationMessage
    };
  }
})();
