import { useMemo } from "react";
import { Building2, Download, History, Spline, SquareDashed } from "lucide-react";
import { initialMapState, type MapState } from "./cityData";
import { FormThumb, MapPreview, buildingForms } from "./mapShapes";
import { blankMapState, readDraft, startNewMap } from "./mapState";

const features = [
  {
    icon: SquareDashed,
    title: "Зоны",
    text: "Районы со своим цветом и подписью. Зону можно двигать одну или вместе со зданиями и тянуть за стороны и углы.",
  },
  {
    icon: Spline,
    title: "Дороги и перекрёстки",
    text: "Улицы и магистрали с редактируемыми точками и шириной. На пересечениях сами появляются площадки и пешеходные переходы.",
  },
  {
    icon: Building2,
    title: "Здания, парки, вода",
    text: `${buildingForms.length} форм: корпуса, башни, таунхаусы, депо, стадион, парковка, сквер, лес, сад и пруд. Цвет, поворот и размеры — в инспекторе.`,
  },
  {
    icon: History,
    title: "Версии и отмена",
    text: "Автосохранение, до 12 сохранённых версий и отмена последних 40 действий, включая правки в инспекторе.",
  },
  {
    icon: Download,
    title: "Экспорт",
    text: "JSON для резервной копии и обмена, PNG 2200×1700 для печати и ссылка, в которой карта записана целиком.",
  },
];

// Цвета зон из примера: витрина форм показывает их в тех же красках, что и на карте.
const SHOWCASE_COLORS = ["#fbbf24", "#06b6d4", "#10b981", "#ef4444", "#8b5cf6", "#f59e0b"];

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

function scrollToSection(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
  event.preventDefault();
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}

export default function Landing({ onOpenEditor }: { onOpenEditor: () => void }) {
  const draft = useMemo(readDraftSafely, []);
  const groups = useMemo(
    () => (["Здания", "Особые", "Зелень и вода"] as const).map((group) => ({ group, forms: buildingForms.filter((entry) => entry.group === group) })),
    [],
  );

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
        draft.versions ? `${draft.versions} ${plural(draft.versions, "версия", "версии", "версий")}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="landing">
      <header className="landing-wrap landing-bar">
        <a className="landing-brand" href="./">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          Urban Blueprint
        </a>
        <nav className="landing-nav" aria-label="Разделы">
          <a href="#features" onClick={(event) => scrollToSection(event, "features")}>Возможности</a>
          <a href="#catalog" onClick={(event) => scrollToSection(event, "catalog")}>Каталог форм</a>
        </nav>
        <button type="button" className="btn" onClick={() => open()}>
          Открыть редактор
        </button>
      </header>

      <main>
        <section className="landing-wrap landing-hero">
          <div>
            <h1>Генплан города прямо в браузере</h1>
            <p className="landing-lead">
              Urban Blueprint — редактор технического генплана: районы, улицы, здания и подписи на одном листе, вид строго сверху. Без регистрации и
              сервера — схема хранится в этом браузере.
            </p>

            {draft ? (
              <div className="landing-draft">
                <div className="landing-draft-label">Черновик в этом браузере</div>
                <div className="landing-draft-title">{draft.state.title}</div>
                <div className="landing-draft-meta">{draftMeta}</div>
                <div className="landing-actions">
                  <button type="button" className="btn btn-primary" onClick={() => open()}>
                    Продолжить черновик
                  </button>
                  <button type="button" className="btn" onClick={() => open(structuredClone(initialMapState))}>
                    Новая карта
                  </button>
                </div>
                {draft.edited ? <p className="landing-note">Черновик не пропадёт: при новой карте он ляжет первой версией в «Сохранения»</p> : null}
              </div>
            ) : (
              <>
                <div className="landing-actions">
                  <button type="button" className="btn btn-primary" onClick={() => open(structuredClone(initialMapState))}>
                    Создать карту
                  </button>
                  <button type="button" className="btn" onClick={() => open(blankMapState())}>
                    Чистый лист
                  </button>
                </div>
                <p className="landing-note">Карта начнётся с примера города — его удобно переделать под себя</p>
              </>
            )}

            <ul className="landing-facts">
              <li>{buildingForms.length} форм объектов</li>
              <li>до 12 версий</li>
              <li>PNG 2200×1700</li>
            </ul>
          </div>

          <figure className="sheet">
            <MapPreview mapState={initialMapState} highlight="palace" label="Пример схемы: шесть районов, улицы с перекрёстками, здания, река и штамп чертежа" />
            <figcaption>
              <span>Пример: технический генплан города</span>
              <span>Лист 01 · М 1:2000</span>
            </figcaption>
          </figure>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-wrap">
            <div className="landing-section-head">
              <h2>Что умеет</h2>
              <p>Всё, что нужно для схемы района или целого города: от границ зон до пешеходного перехода на перекрёстке.</p>
            </div>
            <ul className="feature-list">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="catalog" className="landing-section">
          <div className="landing-wrap">
            <div className="landing-section-head">
              <h2>Каталог форм</h2>
              <p>Любую форму можно поставить на карту из каталога в редакторе, а у готового объекта — поменять одним щелчком.</p>
            </div>
            <div className="catalog-showcase">
              {groups.map(({ group, forms }, groupIndex) => (
                <div key={group}>
                  <h3>{group}</h3>
                  <div className="form-grid">
                    {forms.map((entry, index) => (
                      <div key={entry.form} className="form-tile">
                        <FormThumb form={entry.form} color={SHOWCASE_COLORS[(index + groupIndex * 2) % SHOWCASE_COLORS.length]} />
                        <span>{entry.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-wrap landing-storage">
            <h2>Где хранятся карты</h2>
            <p>
              Только в localStorage этого браузера, на этом адресе. Чтобы перенести карту на другой компьютер, сделайте «Экспорт JSON» и «Импорт JSON»
              или отправьте ссылку карты. Работали на старом адресе — <a href="/transfer.html">перенесите карты</a>.
            </p>
          </div>
        </section>
      </main>

      <footer className="landing-wrap">
        <div className="landing-footer">
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
        </div>
      </footer>
    </div>
  );
}
