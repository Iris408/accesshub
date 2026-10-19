import PageHeader from "../components/ui/PageHeader";
import { useI18n } from "../i18n/context";

const FAQS = [
  { question: "help.q1", answer: "help.a1" },
  { question: "help.q2", answer: "help.a2" },
  { question: "help.q3", answer: "help.a3" },
  { question: "help.q4", answer: "help.a4" },
] as const;

function HelpPage() {
  const { t } = useI18n();

  return (
    <>
      <PageHeader
        eyebrow={t("help.eyebrow")}
        title={t("help.title")}
        description={t("help.description")}
      />

      <section className="ah-panel" aria-label={t("help.faqLabel")}>
        <dl className="ah-faq">
          {FAQS.map((faq) => (
            <div key={faq.question} className="ah-faq__item">
              <dt>{t(faq.question)}</dt>
              <dd>{t(faq.answer)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

export default HelpPage;
