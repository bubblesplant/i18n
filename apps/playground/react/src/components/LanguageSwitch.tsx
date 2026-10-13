interface Props {
  locale: string | undefined;
  label: string;
  pending: boolean;
  onChange: (locale: string) => Promise<void>;
}

export default function LanguageSwitch({ locale, label, pending, onChange }: Props) {
  return (
    <div className="language-switch" role="group" aria-label={label} aria-busy={pending}>
      <button
        type="button"
        aria-pressed={locale === "zh-CN"}
        disabled={pending}
        onClick={() => void onChange("zh-CN")}
      >
        中文
      </button>
      <button
        type="button"
        aria-pressed={locale === "en-US"}
        disabled={pending}
        onClick={() => void onChange("en-US")}
      >
        English
      </button>
    </div>
  );
}
