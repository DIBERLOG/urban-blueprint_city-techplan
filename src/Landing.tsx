import { useMemo } from "react";
import { initialMapState, type MapState } from "./cityData";
import { MapPreview } from "./mapShapes";
import { blankMapState, readDraft, startNewMap } from "./mapState";

const features = [
  {
    title: "Зоны",
    text: "Районы со своим цветом и подписью. Зону можно двигать одну или вместе со зданиями и тянуть за стороны и углы.",
  },
  {
    title: "Дороги и магистрали",
    text: "Ломаные с редактируемыми точками и шириной. Здания не наезжают на дороги, пока это не отключено.",
  },
  {
    title: "Здания",
    text: "19 форм: от прямоугольника и L-образного корпуса до депо, цеха с зубчатой крышей, порта, парка и группы деревьев.",
  },
  {
    title: "Версии",
    text: "Автосохранение, до 12 сохранённых версий и отмена последних 40 действий — правки в инспекторе тоже отменяются.",
  },
  {
    title: "Экспорт",
    text: "JSON для резервной копии и обмена, PNG 2200×1700 для печати и ссылка, в которой карта записана целиком.",
  },
];

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function readDraftSafely() {
  try {
    return readDraft(localStorage);
  } catch {
    return null;
  }
}

export default function Landing({ onOpenEditor }: { onOpenEditor: () => void }) {
  const draft = useMemo(readDraftSafely, []);

  const open = (next?: MapState) => {
    if (next) {
      try {
        startNewMap(localStorage, next);
      } catch {
        // Хранилище недоступно (приватный режим) — редактор откроется с примером.
      }
    }
    onOpenEditor();
  };

  const draftMeta = draft
    ? [
        `${draft.state.zones.length} ${plural(draft.state.zones.length, "зона", "зоны", "зон")}`,
        `${draft.objects} ${plural(draft.objects, "объект", "объекта", "объектов")}`,
        draft.versions ? `${draft.versions} ${plural(draft.versions, "сохранённая версия", "сохранённые версии", "сохранённых версий")}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="landing">
      <header className="landing-bar">
        <a className="landing-brand" href="./">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          Urban Blueprint
        </a>
        <button type="button" className="landing-link" onClick={() => open()}>
          Открыть редактор
        </button>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1>Схема города в браузере</h1>
            <p className="landing-lead">
              Urban Blueprint — редактор технического генплана: зоны, дороги, здания и подписи на одном листе, вид строго сверху.
              Без регистрации и сервера: схема хранится в этом браузере.
            </p>

            {draft ? (
              <div className="landing-draft">
                <div className="landing-draft-label">Черновик в этом браузере</div>
                <div className="landing-draft-title">{draft.state.title}</div>
                <div className="landing-draft-meta">{draftMeta}</div>
                <div className="landing-actions">
                  <button type="button" className="landing-primary" onClick={() => open()}>
                    Продолжить черновик
                  </button>
                  <button type="button" className="landing-secondary" onClick={() => open(structuredClone(initialMapState))}>
                    Новая карта
                  </button>
                </div>
                {draft.edited ? <p className="landing-note">Черновик не пропадёт: при новой карте он ляжет первой версией в «Сохранения».</p> : null}
              </div>
            ) : (
              <div className="landing-actions">
                <button type="button" className="landing-primary" onClick={() => open(structuredClone(initialMapState))}>
                  Создать карту
                </button>
                <button type="button" className="landing-secondary" onClick={() => open(blankMapState())}>
                  Чистый лист
                </button>
              </div>
            )}
            {!draft ? <p className="landing-note">Карта начнётся с примера города — его удобно переделать под себя. «Чистый лист» — без объектов.</p> : null}
          </div>

          <figure className="landing-example">
            <div className="map-preview">
              <MapPreview mapState={initialMapState} label="Пример схемы: шесть районов, дороги, здания, река и штамп чертежа" />
            </div>
            <figcaption>Пример схемы — с ним открывается новая карта.</figcaption>
          </figure>
        </section>

        <section className="landing-features" aria-labelledby="features-title">
          <h2 id="features-title">Что умеет</h2>
          <ul>
            {features.map((feature) => (
              <li key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-storage">
          <h2>Где хранятся карты</h2>
          <p>
            Только в localStorage этого браузера, на этом адресе. Чтобы перенести карту на другой компьютер, сделайте «Экспорт JSON» и
            «Импорт JSON» или отправьте ссылку карты. Работали на старом адресе — <a href="/transfer.html">перенесите карты</a>.
          </p>
        </section>
      </main>

      <footer className="landing-footer">
        <span>© DIBERLOG · Urban Blueprint</span>
        <a href="mailto:workbook.ea@mail.ru">workbook.ea@mail.ru</a>
        <a href="https://t.me/Diberlog_bot" target="_blank" rel="noopener noreferrer">
          Написать в Telegram
        </a>
        <a href="https://github.com/DIBERLOG/urban-blueprint_city-techplan" target="_blank" rel="noopener noreferrer">
          Исходники на GitHub
        </a>
        <nav className="landing-legal" aria-label="Документы">
          <a href="/privacy.html">Политика конфиденциальности</a>
          <a href="/cookies.html">Политика cookies</a>
          <a href="/terms.html">Пользовательское соглашение</a>
        </nav>
      </footer>
    </div>
  );
}
